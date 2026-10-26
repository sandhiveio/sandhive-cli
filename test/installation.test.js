import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, writeFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fingerprintInstallation, getInstallationId, apiHeaders, INSTALLATION_ID_HEADER } from '../src/installation.js';
import { postJson } from '../src/request.js';
import { checkForUpdates } from '../src/updates.js';

const exec = promisify(execFile);

test('fingerprint is stable across projects and changes with machine/profile inputs without exposing them', () => {
  const identity = { host: 'private-host', home: '/private/user', platform: 'linux', arch: 'x64' };
  const first = fingerprintInstallation(identity);
  assert.match(first, /^shf1_[a-f0-9]{64}$/);
  assert.equal(fingerprintInstallation({ ...identity }), first);
  for (const key of Object.keys(identity)) assert.notEqual(fingerprintInstallation({ ...identity, [key]: 'different' }), first);
  assert.equal(first.includes(identity.host), false);
  assert.equal(first.includes(identity.home), false);
  assert.equal(getInstallationId(), getInstallationId());
  assert.equal(apiHeaders(first)[INSTALLATION_ID_HEADER], first);
  assert.throws(() => apiHeaders('bad\r\nheader'), error => error.code === 'INVALID_INPUT');
});

test('help and diagnostics work with an unusable old identity store and write no files', async () => {
  const root = await mkdtemp(join(tmpdir(), 'sandhive-fingerprint-test-'));
  try {
    const blocked = join(root, 'not-a-directory');
    await writeFile(blocked, 'not a directory');
    const env = { ...process.env, SANDHIVE_HOME: blocked };
    const binary = fileURLToPath(new URL('../bin/sandhive.js', import.meta.url));
    for (const command of [['--help', '--json'], ['--version', '--json'], ['doctor', '--json']]) {
      const output = await exec(process.execPath, [binary, ...command], { cwd: root, env, windowsHide: true });
      assert.ok(JSON.parse(output.stdout));
    }
    assert.deepEqual(await readdir(root), ['not-a-directory']);
    const module = new URL('../src/installation.js', import.meta.url).href;
    const script = `import { getInstallationId } from ${JSON.stringify(module)}; process.stdout.write(getInstallationId());`;
    const results = await Promise.all(Array.from({ length: 4 }, () => exec(process.execPath,
      ['--input-type=module', '-e', script], { cwd: root, env, windowsHide: true })));
    assert.equal(new Set(results.map(result => result.stdout)).size, 1);
  } finally {
    assert.ok(root.startsWith(join(tmpdir(), 'sandhive-fingerprint-test-')));
    await rm(root, { recursive: true, force: true });
  }
});

test('fingerprint is not sent to other API origins or GitHub update checks', async () => {
  await postJson('https://example.com/other-service', {}, { installationId: getInstallationId(), fetchImpl: async (url, options) => {
    assert.equal(options.headers[INSTALLATION_ID_HEADER], undefined);
    return new Response('{}');
  } });
  const root = fileURLToPath(new URL('../', import.meta.url));
  await checkForUpdates({ gitImpl: async () => ({ stdout: `${root}\n${'a'.repeat(40)}\n` }),
    fetchImpl: async (url, options) => {
      assert.equal(new URL(url).hostname, 'api.github.com');
      assert.equal(options.headers[INSTALLATION_ID_HEADER], undefined);
      return new Response('{"status":"identical"}');
    } });
});
