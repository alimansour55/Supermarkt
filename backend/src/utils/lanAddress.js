import os from 'os';

export const getLanAddresses = () => {
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
};

export const formatLanUrls = (port, { protocol = 'http', path = '' } = {}) => {
  const suffix = path ? (path.startsWith('/') ? path : `/${path}`) : '';
  return getLanAddresses().map((ip) => `${protocol}://${ip}:${port}${suffix}`);
};

export const logMobileAccessHints = ({ frontendPort = 5173, apiPort } = {}) => {
  const frontendUrls = formatLanUrls(frontendPort);
  const apiUrls = apiPort ? formatLanUrls(apiPort, { path: '/api/health' }) : [];

  console.log('\n--- Mobile / same Wi‑Fi ---');
  if (frontendUrls.length) {
    console.log('Open the store on your phone:');
    frontendUrls.forEach((url) => console.log(`  → ${url}`));
  } else {
    console.log('Could not detect a LAN IP. Run: ipconfig');
    console.log(`Then open: http://<your-ipv4>:${frontendPort}`);
  }
  console.log('(Use the link above — not localhost, not the API port alone.)');
  if (apiUrls.length) {
    console.log('API health (optional check):');
    apiUrls.forEach((url) => console.log(`  → ${url}`));
  }
  console.log('----------------------------\n');
};
