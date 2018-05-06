const system = require('systeminformation');

/**
 * Processes module entry point.
 */
module.exports = {
  get: () => system.processes()
};