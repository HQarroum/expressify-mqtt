const EventEmitter  = require('events').EventEmitter;
const PriorityQueue = require('fastpriorityqueue');

/**
 * Throws an exception if the given `opts` object
 * is invalid.
 */
const enforceOptions = (opts) => {
  if (!opts || !opts.awaitTimeout) {
    throw new Error('A reference to the `awaitTimeout` value is expected');
  }
};

/**
 * Default comparator for the message processor.
 * @param {*} a first message descriptor to compare.
 * @param {*} b second message descriptor to compare.
 */
const defaultComparator = (a, b) => a.sequence < b.sequence;

/**
 * Flush the priority queue.
 * @param {*} resource the resource to flush.
 */
const flush = function (resource) {
  if (!resource.queue.isEmpty()) {
    const next = resource.queue.peek();
    if (+next.sequence <= +resource.expected) {
      resource.expected++;
      this.emit('message', next.topic, next.message);
      resource.queue.poll();
      return this.flush(resource);
    }
  }
};

/**
 * Processes the given message order in the state machine.
 * @param {*} topic the topic on which the message has been published.
 * @param {*} message the message to process.
 */
const process = function (topic, message) {
  const sequence = message.headers.sequence;
  const resource = this.resources[message.resource];

  const dispatch = () => {
    const keys = Object.keys(resource.buffer);
    for (let i = 0; i < keys.length; ++i) {
      if (keys[i] == resource.expected) {
        const entry = resource.buffer[keys[i]];
        resource.expected++;
        this.emit('message', entry.topic, entry.message);
        delete resource.buffer[keys[i]];
        return dispatch();
      }
    }
  };
  // Saving the last received sequence number.
  resource.lastSequence = sequence;
  if (resource.expected === -1) {
    //console.log('init at', sequence);
    // Initial message received.
    resource.expected = sequence;
  }
  // Clearing security timeout.
  clearTimeout(resource.handle);
  if (sequence !== resource.expected) {
    // Arming the security timeout if the received message is unexpected.
    resource.handle = setTimeout(() => {
      //console.log('Timeout, setting expected from', resource.expected, 'to', resource.lastSequence + 1);
      resource.expected = resource.lastSequence + 1;
      //while (!resource.queue.isEmpty()) resource.queue.poll();
      resource.buffer.length = 0;
    }, this.opts.awaitTimeout);
    // Buffering out-of-order messages.
    resource.buffer[sequence] = { topic, message };
    //resource.queue.add({ topic, message, sequence });
  } else {
    // Message sequence is expected, emitting and unbuffering.
    this.emit('message', topic, message);
    // Incrementing the next expected sequence number.
    resource.expected++;
    // Flushing existing messages.
    return (dispatch(resource));
  }
};

/**
 * The message processor is a state machine which reorders
 * received stateful messages.
 */
class Processor extends EventEmitter {

  /**
   * Processor constructor.
   * @param {*} opts processor options object.
   */
  constructor(opts) {
    super();
    enforceOptions(opts);
    this.opts = opts;
    this.resources = {};
    this.buffer = {};
    this.process = process.bind(this);
    this.flush = flush.bind(this);
  }

  /**
   * Pushes the given `message` in the processor's
   * state machine.
   * @param {*} event the event payload.
   */
  push(event) {
    const topic   = event.topic;
    const message = event.message;

    if (!this.resources[message.resource]) {
      // Initial creation of the resource mapping.
      this.resources[message.resource] = {
        sequence: 0,
        expected: -1,
        lastSequence: 0,
        buffer: {},
        queue: new PriorityQueue(defaultComparator)
      };
    }
    this.process(topic, message);
  }
}

module.exports = Processor;