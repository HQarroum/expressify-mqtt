const Expressify = require('../../../expressify');
const MqttStrategy = require('../../');
const iot = require('aws-iot-device-sdk');
const opts = require('../common/config');

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
    topic: 'expressify'
  })
});

/**
 * Issues 3 different requests against the remote expressify
 * server :
 *  - Requests the description of the exposed resources by the server.
 *  - Stores an object at a given key on the remote server.
 *  - Reads the previously stored payload from the server.
 * @return a promise resolved when the requests have been executed, and
 * their associated responses have been received.
 */
const sendRequests = () => {

  /**
   * Requesting the description of resources exposed
   * by the remote server.
   */
  return client.describe().then((res) => console.log(`[+] ${JSON.stringify(res.payload)}`))
    
    /**
     * Writing a payload on the `/store/foo` resource.
     */
    .then((res) => client.post('/store/foo', { data: { foo: 'bar' }}))

    /**
     * Reading the payload written on the `/store/foo` resource.
     */
    .then((res) => client.get('/store/foo'))

    /**
     * Displaying the read payload.
     */
    .then((res) => console.log(`[+] Successfully wrote ${JSON.stringify(res.payload)} on the server`));
};

/**
 * Listening for a connection event.
 */
mqtt.on('connect', () => {
  connected = true;
  console.log(`[+] Connected to AWS IoT, sending requests ...`);
  // Issuing the requests against the remote expressify server.
  sendRequests().then(() => {
    console.log('[+] Received 3/3 responses from the server !');
    mqtt.end();
  }).catch(console.error);
});

/**
 * Listening for error events.
 */
mqtt.on('error', (err) => console.log(`[!] Caught MQTT error ${err}`));

/**
 * Closing the MQTT connection when leaving the application.
 */
process.on('SIGINT', () => {
  console.log('[+] Closing the MQTT connection ...');
  connected ? mqtt.end(false, process.exit) : process.exit(0);
  connected = false;
});