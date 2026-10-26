import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { main } from '../src/cli.js';
import { generateReply, postJson, GENERATE_REPLY_URL } from '../src/request.js';
import { generateReplyBatch } from '../src/batch.js';
import { searchTweets } from '../src/twitter.js';

const samples = ['First original', 'Second original', 'Third original'].map(text => ({ text, source: 'test original', authorship: 'human' }));
const context = { schema_version: 1, product: 'Feedback organizer', audience: 'Founders', facts: ['Groups feedback'], voice: 'Concise', account: 'builder' };
const exec = promisify(execFile);
async function run(args, { cwd, input = {}, fetchImpl = async () => { assert.fail('Unexpected network'); } } = {}) {
  let out = '', err = '';
  const exit = await main([...args, '--json'], { cwd, fetchImpl, stdin: Readable.from([JSON.stringify(input)]),
    stdout: { write: s => { out += s; } }, stderr: { write: s => { err += s; } } });
  return { exit, result: JSON.parse(out), err };
}
async function withProject(check) {
  const cwd = await mkdtemp(join(tmpdir(), 'sandhive-workflow-test-'));
  try {
    await mkdir(join(cwd, '.sandhive'));
    await writeFile(join(cwd, '.sandhive', 'context.json'), JSON.stringify(context));
    await writeFile(join(cwd, '.sandhive', 'style.json'), JSON.stringify(samples));
    await check(cwd);
  } finally {
    assert.ok(cwd.startsWith(join(tmpdir(), 'sandhive-workflow-test-')));
    await rm(cwd, { recursive: true, force: true });
  }
}

test('one CLI executable creates and loads independent profiles in the agent project working directories', async () => {
  const root = await mkdtemp(join(tmpdir(), 'sandhive-project-location-test-'));
  const binary = fileURLToPath(new URL('../bin/sandhive.js', import.meta.url));
  try {
    for (const project of ['first-project', 'second-project']) {
      const cwd = join(root, project);
      await mkdir(cwd);
      const created = await exec(process.execPath, [binary, 'init', '--product', project, '--audience', 'Founders',
        '--account', 'builder', '--json'], { cwd, windowsHide: true });
      assert.equal(JSON.parse(created.stdout).path, join(cwd, '.sandhive', 'context.json'));
      await writeFile(join(cwd, '.sandhive', 'style.json'), JSON.stringify(samples));
      const preview = await exec(process.execPath, [binary, 'draft', 'reply', '--text', 'A real question', '--dry-run', '--json'],
        { cwd, windowsHide: true });
      const result = JSON.parse(preview.stdout);
      assert.equal(result.profile.context, join(cwd, '.sandhive', 'context.json'));
      assert.equal(result.profile.style, join(cwd, '.sandhive', 'style.json'));
      assert.ok(result.payload.externalRelies.some(text => text.includes(`Product: ${project}.`)));
      assert.ok(!result.payload.externalRelies.some(text => text.includes(project === 'first-project' ? 'second-project' : 'first-project')));
    }
  } finally {
    assert.ok(root.startsWith(join(tmpdir(), 'sandhive-project-location-test-')));
    await rm(root, { recursive: true, force: true });
  }
});

test('drafts use local context/account/style by default and no-profile prevents their use', async () => {
  await withProject(async cwd => {
    for (const args of [['draft', 'reply', '--text', 'Question'], ['draft', 'post', '--text', 'Update']]) {
      const preview = await run([...args, '--dry-run'], { cwd });
      assert.equal(preview.exit, 0);
      assert.equal(preview.result.payload.user.account, 'builder');
      assert.deepEqual(preview.result.payload.externalRelies.slice(0, 3), samples.map(s => s.text));
      assert.equal(preview.result.profile.context, join(cwd, '.sandhive', 'context.json'));
      assert.equal(preview.result.profile.style, join(cwd, '.sandhive', 'style.json'));
      assert.equal((await run([...args, '--no-profile', '--dry-run'], { cwd })).exit, 2);
    }
    const search = await run(['find', '--query', 'customer feedback', '--dry-run'], { cwd });
    assert.match(search.result.payload.icp_description, /Founders/);
    const style = await run(['style', '--dry-run'], { cwd });
    assert.equal(style.result.payload.user_id, 'builder');
  });
});

test('explicit input samples override automatic style and malformed profiles require correction or opt-out', async () => {
  await withProject(async cwd => {
    await writeFile(join(cwd, '.sandhive', 'style.json'), 'invalid');
    const preview = await run(['draft', 'reply', '--input', '-', '--dry-run'], { cwd, input: { tweet: 'Question', style_samples: samples } });
    assert.equal(preview.exit, 0);
    assert.equal(preview.result.payload.user.account, 'builder');
    assert.equal((await run(['draft', 'reply', '--text', 'Question', '--dry-run'], { cwd })).exit, 2);
    await writeFile(join(cwd, '.sandhive', 'context.json'), 'invalid');
    const disabled = await run(['draft', 'reply', '--input', '-', '--no-profile', '--dry-run'], {
      cwd, input: { tweet: 'Question', user: { account: 'other' }, style_samples: samples } });
    assert.equal(disabled.exit, 0);
    assert.equal(disabled.result.payload.user.account, 'other');
  });
});

test('one bad search item does not discard valid posts or expose placeholders as usable evidence', async () => {
  const good = { id: '1', text: 'A useful question', icp_score: 8 };
  const result = await searchTweets({}, { fetchImpl: async () => new Response(JSON.stringify({ tweets: [good,
    { text: 'Missing score' }, null, { text: 'From KaitoEasyAPI, a reminder', icp_score: 1 }], elapsed: 2 })) });
  assert.deepEqual(result.tweets, [good]);
  assert.deepEqual(result.api.tweets, [good]);
  assert.equal(result.received_count, 4);
  assert.equal(result.skipped_count, 3);
  assert.equal(result.api.elapsed, 2);
  const allBad = await searchTweets({}, { fetchImpl: async () => new Response('{"tweets":[null]}') });
  assert.equal(allBad.count, 0);
  assert.equal(allBad.warnings[0].code, 'SKIPPED_SEARCH_RESULTS');
});

test('a false reply makes exactly one request by default', async () => {
  let calls = 0;
  const result = await generateReply({}, { fetchImpl: async () => { calls++; return new Response('{"reply":false}'); } });
  assert.equal(calls, 1);
  assert.equal(result.status, 'no_draft');
  assert.equal(result.attempts, 1);
});

test('async reply workers cap concurrency, preserve input order and keep individual failures', async () => {
  const payloads = ['slow', 'failure', 'fast', 'empty'].map(tweet => ({ tweet }));
  const releases = new Map();
  let active = 0, peak = 0;
  const starts = [];
  const progress = [];
  let wake;
  let changed = new Promise(resolve => { wake = resolve; });
  function signal() { wake(); changed = new Promise(resolve => { wake = resolve; }); }
  const pending = generateReplyBatch(payloads, { concurrency: 2, onProgress: row => progress.push(row), fetchImpl: async (url, options) => {
    const { tweet } = JSON.parse(options.body);
    starts.push(tweet); active++; peak = Math.max(peak, active);
    await new Promise(resolve => { releases.set(tweet, resolve); signal(); });
    active--;
    if (tweet === 'failure') throw new Error('Private network diagnostics');
    return new Response(JSON.stringify({ reply: tweet === 'empty' ? false : tweet }));
  } });
  async function waitFor(name) { while (!releases.has(name)) await changed; }
  await waitFor('failure');
  assert.deepEqual(starts, ['slow', 'failure']);
  releases.get('failure')();
  await waitFor('fast'); releases.get('fast')();
  await waitFor('empty'); releases.get('empty')(); releases.get('slow')();
  const result = await pending;
  assert.equal(peak, 2);
  assert.deepEqual(result.results.map(row => row.status), ['draft', 'error', 'draft', 'no_draft']);
  assert.deepEqual(result.results.map(row => row.index), [0, 1, 2, 3]);
  assert.equal(result.summary.errors, 1);
  assert.equal(progress.length, 4);
  assert.equal(JSON.stringify(result).includes('Private network diagnostics'), false);
});

test('batch CLI previews all requests offline, reports progress separately, and validates before sending', async () => {
  await withProject(async cwd => {
    const input = [{ tweet: 'First' }, { tweet: 'Second' }];
    const args = ['draft', 'replies', '--input', '-', '--concurrency', '2'];
    const preview = await run([...args, '--dry-run'], { cwd, input });
    assert.equal(preview.exit, 0);
    assert.equal(preview.result.max_requests, 2);
    assert.equal(preview.result.payloads.length, 2);
    const live = await run([...args, '--progress'], { cwd, input, fetchImpl: async (url, options) => {
      assert.equal(url, GENERATE_REPLY_URL);
      const payload = JSON.parse(options.body);
      assert.equal(payload.user.account, 'builder');
      return new Response(JSON.stringify({ reply: payload.tweet }));
    } });
    assert.equal(live.exit, 0);
    assert.equal(live.result.summary.drafts, 2);
    assert.match(live.err, /2\/2 completed/);
    const partial = await run(args, { cwd, input, fetchImpl: async (url, options) => {
      return JSON.parse(options.body).tweet === 'First'
        ? new Response('{"reply":"First completed"}') : new Response('private server error', { status: 500 });
    } });
    assert.equal(partial.exit, 1);
    assert.equal(partial.result.results[0].draft.text, 'First completed');
    assert.equal(partial.result.results[1].error.details.http_status, 500);
    assert.equal(partial.result.summary.errors, 1);
    assert.equal((await run(args, { cwd, input: [{ tweet: 'Good' }, { tweet: '' }] })).exit, 2);
    for (const count of ['0', '6', 'NaN']) assert.equal((await run(['draft', 'replies', '--input', '-', '--concurrency', count], { cwd, input })).exit, 2);
  });
});

test('invalid single draft JSON is rejected before profile enrichment or sending', async () => {
  await withProject(async cwd => {
    for (const input of [null, [], 1, 'text']) {
      const result = await run(['draft', 'reply', '--input', '-'], { cwd, input });
      assert.equal(result.exit, 2);
      assert.equal(result.result.error.code, 'INVALID_INPUT');
    }
  });
});

test('network diagnostics classify known causes, redact unknown messages and preserve delivery uncertainty', async () => {
  for (const [reason, category, reached] of [['ENOTFOUND', 'dns', false], ['CERT_HAS_EXPIRED', 'tls', false],
    ['EACCES', 'permission', false], ['ECONNRESET', 'connection', true], ['UNKNOWN_SECRET', 'network', true]]) {
    await assert.rejects(postJson('https://api.sandhive.io/cli/test?secret=query', {}, { fetchImpl: async () => {
      throw new TypeError('secret exception', { cause: { code: reason } });
    } }), error => {
      assert.equal(error.details.category, category);
      assert.equal(error.details.request_may_have_reached_server, reached);
      assert.equal(error.details.endpoint, 'https://api.sandhive.io/cli/test');
      assert.equal(JSON.stringify(error).includes('secret'), false);
      return true;
    });
  }
  await assert.rejects(postJson(GENERATE_REPLY_URL, {}, { fetchImpl: async () => new Response('private server body', { status: 403 }) }),
    error => error.details.http_status === 403 && !JSON.stringify(error).includes('private server body'));
});
