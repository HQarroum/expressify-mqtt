const prettyBytes = require('pretty-bytes');
const moment      = require('moment');
const chalk       = require('chalk');

/**
 * Converts the given number of seconds to a day, hours, minutes
 * and seconds textual representation.
 * @param {} seconds the number of seconds to convert.
 */
const secondstoTime = (seconds) => {
  const days = Math.floor(seconds / (24*60*60));
      seconds -= days * (24*60*60);
  const hours = Math.floor(seconds / (60*60));
      seconds -= hours * (60*60);
  const minutes = Math.floor(seconds / (60));
      seconds -= minutes * (60);
  return ((0<days)  ?(days + " day(s), ") : "") + hours + "h, " + minutes + "m and " + seconds + "s";
};

module.exports = {
  
  /**
   * Dumps processes information to the standard output.
   */
  processes: (processes) => {
    console.log(chalk.underline.red.bold('\nProcesses Information'));
    console.log(` - ${chalk.bold(processes.all)} processes are currently executed by the host.`);
    console.log(` - ${chalk.bold(processes.running)} are currently running processes on the host.`);
    console.log(` - ${chalk.bold(processes.sleeping)} are currently sleeping processes on the host.`);
  },

  /**
   * Dumps CPU information to the standard output.
   */
  cpu: (cpu) => {
    console.log(chalk.underline.cyan.bold('\nCPU Information'));
    console.log(` - Average system load is ${chalk.bold(cpu.load.avgload)}.`);
    console.log(` - There are ${chalk.bold(cpu.load.cpus.length)} CPUs available on the host.`);
    console.log(` - ${chalk.bold(cpu.information.manufacturer)} ${chalk.bold(cpu.information.brand)} from ${chalk.bold(cpu.information.vendor)} cadenced at a frequency of ${chalk.bold(cpu.information.speed + 'Ghz')}.`);
    console.log(` - CPU temperature is ${chalk.bold(cpu.temperature.main)} degrees celsius.`);
  },

  /**
   * Dumps memory information to the standard output.
   */
  memory: (memory) => {
    console.log(chalk.underline.magenta.bold('\nMemory Information'));
    console.log(` - ${chalk.bold(prettyBytes(memory.total))} total memory available, (${chalk.bold(prettyBytes(memory.free))} free, ${chalk.bold(prettyBytes(memory.used))} used, ${chalk.bold(prettyBytes(memory.active))} active).`);
    console.log(` - ${chalk.bold(prettyBytes(memory.swaptotal))} total swap available, (${chalk.bold(prettyBytes(memory.swapfree))} free, ${chalk.bold(prettyBytes(memory.swapused))} used).`);
  },

  /**
   * Dumps network information to the standard output.
   */
  network: (network) => {
    console.log(chalk.underline.yellow.bold('\nNetwork Interfaces'));
    network.interfaces.forEach((iface) => {
      console.log(` ${chalk.bold(iface.iface)}${iface.default ? chalk.bold(' (Default)') : ''}`);
      iface.ip4 && console.log(`  - IPv4 (${iface.ip4}).`);
      iface.ip6 && console.log(`  - IPv6 (${iface.ip6}).`);
      iface.mac && console.log(`  - MAC (${iface.mac}).`);
      iface.stats && console.log(`  - RX (${prettyBytes(iface.stats.rx_sec)}/second), TX (${prettyBytes(iface.stats.tx_sec)}/second).`);
    });
  },

  /**
   * Dumps storage information to the standard output.
   */
  storage: (storage) => {
    console.log(chalk.underline.blue.bold('\nStorage Information'));
    console.log(` -> Available file systems :`);
    for (let i = 0; i < storage.filesystems.length; ++i) {
      console.log(`   - ${chalk.bold(storage.filesystems[i].fs)} mounted on ${chalk.bold(storage.filesystems[i].mount)} using a ${chalk.bold(storage.filesystems[i].type)} filesystem (${chalk.bold(prettyBytes(storage.filesystems[i].size))}, ${chalk.bold(storage.filesystems[i].use)} % currently in use).`);
    }
    console.log(` -> Available block devices :`);
    for (let i = 0; i < storage.devices.length; ++i) {
      console.log(`   - ${chalk.bold(storage.devices[i].name)} (${storage.devices[i].physical}) - ${chalk.bold(storage.devices[i].model || 'Unknown')} - ${chalk.bold(storage.devices[i].protocol)}.`);
    }
    console.log(` -> Throughput :`);
    console.log(`   - ${Math.round(storage.ios.rIO_sec)} reads/second.`);
    console.log(`   - ${Math.round(storage.ios.wIO_sec)} writes/second.`);
  },

  /**
   * Dumps OS information to the standard output.
   */
  os: (os) => {
    console.log(chalk.underline.green.bold('\nOS & HW Information'));
    console.log(` - ${os.hw.manufacturer} ${chalk.bold(os.hw.model)} (${os.hw.serial}).`);
    console.log(` - Host OS is a ${chalk.bold(os.information.os.distro)} (${os.information.os.release}) on a ${os.information.os.platform} platform (${chalk.bold(os.information.os.arch)}).`);
    console.log(` - Hostname - ${chalk.bold(os.information.os.hostname)}.`);
    console.log(` - Kernel version is ${chalk.bold(os.information.versions.kernel)}, with a ${chalk.bold(os.information.versions.openssl)} OpenSSL version, and a ${chalk.bold(os.information.versions.node)} node version.`);
    console.log(` - Host time - ${chalk.bold(moment(os.time.current))} in the ${chalk.bold(os.time.timezoneName)} timezone.`);
    console.log(` - Uptime - ${chalk.bold(secondstoTime(os.time.uptime))}.`);
  }
}