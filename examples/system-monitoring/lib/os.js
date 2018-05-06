const system = require('systeminformation');

/**
 * Asynchronously returns the host operating system
 * information.
 */
const getInformation = () => new Promise((resolve, reject) => {
  system.osInfo((os) => {
    system.versions((versions) => {
      resolve({ os, versions });
    })
  });
});

/**
 * Asynchronously returns information about the time
 * of the current host.
 */
const getTime = () => new Promise((resolve, reject) => {
  resolve(system.time());
});

/**
 * OS module entry point.
 */
module.exports = {
  get: () => Promise.all([ getInformation(), system.users(), system.system(), getTime() ]).then((results) => ({
      information: results[0],
      users: results[1],
      hw: results[2],
      time: results[3]
    })
  )
};