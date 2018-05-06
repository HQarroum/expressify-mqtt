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

 - Natively supports the [MQTT.js](https://github.com/mqttjs/MQTT.js/) and the [AWS IoT SDK](https://github.com/aws/aws-iot-device-sdk-js).
 - Usage of an MQTT query-response pattern to optimize message exchanges and costs.
 - Supports observation of resources using dedicated MQTT topics.
 - Supports Node.js and the Browser (MQTT-over-Websockets).
 - Automatically detects disconnected observers to stop emitting resource updates.

## Usage



## See also

 - The [Expressify](https://github.com/HQarroum/expressify) framework.
 - The [expressify-pm](https://github.com/HQarroum/expressify-pm) strategy supporting [`.postMessage`](https://developer.mozilla.org/fr/docs/Web/API/Window/postMessage).
