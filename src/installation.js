import { randomUUID } from 'node:crypto';
import { readFile, writeFile, mkdir, link, unlink } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { CliError } from './errors.js';

export const INSTALLATION_ID_HEADER = 'X-SandHive-Installation-Id';
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function validateInstallation(value) {
  if (value?.schema_version !== 1 || !uuidPattern.test(value.installation_id ?? '')) {
    throw new CliError('INSTALLATION_ERROR', 'Invalid installation identity. Check installation.json in SANDHIVE_HOME (default: ~/.sandhive). The existing file was not replaced.');
  }
  return value.installation_id;
}

export async function getInstallationId({ directory = process.env.SANDHIVE_HOME || join(homedir(), '.sandhive') } = {}) {
  const root = resolve(directory);
  const path = join(root, 'installation.json');
  let temporary;
  try {
    try { return validateInstallation(JSON.parse(await readFile(path, 'utf8'))); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }

    await mkdir(root, { recursive: true, mode: 0o700 });
    const identity = { schema_version: 1, installation_id: randomUUID() };
    temporary = join(root, `.installation-${randomUUID()}.tmp`);
    await writeFile(temporary, `${JSON.stringify(identity, null, 2)}\n`, { flag: 'wx', mode: 0o600 });
    // Publish the completed file atomically without replacing another process's ID.
    try { await link(temporary, path); }
    catch (error) { if (error.code !== 'EEXIST') throw error; }
    return validateInstallation(JSON.parse(await readFile(path, 'utf8')));
  } catch (error) {
    if (error instanceof CliError) throw error;
    throw new CliError('INSTALLATION_ERROR', 'Could not read or save the installation identity. Check installation.json and write permissions in SANDHIVE_HOME (default: ~/.sandhive). No API request was sent.');
  } finally {
    if (temporary) await unlink(temporary).catch(() => {});
  }
}

export function apiHeaders(installationId) {
  validateInstallation({ schema_version: 1, installation_id: installationId });
  return { 'Content-Type': 'application/json', Accept: 'application/json', [INSTALLATION_ID_HEADER]: installationId };
}
