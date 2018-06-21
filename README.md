<p align="center">
  <img src="assets/logo.png" />
</p>

# expressify-mqtt
> An Expressify strategy enabling RESTful application over an MQTT(S) transport.

[![CodeFactor](https://www.codefactor.io/repository/github/hqarroum/expressify-mqtt/badge)](https://www.codefactor.io/repository/github/hqarroum/expressify-mqtt)

Current version: **1.0.3**

Lead Maintainer: [Halim Qarroum](mailto:hqm.post@gmail.com)

## Table of contents

- [Installation](#install)
- [Features](#features)
- [Usage](#usage)
- [Examples](#examples)
- [See also](#see-also)

## Install

```bash
npm install --save expressify-mqtt
```

## Features

 - Natively supports the [MQTT.js](https://github.com/mqttjs/MQTT.js/) and the [AWS IoT SDK](https://github.com/aws/aws-iot-device-sdk-js) libraries.
 - Usage of an MQTT query-response pattern optimized for minimizing message exchanges and costs.
 - Supports observation of resources using dedicated MQTT topics.
 - Supports Node.js and the Browser (using MQTT-over-Websockets).
 - Automatically detects disconnected observers to stop emitting resource updates.

## Usage

In order to use `expressify-mqtt`, you need to create an instance of the strategy using a backend such as [MQTT.js](https://github.com/mqttjs/MQTT.js/) or the [AWS IoT SDK](https://github.com/aws/aws-iot-device-sdk-js). The strategy requires that the MQTT backend follows the same interface as [MQTT.js](https://github.com/mqttjs/MQTT.js/).

### Creating a client

When initializing the `expressify-mqtt` strategy, you need to pass it a supported MQTT `backend`, as well as a *topic mountpoint* indicating the base topic which the strategy will use to create its topic architecture.

```js
// Injecting the `mqtt.js` library.
const mqtt = require('mqtt');

// Creating the client instance.
const client = new Expressify.Client({
  strategy: new MqttStrategy({
    mqtt: backend,
    topic: 'my/topic'
  })
});
```

> Note that given the used MQTT service, there might be limitations on the number of forward slashes you can use. For example, on AWS IoT the maximum amount of forward slashes is 7 [as of today](https://docs.aws.amazon.com/general/latest/gr/aws_service_limits.html#iot-protocol-limits). Also, have a read on how the [query-response pattern](#query-response-pattern) over MQTT works in `expressify-mqtt` to understand the maximum number of forward slashes you can use on a topic mountpoint.

### Creating a server

The below example shows you how to create an instance of an Expressify server using the `mqtt` strategy. Similarly to [Creating a client](#creating-a-client), you need to pass to the strategy an MQTT `backend` and the MQTT topic mountpoint which must be the same as for the client.

```js
// Injecting the `mqtt.js` library.
const mqtt = require('mqtt');

// Creating the server instance.
const server = new Expressify.Server({
  strategy: new MqttStrategy({
    mqtt: backend,
    topic: 'my/topic'
  })
});

// Listening for incoming requests.
server.listen().then(() => {
  console.log(`[+] The server is listening on mount point '${server.strategy.opts.topic}' !`);
});
```

## Connecting the back-end

In order for an `expressify-mqtt` client or server to be able to start subscribing or publishing on MQTT topics using the `backend` instance, it should be configured and connected before using expressify. See the [examples](./examples) available in this repository to see more in details how to connect the back-ends before using either the client or the server.

### The configuration object

As you will see it in the [examples](./examples), The `MQTT.js` and the `AWS IoT SDK` requires a configuration object to be passed in order to specify the configuration properties (server, certificates, connection parameters, etc.) to use while connecting to an MQTT server.

An example of such a configuration object is available [here](./examples/common/config.json), replace the placeholders between diamonds with the correct values. The referenced certificate paths (`keyPath`, `certPath` and `caPath`) should be placed in the `common/certs` directory for the examples to properly work.

For more information on the values you can put in the `config.json` file, please read the associated documentation on the [AWS IoT SDK for Javascript](https://github.com/aws/aws-iot-device-sdk-js#awsiotdeviceoptions).

## Implementation details

In this section will be detailed implementation details about the inner workings of the `expressify-mqtt` module.

### Query-Response pattern

To enable a stateless query-response model over MQTT, this module is based on the establishment of a topic nomenclature which is optimized in terms performance and costs.

When issuing a request or a response, `expressify-mqtt` builds its query and response topics on top of the *topic mountpoint* documented in the previous sections and uses it as a mounting point for the rest of the topic schema.

#### Anatomy of a transaction

When an `expressify-mqtt` client queries a remote server, it will transmit the standard expressify query payload over the following topic :

```json
${"topic-mount-point"}/${"query-transaction-id"}/request
```

Where `topic-mount-point` is the topic mountpoint given by the user of the strategy when instantiating it,`query-transaction-id` is a UUID v4 generated per query, and `request` is a string literal indicating the type of the transaction.

Before sending this request, the expressify client will subscribe to the following topic (the same nomenclature as for the request is used for variable names) :

```json
${"topic-mount-point"}/${"query-transaction-id"}/response
```

When the server responds to the request, it will send it on the above MQTT topic using the same transaction identifier as for the request.

#### Anatomy of event notifications

Since Expressify offers the ability for clients to *observe* a remote resource on the server, and be notified whenever this resource has been modified, the `expressify-mqtt` strategy bases the event notification flow upon the following topic model.

When a client wishes to subscribe to a remote resource, it sends a request (as for a regular request) to the server indicating the resource it would like to subscribe to.

Once acknowledge by the server, subsequent updates and notifications associated with the observed resource will be sent by the server on the below topic.

```json
${"topic-mount-point"}/${"resource-name"}/events
```

## Message ordering

By default, the `expressify-topic` when publishing a message on an MQTT broker will do so using a `QoS` of 1 to avoid lost messages. This can be overriden by the user of the module when instanciating the strategy :

```js
// Using a `QoS` of `0`.
new MqttStrategy({
  mqtt: backend,
  topic: 'my/topic',
  mqttOpts: { qos: 0 }
})
```

Unless the used MQTT broker supports `QoS 2`, there is a chance that your messages will not arrive in the same order they have been sent initially by the client. Since some applications might require message ordering to be guaranteed, it is possible to activate this feature on `expressify-mqtt` for events, but not for query-responses since those are supposed to be stateless.

Below is an example of how to send events in an ordered manner from a server instance when notifying the client about a change on one of the resource it exposes.

```js
server.publish(`/my/resource`, { foo: 'bar' }, { ordered: true });
```

> A sequence number will be sent by the server on each `.publish()` to allow the client to re-order the messages. Note that the client will wait for a short period of time to receive an expected message after having received subsequent messages. Once the timeout has been reached, the message is considered lost, and `expressify-mqtt` will continue ordering subsequent messages to avoid the client to be trapped into a 'hanged' situation.

## Examples

Two functional examples involving the `expressify-mqtt` strategy are available in the [examples](./examples) directory :

 - [Remote storage](https://github.com/HQarroum/expressify-mqtt/tree/master/examples/remote-storage) - Demonstrates how to use `expressify-mqtt` to expose a REST interface on the server which can store in memory a set of key-value pairs, and on the client on how to query this service remotely over MQTT.
 - [System monitoring](https://github.com/HQarroum/expressify-mqtt/tree/master/examples/system-monitoring) - Shows you how to use `expressify-mqtt` to expose system metrics on the server and to display them to the user on the client.

## See also

 - The [Expressify](https://github.com/HQarroum/expressify) framework.
 - The [expressify-ipc](https://github.com/HQarroum/expressify-ipc) strategy supporting local sockets.
 - The [expressify-pm](https://github.com/HQarroum/expressify-pm) strategy supporting [`.postMessage`](https://developer.mozilla.org/fr/docs/Web/API/Window/postMessage).
