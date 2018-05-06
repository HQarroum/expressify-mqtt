const program = require('commander');
const Expressify = require('expressify');
const MqttStrategy = require('expressify-mqtt');
const iot = require('aws-iot-device-sdk');
const opts = require('../common/config');
const dump = require('./lib/dump');

/**
 * Application command-line interface.
 */
program
  .version('1.0.0')
  .option('-l, --live', 'Whether to observe remote resources and refresh them in live')
  .parse(process.argv);

/**
 * Resources monitored by this client. Caches the
 * values associated with responses associated with
 * each resources.
 */
const resources = {
  '/system/cpu': {},
  '/system/memory': {},
  '/system/os': {},
  '/system/network': {},
  '/system/processes': {},
  '/system/storage': {}
};

/**
 * Connection state.
 */
let connected = false;

/**
 * Initiating the MQTT connection.
 */
const mqtt = iot.device(opts);

/**
 * Creating the Expressify client.
 */
const client = new Expressify.Client({
  strategy: new MqttStrategy({
    mqtt: mqtt,
    topic: 'system'
  })
});

/**
 * Called back when an event associated with a 
 * given resource has been received from a server.
 * @param {*} e the received event.
 */
const onEvent = (e) => {
  resources[e.resource] = e.payload;
  console.log('\033[2J');
  refresh();
};

/**
 * Refreshes the screen with gathered information on
 * the remote host.
 */
const refresh = () => Object.keys(resources).forEach((k) => dump[k.split('/')[2]](resources[k]));

/**
 * Issues 3 different requests against the remote expressify
 * server :
 *  - Requests the CPU information of the host.
 *  - Requests the OS information of the host.
 *  - Requests the network information of the host.
 *  - Requests the processes information of the host.
 *  - Requests the storage information of the host.
 * @return a promise resolved when the requests have been executed, and
 * their associated responses have been received.
 */
const sendRequests = () => {

  /**
   * Requesting system information from the host associated
   * with the declared `resources`.
   */
  return Promise.all(
    Object.keys(resources).map((r) => client.get(r).then((res) => {
      const o = {};
      o[r] = res;
      return (o);
    })
  ))

  /**
   * Dumping gathered CPU information from the host.
   */
  .then((res) => {
    res.forEach((o) => {
      const key = Object.keys(o)[0];
      resources[key] = o[key].payload;
    });
    refresh();
  })
  
  /**
   * Handling query errors.
   */
  .catch((err) => {
    console.log(`[!] ${err}`);
    process.exit(-1);
  });
};

/**
 * Listening for a connection event.
 */
mqtt.on('connect', () => {
  connected = true;
  console.log(`[+] Connected to AWS IoT, sending requests ...`);
  // Issuing the requests against the remote expressify server.
  sendRequests().then(() => {
    if (program.live) {
      // Subscribing to events.
      return Object.keys(resources).forEach((k) => client.subscribe(k, onEvent));
    }
    console.log('[+] Closing the MQTT connection ...');
    mqtt.end();
  }).catch(console.error);
});

/**
 * Listening for error events.
 */
mqtt.on('error', (err) => console.log(`[!] Caught MQTT error ${err}`));

/**
 * Unsubscribing from current subscriptions, and closing the
 * MQTT connection when leaving the application.
 */
process.on('SIGINT', () => {
  console.log('[+] Closing the MQTT connection and unsubscribing from resources ...');

  Promise.all(
    Object.keys(resources).map((k) => client.unsubscribe(k, onEvent))
  )
  
  /**
   * Unsubscription is done, closing the connection.
   */
  .then((res) => mqtt.end(false, process.exit))

  /**
   * In case of an error, we also close the connection.
   */
  .catch(() => mqtt.end(false, process.exit));
  !connected && process.exit(0);
  connected = false;
});