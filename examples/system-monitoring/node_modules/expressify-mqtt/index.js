const EventEmitter = require('events').EventEmitter;
const Cache = require('timed-cache');

/**
 * @return the topic associated with the server listening topic, based on
 * the given topic mount point.
 * @param {*} topic the topic mount point.
 */
const getPlaceholder = (topic) => (`${topic}/+/request`);

/**
 * @return the topic associated with the given payload type.
 * @param {*} topic the topic mount point.
 * @param {*} object the expressify request or response
 * payload. 
 */
const getTopic = (topic, object, type) => (`${topic}/${object.transactionId}/${type || object.type}`);

/**
 * @return the topic associated with events associated with the given `resource`.
 * @param {*} resource the resource associated with the event topic.
 */
const getEventTopic = (topic, resource) => (`${topic}/${resource}/events`);

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
 * Called back when a new inbound message has
 * been received.
 */
const onMessage = function (topic, payload) {
  try {
    const message = JSON.parse(payload);
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
  console.log('rearm', resource);
  this.eventCache.put(resource, true, {
    callback: () => {
      console.log('event cache clear', resource);
      removeSubscription.call(this, resource);
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
    return (this.subscribers[resource] = { count: 1, connection: this });
  }
  // Incrementing the reference counter on the number of
  // subscribers for `resource`.
  return (this.subscribers[resource].count++);
};

const removeSubscription = function (resource) {
  console.log('removeSubscription', resource);
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
  console.log('unregister', resource, 'reference count is', this.subscribers[resource].count - 1);
  // Dereferencing a subscriber.
  if (!(--this.subscribers[resource].count)) {
    // If the reference counter reached zero, we remove the
    // subscription.
    removeSubscription.call(this, resource);
  }
  return (true);
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
    this.onMessage = onMessage.bind(this);
    this.subscribeAsync = subscribe.bind(this);
    this.unsubscribeAsync = unsubscribe.bind(this);
    this.publishAsync = publish.bind(this);
    this.opts.mqtt.on('message', this.onMessage);
  }

  /**
   * Publishes a message on a request topic.
   * @param {*} object the expressify payload to publish.
   */
  publish(object) {
    let p_ = Promise.resolve();
    const destination = object.type === 'event' ?
      getEventTopic(this.opts.topic, object.resource) :
      getTopic(this.opts.topic, object);
    if (object.type === 'request') {
      // In the context of a `request` message, we would like to
      // additionally subscribe to the associated response channel.
      const source = getTopic(this.opts.topic, object, 'response');
      p_ = p_.then(() => this.subscribeAsync(source));
      this.cache.put(source, object, {
        callback: (key) => this.unsubscribeAsync(key)
      });
    }
    return (p_.then(() => this.publishAsync(destination, object)));
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
    console.log('unsubscribe', topic);
    // Removing the subscription if it exists.
    if (!unregister.call(this, topic)) {
      return res.send(404, { error: 'No such subscription' });
    }
    // Replying a succeeded operation.
    res.send({ topic });
  }

  /**
   * Called back on a `ping` request.
   * @param {*} req the expressify request.
   * @param {*} res the expressify response.
   */
  ping(req, res) {
    // Re-arming timers associated with the given resources.
    if (Array.isArray(req.payload.resources)) {
      req.payload.resources.forEach((r) => reArm.call(this, r));
    }
    // Replying a succeeded operation.
    res.send(200);
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