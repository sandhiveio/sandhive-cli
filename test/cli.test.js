import test from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { main } from '../src/cli.js';
import { GENERATE_REPLY_URL, buildReplyRequest, generateReply } from '../src/request.js';

const input = { tweet: 'How do you find useful conversations?', user: { account: 'example_builder' } };
const context = { schema_version: 1, product: 'A project tool', audience: 'Founders',
  facts: ['The preview is local'], voice: 'Clear and concise', examples: ['A genuine writing sample'], sources: ['local/README.md'] };

async function run(args, content = input, fetchImpl = async () => { throw new Error('Unexpected network request'); }, cwd) {
  let out = '';
  let err = '';
  const exitCode = await main(args, {
    stdout: { write: value => { out += value; } },
    stderr: { write: value => { err += value; } },
    stdin: Readable.from([typeof content === 'string' ? content : JSON.stringify(content)]), fetchImpl, cwd,
  });
  return { exitCode, out, err, result: out ? JSON.parse(out) : undefined };
}

async function withProject(check) {
  const path = await mkdtemp(join(tmpdir(), 'sandhive-context-test-'));
  try { await check(path); }
  finally {
    assert.ok(path.startsWith(join(tmpdir(), 'sandhive-context-test-')));
    await rm(path, { recursive: true, force: true });
  }
}

test('first-run workflow saves context, previews it, and sends the existing API shape', async () => {
  await withProject(async cwd => {
    const init = await run(['init', '--product', 'Feedback organizer', '--audience', 'Founders',
      '--account', '@builder', '--voice', 'Practical and concise', '--fact', 'Groups feedback by topic',
      '--fact', 'Exports a summary', '--example', 'A genuine writing example', '--json'], input, undefined, cwd);
    assert.equal(init.exitCode, 0);
    const saved = JSON.parse(await readFile(init.result.path, 'utf8'));
    assert.equal(saved.account, 'builder');
    assert.deepEqual(saved.facts, ['Groups feedback by topic', 'Exports a summary']);
    assert.deepEqual(saved.examples, ['A genuine writing example']);
    assert.ok(Number.isFinite(Date.parse(saved.updated_at)));
    assert.equal(await readFile(join(cwd, '.sandhive', '.gitignore'), 'utf8'), '*\n');
    const args = ['draft', 'reply', '--text', 'How do we find useful conversations?',
      '--context', '.sandhive/context.json', '--json'];
    const preview = await run([...args, '--dry-run'], input, undefined, cwd);
    assert.equal(preview.exitCode, 0);
    assert.equal(preview.result.payload.user.account, 'builder');
    assert.ok(preview.result.payload.externalRelies.some(value => value.includes('Groups feedback by topic')));
    assert.ok(preview.result.payload.externalRelies.some(value => value.includes('Practical and concise')));
    let calls = 0;
    const live = await run(args, input, async (url, options) => {
      calls += 1;
      assert.equal(url, GENERATE_REPLY_URL);
      assert.deepEqual(JSON.parse(options.body), preview.result.payload);
      return new Response('{"reply":"Pick a specific problem and answer a relevant question."}');
    }, cwd);
    assert.equal(live.exitCode, 0);
    assert.equal(live.result.status, 'draft');
    assert.equal(calls, 1);
    const duplicate = await run(['init', '--product', 'Replacement', '--audience', 'Other people', '--json'], input, undefined, cwd);
    assert.equal(duplicate.result.error.code, 'ALREADY_EXISTS');
    assert.deepEqual(JSON.parse(await readFile(init.result.path, 'utf8')), saved);
    const override = await run([...args, '--account', '@other_builder', '--dry-run'], input, undefined, cwd);
    assert.equal(override.result.payload.user.account, 'other_builder');
  });
});

test('custom context locations do not get a project-wide ignore rule', async () => {
  await withProject(async cwd => {
    const init = await run(['init', '--product', 'Tool', '--audience', 'Founders',
      '--context', 'profile.json', '--json'], input, undefined, cwd);
    assert.equal(init.exitCode, 0);
    await assert.rejects(readFile(join(cwd, '.gitignore')), error => error.code === 'ENOENT');
    assert.equal(JSON.parse(await readFile(init.result.path, 'utf8')).voice, 'Clear, concise, and specific.');
  });
});

test('plain text, UTF-8 files, and stdin map to the same reply input', async () => {
  await withProject(async cwd => {
    const conversation = 'A shipped update 👋\nWhat should we explain next?';
    await writeFile(join(cwd, 'conversation.txt'), `\uFEFF${conversation}`, 'utf8');
    for (const args of [['--text', conversation], ['--file', 'conversation.txt'], ['--file', '-']]) {
      const result = await run(['draft', 'reply', ...args, '--account', '@builder', '--dry-run', '--json'],
        conversation, undefined, cwd);
      assert.equal(result.exitCode, 0);
      assert.deepEqual(result.result.payload, { tweet: conversation, user: { account: 'builder' } });
    }
  });
});

test('saved context is only used when explicitly requested', async () => {
  await withProject(async cwd => {
    await run(['init', '--product', 'Local project facts', '--audience', 'Founders', '--account', 'builder', '--json'], input, undefined, cwd);
    const result = await run(['draft', 'reply', '--text', input.tweet, '--account', 'builder', '--dry-run', '--json'], input, undefined, cwd);
    assert.equal(result.exitCode, 0);
    assert.equal(result.result.payload.externalRelies, undefined);
    const missingAccount = await run(['draft', 'reply', '--text', input.tweet, '--dry-run', '--json'], input, undefined, cwd);
    assert.equal(missingAccount.result.error.code, 'INVALID_INPUT');
  });
});

test('mixed input modes and invalid profile arguments fail without requests', async () => {
  for (const args of [
    ['draft', 'reply', '--text', 'Hello', '--file', 'conversation.txt'],
    ['draft', 'reply', '--input', '-', '--account', 'builder'],
    ['draft', 'reply', '--text', 'Hello', '--account', '@'],
    ['init', '--product', 'Tool'], ['init', '--product', 'Tool', '--audience', 'Founders', '--account', '../other'],
    ['init', '--product', 'Tool', '--audience', 'Founders', '--context', '-'],
  ]) {
    const result = await run([...args, '--json']);
    assert.equal(result.exitCode, 2);
    assert.equal(result.result.error.code, 'INVALID_INPUT');
  }
});

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
  for (const args of [['draft', 'post'], ['review'], ['auth'], ['usage']]) {
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

test('discovery previews and sends the backend contract, preserving evidence', async () => {
  const args = ['find', '--query', 'first customers', '--query', 'manual outreach', '--icp', 'sandhive', '--max-items', '10', '--min-icp-score', '5', '--json'];
  const preview = await run([...args, '--dry-run']);
  assert.equal(preview.exitCode, 0);
  assert.deepEqual(preview.result.payload, { queries: ['first customers', 'manual outreach'], icp: 'sandhive', max_items: 10, query_type: 'Latest', min_icp_score: 5 });
  const tweets = [{ id: '123', text: 'Finding customers is hard', author: 'builder', url: 'https://x.com/builder/status/123', icp_score: 7, gate_score: 8 }];
  const live = await run(args, input, async (url, options) => {
    assert.equal(url, 'https://api.sandhive.io/cli/search-score-tweets');
    assert.deepEqual(JSON.parse(options.body), preview.result.payload);
    return new Response(JSON.stringify({ tweets, count: 1, elapsed: 2 }));
  });
  assert.equal(live.result.status, 'opportunities');
  assert.deepEqual(live.result.tweets, tweets);
  assert.equal(live.result.api.elapsed, 2);
  const empty = await run(args, input, async () => new Response('{"tweets":[],"count":0}'));
  assert.equal(empty.exitCode, 0);
  assert.equal(empty.result.count, 0);
});

test('style fetch supports refresh and samples can feed reply generation', async () => {
  const args = ['style', '--account', '@builder', '--refresh', '--max-items', '20', '--json'];
  const preview = await run([...args, '--dry-run']);
  assert.deepEqual(preview.result.payload, { user_id: 'builder', refresh: true, max_items: 20 });
  const result = await run(args, input, async (url, options) => {
    assert.equal(url, 'https://api.sandhive.io/cli/user-twitter-style');
    assert.deepEqual(JSON.parse(options.body), preview.result.payload);
    return new Response('{"style":"A genuine writing sample","samples":["A genuine writing sample"],"cached":false}');
  });
  assert.equal(result.result.status, 'style');
  assert.equal(buildReplyRequest(input, { ...context, examples: result.result.samples }).externalRelies.at(-1), 'A genuine writing sample');
});

test('new commands accept stdin JSON and reject invalid or mixed inputs before network', async () => {
  for (const [command, payload] of [['find', { queries: ['pain'], icp: 'arc' }], ['style', { user_id: '@builder' }]]) {
    assert.equal((await run([command, '--input', '-', '--dry-run', '--json'], payload)).exitCode, 0);
  }
  for (const args of [ ['find'], ['find', '--query', 'pain', '--icp', 'custom'],
    ['find', '--query', 'pain', '--icp', 'arc', '--max-items', '51'],
    ['find', '--query', 'pain', '--icp', 'arc', '--query-type', 'Bad'],
    ['find', '--query', 'pain', '--icp', 'arc', '--min-icp-score', 'NaN'],
    ['style', '--account', '../bad'], ['style', '--account', 'builder', '--max-items', '0'],
    ['style', '--input', '-', '--account', 'builder'] ]) {
    assert.equal((await run([...args, '--json'])).exitCode, 2);
  }
});

test('new methods handle malformed responses and HTTP failures', async () => {
  for (const [args, body] of [
    [['find', '--query', 'pain', '--icp', 'arc'], '{"tweets":[{"text":"pain"}]}'],
    [['style', '--account', 'builder'], '{"style":"","samples":[],"cached":true}'] ]) {
    const result = await run([...args, '--json'], input, async () => new Response(body));
    assert.equal(result.result.error.code, 'INVALID_RESPONSE');
  }
  const missing = await run(['style', '--account', 'builder', '--json'], input, async () => new Response('{}', { status: 404 }));
  assert.equal(missing.result.error.code, 'API_ERROR');
});

test('provider placeholder data is rejected for both search and voice', async () => {
  const placeholder = 'From KaitoEasyAPI, a reminder: Thus, we returned N pieces of mock data.';
  for (const [args, body] of [
    [['style', '--account', 'builder'], { style: placeholder, samples: [placeholder], cached: false }],
    [['find', '--query', 'pain', '--icp', 'sandhive'], { tweets: [{ text: placeholder, icp_score: 0 }] }]
  ]) {
    const result = await run([...args, '--json'], input, async () => new Response(JSON.stringify(body)));
    assert.equal(result.exitCode, 1);
    assert.equal(result.result.error.code, 'INVALID_RESPONSE');
    assert.match(result.result.error.message, /placeholder/);
  }
});
