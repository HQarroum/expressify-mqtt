const system = require('systeminformation');

/**
 * Storage module entry point.
 */
module.exports = {
  get: () => Promise.all([ system.fsSize(), system.blockDevices(), system.disksIO() ]).then((results) => ({
      filesystems: results[0],
      devices: results[1],
      ios: results[2]
    })
  )
};