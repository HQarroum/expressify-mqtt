<p align="center">
  <img src="assets/logo.png" />
</p>

# expressify-mqtt
> An Expressify strategy enabling RESTful application over an MQTT(S) transport.

[![Build Status](https://travis-ci.org/HQarroum/expressify-mqtt.svg?branch=master)](https://travis-ci.org/HQarroum/expressify-mqtt)
[![Code Climate](https://codeclimate.com/github/HQarroum/expressify-mqtt/badges/gpa.svg)](https://codeclimate.com/github/HQarroum/expressify-mqtt)

Current version: **1.0.0**

Lead Maintainer: [Halim Qarroum](mailto:hqm.post@gmail.com)

## Table of contents

- [Installation](#installation)
- [Features](#features)
- [Usage](#usage)
- [See also](#see-also)

## Install

```bash
npm install --save expressify-mqtt
```

## Features

 - Natively supports the [MQTT.js](https://github.com/mqttjs/MQTT.js/) and the [AWS IoT SDK](https://github.com/aws/aws-iot-device-sdk-js) librairies.
 - Usage of an MQTT query-response pattern to optimize message exchanges and costs.
 - Supports observation of resources using dedicated MQTT topics.
 - Supports Node.js and the Browser (MQTT-over-Websockets).
 - Automatically detects disconnected observers to stop emitting resource updates.

## Usage

In order to use `expressify-mqtt`, you need to create an instance of the strategy using a backend such as [MQTT.js](https://github.com/mqttjs/MQTT.js/) or the [AWS IoT SDK](https://github.com/aws/aws-iot-device-sdk-js). The strategy requires that the MQTT backend follows the same interface as [MQTT.js](https://github.com/mqttjs/MQTT.js/).

### Creating a client

When initializing the `expressify-mqtt` strategy, you need to pass it a supported MQTT back-end, as well as a *topic mountpoint* indicating the base topic which the strategy will use to create its topic architecture.

```js
const mqtt = require('mqtt');

const client = new Expressify.Client({
  strategy: new MqttStrategy({
    mqtt: mqtt,
    topic: 'foo'
  })
});
```

> Note that given the used MQTT service, there might be limitations on the number of forward slashes you can use.

### Creating a server

```js
const server = new Expressify.Server({
  strategy: new MqttStrategy({
    mqtt: mqttClient,
    topic: 'system'
  })
});

// Listening for incoming requests.
server.listen().then(() => {
  console.log(`[+] The server is listening for incoming requests on mount point '${server.strategy.opts.topic}' !`);
});
```

## See also

 - The [Expressify](https://github.com/HQarroum/expressify) framework.
 - The [expressify-pm](https://github.com/HQarroum/expressify-pm) strategy supporting [`.postMessage`](https://developer.mozilla.org/fr/docs/Web/API/Window/postMessage).
