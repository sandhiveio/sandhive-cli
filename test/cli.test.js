import test from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { main } from '../src/cli.js';
import { GENERATE_REPLY_URL, buildReplyRequest, generateReply } from '../src/request.js';

const input = { tweet: 'How do you find useful conversations?', user: { account: 'example_builder' } };
const context = { schema_version: 1, product: 'A project tool', audience: 'Founders',
  facts: ['The preview is local'], voice: 'Clear and concise', examples: ['A genuine writing sample'], sources: ['local/README.md'] };

async function run(args, content = input, fetchImpl = async () => { throw new Error('Unexpected network request'); }) {
  let out = '';
  let err = '';
  const exitCode = await main(args, {
    stdout: { write: value => { out += value; } },
    stderr: { write: value => { err += value; } },
    stdin: Readable.from([typeof content === 'string' ? content : JSON.stringify(content)]), fetchImpl,
  });
  return { exitCode, out, err, result: out ? JSON.parse(out) : undefined };
}

test('context uses existing fields and does not upload source metadata', () => {
  const payload = buildReplyRequest(input, context);
  assert.equal(payload.tweet, input.tweet);
  assert.deepEqual(payload.user, input.user);
  assert.equal(payload.externalRelies.length, 4);
  assert.ok(payload.externalRelies.some(value => value.includes('A project tool')));
  assert.ok(payload.externalRelies.some(value => value.includes('Clear and concise')));
  assert.equal(JSON.stringify(payload).includes('local/README.md'), false);
  assert.equal(input.externalRelies, undefined);
});

test('invalid account, style array, unknown fields, and context fail before a request', () => {
  for (const value of [{ ...input, user: { account: '../other' } },
    { ...input, externalRelies: 'not an array' }, { ...input, api_key: 'not-supported' }]) {
    assert.throws(() => buildReplyRequest(value), error => error.code === 'INVALID_INPUT');
  }
  assert.throws(() => buildReplyRequest(input, { ...context, facts: null }), error => error.code === 'INVALID_INPUT');
});

test('style guidance remains intact and fast mode forwards the existing field', () => {
  const payload = buildReplyRequest({ ...input, style_prompt: 'My writing guidance' }, context, { fast: true });
  assert.ok(payload.externalRelies.includes('My writing guidance'));
  assert.equal(payload.style_prompt, undefined);
  assert.equal(payload.fast, true);
});

test('reply request uses the exact endpoint and preserves API metadata', async () => {
  let calls = 0;
  const response = await generateReply(input, { fetchImpl: async (url, options) => {
    calls += 1;
    assert.equal(url, GENERATE_REPLY_URL);
    assert.equal(options.method, 'POST');
    assert.equal(options.redirect, 'error');
    assert.deepEqual(JSON.parse(options.body), input);
    return new Response(JSON.stringify({ reply: 'Start with one relevant conversation.', wait: 1, gate_score: 7 }));
  } });
  assert.equal(calls, 1);
  assert.equal(response.status, 'draft');
  assert.equal(response.draft.text, 'Start with one relevant conversation.');
  assert.equal(response.api.gate_score, 7);
});

test('no draft is a successful result rather than an invented skip reason', async () => {
  const result = await generateReply(input, { fetchImpl: async () => new Response('{"reply":false,"wait":1}') });
  assert.equal(result.status, 'no_draft');
  assert.equal(result.draft, null);
  assert.equal(result.reason, undefined);
});

test('rate limit preserves Retry-After without exposing response contents', async () => {
  await assert.rejects(generateReply(input, { fetchImpl: async () => new Response('private diagnostics', {
    status: 429, headers: { 'Retry-After': '60' },
  }) }), error => error.code === 'RATE_LIMITED' && error.retryAfter === '60'
    && error.retryable && !error.message.includes('private diagnostics'));
});

test('ambiguous timeout is not retried or advertised as automatically retryable', async () => {
  let calls = 0;
  await assert.rejects(generateReply(input, { fetchImpl: async () => {
    calls += 1;
    throw new DOMException('timeout', 'TimeoutError');
  } }), error => error.code === 'TIMEOUT' && error.retryable === false);
  assert.equal(calls, 1);
});

test('malformed and unexpected API responses fail explicitly', async () => {
  for (const body of ['not json', '{"reply":null}', '{"reply":""}', '[]']) {
    await assert.rejects(generateReply(input, { fetchImpl: async () => new Response(body) }),
      error => error.code === 'INVALID_RESPONSE');
  }
});

test('dry run is valid JSON and makes no network request', async () => {
  const result = await run(['draft', 'reply', '--input', '-', '--dry-run', '--json']);
  assert.equal(result.exitCode, 0);
  assert.equal(result.err, '');
  assert.equal(result.result.status, 'preview');
  assert.deepEqual(result.result.payload, input);
});

test('UTF-8 input preserves split multibyte conversation text', async () => {
  const source = Buffer.from(JSON.stringify({ ...input, tweet: 'Hello 👋' }));
  let out = '';
  const exitCode = await main(['draft', 'reply', '--input', '-', '--dry-run', '--json'], {
    stdin: Readable.from([...source].map(byte => Buffer.from([byte]))),
    stdout: { write: value => { out += value; } }, stderr: { write: () => {} },
  });
  assert.equal(exitCode, 0);
  assert.equal(JSON.parse(out).payload.tweet, 'Hello 👋');
});

test('planned commands report NOT_IMPLEMENTED without fabricating results', async () => {
  for (const args of [['find'], ['draft', 'post'], ['review'], ['auth'], ['usage']]) {
    const result = await run([...args, '--json']);
    assert.equal(result.exitCode, 3);
    assert.equal(result.result.error.code, 'NOT_IMPLEMENTED');
  }
});

test('invalid input and unsupported flags produce structured errors', async () => {
  for (const [args, content] of [
    [['draft', 'reply', '--input', '-', '--json'], 'bad json'],
    [['draft', 'reply', '--input', '-', '--context', '-', '--json'], input],
    [['draft', 'reply', '--input', '-', '--unknown', '--json'], input],
    [['find', '--fast', '--json'], input],
  ]) {
    const result = await run(args, content);
    assert.equal(result.exitCode, 2);
    assert.equal(result.result.error.code, 'INVALID_INPUT');
  }
});

test('skill installation copies all references and refuses to overwrite', async () => {
  const target = await mkdtemp(join(tmpdir(), 'sandhive-skill-test-'));
  try {
    for (const agent of ['codex', 'claude']) {
      const result = await run(['skill', 'install', '--agent', agent, '--target', target, '--json']);
      assert.equal(result.exitCode, 0);
      const reference = await readFile(join(result.result.path, 'references', 'cli.md'), 'utf8');
      assert.ok(reference.includes('NOT_IMPLEMENTED'));
      const duplicate = await run(['skill', 'install', '--agent', agent, '--target', target, '--json']);
      assert.equal(duplicate.exitCode, 2);
      assert.equal(duplicate.result.error.code, 'ALREADY_EXISTS');
    }
  } finally {
    // Delete only the uniquely created test directory beneath the OS temp directory.
    assert.equal(target.startsWith(join(tmpdir(), 'sandhive-skill-test-')), true);
    await rm(target, { recursive: true, force: true });
  }
});
