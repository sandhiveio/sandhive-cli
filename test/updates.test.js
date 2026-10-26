import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { checkForUpdates, shouldCheckForUpdates } from '../src/updates.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const commit = 'a'.repeat(40);
const gitImpl = async () => ({ stdout: `${root}\n${commit}\n` });

test('local setup and previews never opt into background update requests', () => {
  const interactive = { stdoutIsTTY: true, stderrIsTTY: true };
  for (const args of [[], ['--help'], ['--version'], ['init', '--product', 'Test'],
    ['skill', 'install', '--agent', 'codex', '--target', '.'], ['review'], ['auth'], ['usage'],
    ['find', '--dry-run'], ['style', '--json'], ['draft', 'post', '--dry-run'],
    ['draft', 'reply', '--help'], ['unknown']]) {
    assert.equal(shouldCheckForUpdates(args, interactive), false, args.join(' '));
  }
  for (const args of [['find'], ['style'], ['draft', 'post'], ['draft', 'reply']]) {
    assert.equal(shouldCheckForUpdates(args, interactive), true);
    assert.equal(shouldCheckForUpdates(args, { ...interactive, disabled: '1' }), false);
    assert.equal(shouldCheckForUpdates(args, { ...interactive, stdoutIsTTY: false }), false);
    assert.equal(shouldCheckForUpdates(args, { ...interactive, stderrIsTTY: false }), false);
    assert.equal(shouldCheckForUpdates([...args, '--json'], interactive), false);
    assert.equal(shouldCheckForUpdates([...args, '--dry-run'], interactive), false);
  }
});

test('update checker reports newer commits without modifying the checkout', async () => {
  for (const status of ['ahead', 'diverged', 'identical', 'behind']) {
    const result = await checkForUpdates({ gitImpl, fetchImpl: async (url, options) => {
      assert.equal(url, `https://api.github.com/repos/sandhiveio/sandhive-cli/compare/${commit}...main`);
      assert.equal(options.method, undefined);
      return new Response(JSON.stringify({ status }));
    } });
    assert.equal(Boolean(result), ['ahead', 'diverged'].includes(status));
  }
});

test('update-check failures and unrelated parent repositories are ignored', async () => {
  assert.equal(await checkForUpdates({ gitImpl, fetchImpl: async () => { throw new Error('Offline'); } }), null);
  assert.equal(await checkForUpdates({ gitImpl, fetchImpl: async () => new Response('{}', { status: 403 }) }), null);
  assert.equal(await checkForUpdates({ gitImpl: async () => ({ stdout: `/unrelated\n${commit}\n` }), fetchImpl: async () => { assert.fail('No network for another repository'); } }), null);
});
