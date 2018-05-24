const EventEmitter     = require('events').EventEmitter;
const Cache            = require('timed-cache');
const MessageProcessor = require('./lib/message-ordering');

/**
 * Normalize a topic to abvoid double trailing slashes.
 */
const normalize = (topic) => {
  // Removing trailing slash.
  if (topic.charAt(topic.length - 1) === '/') {
    topic = topic.substr(topic.length - 2)
  }
  // Removing leading slash.
  if (topic.charAt(0) === '/') {
    topic = topic.substr(1, topic.length - 1);
  }
  return (topic);
};

/**
 * @return the topic associated with the server listening topic, based on
 * the given topic mount point.
 * @param {*} topic the topic mount point.
 */
const getPlaceholder = (topic) => (`${normalize(topic)}/+/request`);

/**
 * @return the topic associated with the given payload type.
 * @param {*} topic the topic mount point.
 * @param {*} object the expressify request or response
 * payload.
 */
const getTopic = (topic, object, type) => (`${normalize(topic)}/${object.transactionId}/${type || object.type}`);

/**
 * @return the topic associated with events associated with the given `resource`.
 * @param {*} resource the resource associated with the event topic.
 */
const getEventTopic = (topic, resource) => (`${normalize(topic)}/${normalize(resource)}/events`);

/**
 * Throws an exception if the given `opts` object
 * is invalid.
 */
const enforceOptions = (opts) => {
  if (!opts || !opts.topic || !opts.mqtt) {
    throw new Error('A reference to the `mqtt` implementation and a `topic` to subscribe to are required')
  }
};

/**
 * Treats received messages from either the `mqtt` library
 * or the message processor.
 * @param {*} topic the topic on which the message has been published.
 * @param {*} message the JSON payload associated with the received message.
 */
const emitMessage = function (topic, message) {
  const request = this.cache.get(topic);

  if (request && message.type === 'response') {
    if (request.method === 'subscribe' && message.code === 200) {
      this.subscribeAsync(getEventTopic(this.opts.topic, message.payload.topic));
    }
    // If we received a response to a previous request,
    // we can unsubscribe from the response topic.
    this.unsubscribeAsync(getTopic(this.opts.topic, message));
    this.cache.remove(topic);
  }
  this.emit('message', { data: message });
};

/**
 * Called back when a new inbound message has
 * been received.
 * @param {*} topic the topic on which the message has been published.
 * @param {*} payload the payload associated with the received message.
 */
const onMessage = function (topic, payload) {
  try {
    const message = JSON.parse(payload);

    if (message.headers.sequence) {
      // Reordering stateful messages.
      return (this.processor.push({ topic, message }));
    }
    // Forwarding the message to the upper layer.
    return (this.emitMessage(topic, message));
  } catch (e) {}
};

/**
 * Subscribes to the given `topic`.
 * @return a promise resolved when the given `topic` have been
 * successfully subscribed.
 * @param {*} topic the topic to subscribe to.
 */
const subscribe = function (topic) {
  return new Promise((resolve, reject) => {
    this.opts.mqtt.subscribe(topic, this.opts.mqttOpts, (err, granted) => (err ? reject(err) : resolve(granted)));
  });
};

/**
 * Unsubscribes from the given `topic`.
 * @return a promise resolved when the given `topic` have been
 * successfully unsubscribed.
 * @param {*} topic the topic to unsubscribe from.
 */
const unsubscribe = function (topic) {
  return new Promise((resolve, reject) => {
    this.opts.mqtt.unsubscribe(topic, (err) => (err ? reject(err) : resolve(topic)));
  });
};

/**
 * Publishes the given `payload` on the given `topic`.
 * @return a promise resolved when the given `payload` has been
 * successfully written on the given `topic`.
 * @param {*} topic the topic to send the `payload` to.
 * @param {*} payload the payload to send.
 */
const publish = function (topic, payload) {
  return new Promise((resolve, reject) => {
    this.opts.mqtt.publish(topic, JSON.stringify(payload), this.opts.mqttOpts, (err) => (err ? reject(err) : resolve(topic)));
  });
};

/**
 * (Re-)Arms the timer associated with the given
 * `resource` timeout.
 * @param {*} resource the resource associates with
 * the subscription to re-arm.
 */
const reArm = function (resource) {
  this.eventCache.put(resource, true, {
    callback: () => {
      // Removing all subscriptions for the `resource`.
      removeSubscription.call(this, resource);
      // Notifying the unsubscription.
      this.emit('subscription.removed', { resource });
    }
  });
};

/**
 * Registers a new subscription.
 * @param {*} resource the resource to associate with
 * the new subscription.
 */
const register = function (resource) {
  // (Re-)Arming the timer associated with the resource.
  reArm.call(this, resource);
  // Creating subscription for the resource.
  if (!this.subscribers[resource]) {
    return (this.subscribers[resource] = {
      // Number of subscribers for the `resource`.
      count: 1,
      // The current sequence number.
      sequence: 0,
      // A reference to this strategy.
      connection: this
    });
  }
  // Incrementing the reference counter on the number of
  // subscribers for `resource`.
  return (this.subscribers[resource].count++);
};

/**
 * Removes the subscription(s) associated with
 * the given `resource`.
 * @param {*} resource the resource to remove
 * from the subscriptions.
 */
const removeSubscription = function (resource) {
  // Removing the subscription timer.
  this.eventCache.remove(resource);
  // Removing the subscription from memory.
  delete this.subscribers[resource];
};

/**
 * Decrements the reference counter associated with
 * the given subscription.
 * @param {*} resource the resource associated with
 * the subscription to dereference.
 * @return whether the `unregister` operation has suceeded.
 */
const unregister = function (resource) {
  if (!this.subscribers[resource]) return (false);
  // Dereferencing a subscriber.
  if (!(--this.subscribers[resource].count)) {
    // If the reference counter reached zero, we remove the
    // subscription.
    removeSubscription.call(this, resource);
  }
  return (true);
};

/**
 * Called back on a `ping` request.
 * @param {*} req the expressify request.
 * @param {*} res the expressify response.
 */
const onPing = function (req, res) {
  // Re-arming timers associated with the given resources.
  if (Array.isArray(req.payload.resources)) {
    req.payload.resources.forEach((r) => reArm.call(this, r));
  }
  // Replying a succeeded operation.
  res.send(200);
};

/**
 * Sends the given `request` to the current topic.
 * @param {*} request the request to send.
 */
const query = function (request) {
  const destination = getTopic(this.opts.topic, request);
  const source      = getTopic(this.opts.topic, request, 'response');

  // Subscribing to the associated response topic.
  return this.subscribeAsync(source)
     // Unsubscribing from the response topic after `eventTimeout`.
    .then(() => {
      this.cache.put(source, request, {
        callback: (key) => this.unsubscribeAsync(key)
      });
    })
    // Publishing the `request` object on the `destination` topic.
    .then(() => this.publishAsync(destination, request));
};

/**
 * Sends the given `response` to the initiating
 * client.
 * @param {*} response the response to send.
 */
const reply = function (response) {
  return (this.publishAsync(getTopic(this.opts.topic, response), response));
};

/**
 * Notifies an array of subscribers currently observing
 * the resource associated with the given `event`.
 * @param {*} event the event to dispatch.
 */
const notify = function (event) {
  const subscribers = this.subscribers[event.resource];

  if (!subscribers || !subscribers.count) {
    // There are no subscribers for the given `resource`.
    return (Promise.resolve());
  }
  // If the given event needs to be ordered we increment its sequence number.
  if (event.opts.ordered) {
    event.headers.sequence = subscribers.sequence++;
  }
  // Publishing the event to the appropriate `topic`.
  return (this.publishAsync(getEventTopic(this.opts.topic, event.resource), event));
};

/**
 * The MQTT strategy class allows to carry
 * expressify messages over an MQTT transport.
 */
class Strategy extends EventEmitter {

  /**
   * MQTT strategy constructor.
   * @param {*} opts the configuration object to be used.
   */
  constructor(opts) {
    super();
    enforceOptions(opts);
    this.opts = opts || {};
    this.subscribers = {};
    if (!this.opts.mqttOpts) this.opts.mqttOpts = { qos: 1 };
    this.timeout = this.opts.timeout || (10 * 1000);
    this.cache = new Cache({ defaultTtl: this.timeout });
    this.eventTimeout = this.opts.eventTimeout || (60 * 1000);
    this.eventCache = new Cache({ defaultTtl: this.eventTimeout });
    this.awaitTimeout = this.opts.awaitTimeout || (3 * 1000);
    this.processor = new MessageProcessor({ awaitTimeout: this.awaitTimeout });
    this.onMessage = onMessage.bind(this);
    this.emitMessage = emitMessage.bind(this);
    this.subscribeAsync = subscribe.bind(this);
    this.unsubscribeAsync = unsubscribe.bind(this);
    this.publishAsync = publish.bind(this);
    this.on('ping', (o) => onPing.call(this, o.req, o.res));
    // Subscribing to inbound MQTT messages.
    this.opts.mqtt.on('message', this.onMessage);
    // Subscribing to reordered messages.
    this.processor.on('message', this.emitMessage);
  }

  /**
   * Publishes a message on a request topic.
   * @param {*} object the expressify payload to publish.
   */
  publish(object) {
    if (object.type === 'request') {
      return (query.call(this, object));
    } else if (object.type === 'response') {
      return (reply.call(this, object));
    } else if (object.type === 'event') {
      return (notify.call(this, object));
    }
    return (Promise.reject('Invalid request type'));
  }

  /**
   * Creates a subscription on the resource expressed on the
   * given request object.
   * @param {*} req the expressify request.
   * @param {*} res the expressify response.
   */
  subscribe(req, res) {
    const topic = req.resource;
    // Registering the subscription.
    register.call(this, topic);
    // Notifying the subscription.
    this.emit('subscription.added', req);
    // Replying a succeeded operation.
    res.send({ topic });
  }

  /**
   * Removes an existing subscription on the resource expressed on the
   * given request object.
   * @param {*} req the expressify request.
   * @param {*} res the expressify response.
   */
  unsubscribe(req, res) {
    const topic = req.resource;
    // Removing the subscription if it exists.
    if (!unregister.call(this, topic)) {
      return res.send(404, { error: 'No such subscription' });
    }
    // Notifying the unsubscription.
    this.emit('subscription.removed', req);
    // Replying a succeeded operation.
    res.send({ topic });
  }

  /**
   * Starts listening for incoming message on the MQTT topic
   * associated with the specified mount point in the class
   * configuration object.
   * @return a promise resolved when the listening operation
   * has been completed.
   */
  listen() {
    const topic = getPlaceholder(this.opts.topic);
    return (this.subscribeAsync(topic));
  }

  /**
   * Stops listening for incoming message on the MQTT topic
   * associated with the specified mount point in the class
   * configuration object.
   * @return a promise resolved when the closing operation
   * has been completed.
   */
  close() {
    const topic = getPlaceholder(this.opts.topic);
    return (this.unsubscribeAsync(topic));
  }
};

module.exports = Strategy;