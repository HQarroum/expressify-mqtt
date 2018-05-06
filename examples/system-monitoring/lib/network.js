const system = require('systeminformation');

/**
 * Asynchronously returns a list of the network interfaces.
 */
const getInterfaces = () => new Promise((resolve, reject) => {
  system.networkInterfaces((list) => {
    system.networkInterfaceDefault((name) => {
      system.networkStats((stats) => {
        list.forEach((iface) => {
          // Setting the default network interface.
          iface.default = iface.iface === name;
          // Setting the network interface statistics.
          iface.stats = iface.iface === stats.iface ? stats : null;
        });
        resolve(list);
      });
    });
  });
});

/**
 * Network module entry point.
 */
module.exports = {
  get: () => Promise.all([ getInterfaces(), system.networkConnections() ]).then((results) => ({
      interfaces: results[0],
      connections: results[1]
    })
  )
};