import { createHash } from 'node:crypto';
import { hostname, homedir, platform, arch } from 'node:os';
import { CliError } from './errors.js';

export const INSTALLATION_ID_HEADER = 'X-SandHive-Installation-Id';
export function fingerprintInstallation(identity) {
  // Use existing process/OS information only: no files, hardware probes or subprocesses.
  const digest = createHash('sha256').update(JSON.stringify([
    'sandhive-cli-installation-v1', identity.host, identity.home, identity.platform, identity.arch,
  ])).digest('hex');
  return `shf1_${digest}`;
}

export function getInstallationId() {
  return fingerprintInstallation({ host: hostname(), home: homedir(), platform: platform(), arch: arch() });
}

export function apiHeaders(installationId) {
  // Accept old UUIDs supplied through the programmatic client API too.
  if (typeof installationId !== 'string' || !/^(shf1_[a-f0-9]{64}|[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12})$/i.test(installationId)) {
    throw new CliError('INVALID_INPUT', 'Invalid installation identifier.');
  }
  return { 'Content-Type': 'application/json', Accept: 'application/json', [INSTALLATION_ID_HEADER]: installationId };
}
