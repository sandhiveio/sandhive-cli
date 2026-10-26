import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, readFile, writeFile, mkdir, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getInstallationId, INSTALLATION_ID_HEADER } from '../src/installation.js';
import { postJson } from '../src/request.js';
import { checkForUpdates } from '../src/updates.js';
import { main } from '../src/cli.js';

const exec = promisify(execFile);
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function withStore(check) {
  const root = await mkdtemp(join(tmpdir(), 'sandhive-installation-test-'));
  try { await check(root); }
  finally {
    assert.ok(root.startsWith(join(tmpdir(), 'sandhive-installation-test-')));
    await rm(root, { recursive: true, force: true });
  }
}

test('installation ID persists, differs between stores, and is initialized by the first help invocation', async () => {
  await withStore(async root => {
    const directory = join(root, 'config');
    const env = { ...process.env, SANDHIVE_HOME: directory };
    const binary = fileURLToPath(new URL('../bin/sandhive.js', import.meta.url));
    const first = await exec(process.execPath, [binary, '--help', '--json'], { cwd: root, env, windowsHide: true });
    assert.equal(JSON.parse(first.stdout).status, 'ok');
    const stored = JSON.parse(await readFile(join(directory, 'installation.json'), 'utf8'));
    assert.match(stored.installation_id, uuidPattern);
    assert.deepEqual(Object.keys(stored).sort(), ['installation_id', 'schema_version']);
    const project = join(root, 'another-project');
    await mkdir(project);
    await exec(process.execPath, [binary, '--version', '--json'], { cwd: project, env, windowsHide: true });
    assert.equal(await getInstallationId({ directory }), stored.installation_id);
    assert.notEqual(await getInstallationId({ directory: join(root, 'separate-installation') }), stored.installation_id);
  });
});

test('simultaneous first launches in separate processes use one complete identity', async () => {
  await withStore(async root => {
    const directory = join(root, 'config');
    const module = new URL('../src/installation.js', import.meta.url).href;
    const script = `import { getInstallationId } from ${JSON.stringify(module)}; process.stdout.write(await getInstallationId());`;
    const results = await Promise.all(Array.from({ length: 8 }, () => exec(process.execPath,
      ['--input-type=module', '-e', script], { env: { ...process.env, SANDHIVE_HOME: directory }, windowsHide: true })));
    const ids = results.map(result => result.stdout);
    assert.match(ids[0], uuidPattern);
    assert.equal(new Set(ids).size, 1);
    assert.equal(await getInstallationId({ directory }), ids[0]);
    assert.deepEqual(await readdir(directory), ['installation.json']);
  });
});

test('corrupt or unsupported installation data is not silently replaced', async () => {
  await withStore(async directory => {
    const path = join(directory, 'installation.json');
    for (const content of ['{', '{}', '{"schema_version":1,"installation_id":"bad"}',
      '{"schema_version":2,"installation_id":"3d96ba71-ae43-4eb4-891d-75328c999283"}']) {
      await writeFile(path, content);
      await assert.rejects(getInstallationId({ directory }), error => error.code === 'INSTALLATION_ERROR');
      assert.equal(await readFile(path, 'utf8'), content);
    }
  });
});

test('an inaccessible identity store fails before the CLI can send a request', async () => {
  await withStore(async root => {
    const blocked = join(root, 'not-a-directory');
    await writeFile(blocked, 'existing file');
    const previous = process.env.SANDHIVE_HOME;
    process.env.SANDHIVE_HOME = blocked;
    try {
      let output = '';
      const status = await main(['style', '--account', 'builder', '--json'], {
        stdout: { write: value => { output += value; } }, stderr: { write: () => {} },
        fetchImpl: async () => { assert.fail('No request without a persisted identity'); },
      });
      assert.equal(status, 1);
      assert.equal(JSON.parse(output).error.code, 'INSTALLATION_ERROR');
      assert.equal(await readFile(blocked, 'utf8'), 'existing file');
    } finally {
      if (previous === undefined) delete process.env.SANDHIVE_HOME;
      else process.env.SANDHIVE_HOME = previous;
    }
  });
});

test('installation ID is not sent to other API origins or GitHub update checks', async () => {
  const installationId = '3d96ba71-ae43-4eb4-891d-75328c999283';
  await postJson('https://example.com/other-service', {}, { installationId, fetchImpl: async (url, options) => {
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
