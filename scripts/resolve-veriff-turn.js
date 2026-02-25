#!/usr/bin/env node
/**
 * Resolve Veriff TURN hostnames (turn1/turn2.falcon-*.veriff.me) via Google DNS
 * and output Chromium --host-resolver-rules MAP string.
 * Used by start-with-veriff-dns.js to fix -105 (ERR_NAME_NOT_RESOLVED).
 */
const dns = require('dns').promises;

const GOOGLE_DNS = ['8.8.8.8', '8.8.4.4'];
const FALCON_MAX = 20;

async function resolveOne(hostname) {
  try {
    const addresses = await dns.resolve4(hostname, { ttl: false });
    return addresses && addresses[0] ? addresses[0] : null;
  } catch {
    return null;
  }
}

async function main() {
  dns.setServers(GOOGLE_DNS);

  const rules = [];
  for (let n = 1; n <= FALCON_MAX; n++) {
    const h1 = `turn1.falcon-${n}.veriff.me`;
    const h2 = `turn2.falcon-${n}.veriff.me`;
    const [ip1, ip2] = await Promise.all([resolveOne(h1), resolveOne(h2)]);
    if (ip1) rules.push(`MAP ${h1} ${ip1}`);
    if (ip2) rules.push(`MAP ${h2} ${ip2}`);
  }

  const out = rules.join(', ');
  if (out) {
    process.stdout.write(out);
  }
}

main().catch(() => process.exit(1));
