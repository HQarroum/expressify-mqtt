const system = require('systeminformation');

/**
 * Memory module entry point.
 */
module.exports = {
  get: () => system.mem()
};