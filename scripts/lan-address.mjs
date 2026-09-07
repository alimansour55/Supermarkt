import os from 'os';

/**
 * Non-loopback IPv4 addresses (Wi‑Fi / Ethernet) for same-network device access.
 */
export function getLanAddresses() {
  const nets = os.networkInterfaces();
  const addresses = [];

  for (const interfaces of Object.values(nets)) {
    for (const net of interfaces ?? []) {
      const isIPv4 = net.family === 'IPv4' || net.family === 4;
      if (isIPv4 && !net.internal) {
        addresses.push(net.address);
      }
    }
  }

  return [...new Set(addresses)];
}

export function formatLanUrls(port, { protocol = 'http', path = '' } = {}) {
  const suffix = path ? (path.startsWith('/') ? path : `/${path}`) : '';
  return getLanAddresses().map((ip) => `${protocol}://${ip}:${port}${suffix}`);
}
