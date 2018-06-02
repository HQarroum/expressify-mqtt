const Expressify = require('expressify-js');
const MqttStrategy = require('../../');
const mqtt = require('aws-iot-device-sdk');
const opts = require('../common/config');
const system = require('./lib');

/**
 * Notification interval handles.
 */
let intervals = [];

/**
 * Connection state.
 */
let connected = false;

/**
 * The domains we are notifying the client about.
 */
const domains = [
  'processes',
  'cpu',
  'storage',
  'os',
  'memory',
  'network'
];

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
    topic: 'system'
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
 * Retrieves and returns informations about running
 * processes on the host, along with load information.
 */
server.get('/system/processes', (req, res) => {
  system.processes.get().then((r) => res.send(r));
});

/**
 * Retrieves and returns information about the avaialable CPUs,
 * as well as load information.
 */
server.get('/system/cpu', (req, res) => {
  system.cpu.get().then((r) => res.send(r));
});

/**
 * Retrieves and returns information abut the storage
 * devices available on the host.
 */
server.get('/system/storage', (req, res) => {
  system.storage.get().then((r) => res.send(r));
});

/**
 * Retrieves and returns general information about
 * the host operating system.
 */
server.get('/system/os', (req, res) => {
  system.os.get().then((r) => res.send(r));
});

/**
 * Retrieves and returns information about the host
 * memory (usage, load, free memory).
 */
server.get('/system/memory', (req, res) => {
  system.memory.get().then((r) => res.send(r));
});

/**
 * Retrieves and returns information on the network
 * interfaces available on the host.
 */
server.get('/system/network', (req, res) => {
  system.network.get().then((r) => res.send(r));
});

/**
 * Listening for a connection event.
 */
mqttClient.on('connect', () => {
  console.log(`[+] Successfully connected to AWS IoT !`);
  connected = true;
  // Listening for incoming requests.
  server.listen().then(() => {
    console.log(`[+] The server is listening for incoming requests on mount point '${server.strategy.opts.topic}' !`);
  });
  // Creating the interval loop notifying clients of
  // changes in the local system model.
  intervals = domains.map((d) => setInterval(() => {
    system[d].get().then((r) => server.publish(`/system/${d}`, r));
  }, 5 * 1000));
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
  // Clears all created intervals.
  intervals.forEach((i) => clearInterval(i));
  // Closing the connection.
  server.close().then(() => connected ? mqttClient.end(false, process.exit) : process.exit(0));
  // Marking the connection as closed.
  connected = false;
});
