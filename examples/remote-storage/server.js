const Expressify = require('../../../expressify');
const MqttStrategy = require('../../');
const mqtt = require('aws-iot-device-sdk');
const opts = require('../common/config');

/**
 * Connection state.
 */
let connected = false;

/**
 * The memory store.
 */
const store = {};

/**
 * Initiating the MQTT connection.
 */
const mqttClient = mqtt.device(opts);

/**
 * Creating the Expressify server.
 */
const server = new Expressify.Server({
  strategy: new MqttStrategy({
    mqtt: mqttClient,
    topic: 'expressify'
  })
});

/**
 * Request logging middleware.
 */
server.use((req, res, next) => {
  console.log(`[*] Got a '${req.method}' request on '${req.resource}' with payload '${JSON.stringify(req.payload)}'`);
  next();
});

/**
 * Reads an object from the store.
 */
server.get('/store/:key', (req, res) => {
  const object = store[req.params.key];
  res.send(object ? 200 : 404, object || 'Not found');
});

/**
 * Writes an object to the store.
 */
server.post('/store/:key', (req, res) => {
  if (!req.params.key || !req.payload) {
    return (res.send(400));
  }
  store[req.params.key] = req.payload;
  res.send(200);
});

/**
 * Listening for a connection event.
 */
mqttClient.on('connect', () => {
  connected = true;
  console.log(`[+] Successfully connected to AWS IoT !`);
  // Listening for incoming requests.
  server.listen().then(() => {
    console.log(`[+] The server is listening for incoming requests on mount point '${server.strategy.opts.topic}' !`);
  });
});

/**
 * Listening for error events.
 */
mqttClient.on('error', (err) => console.log(`[!] Caught MQTT error ${err}`));

/**
 * Closing the MQTT connection when leaving the application.
 */
process.on('SIGINT', () => {
  console.log('[+] Closing the MQTT connection ...');
  server.close().then(() => connected ? mqttClient.end(false, process.exit) : process.exit(0));
  connected = false;
});