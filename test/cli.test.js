import test from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { main } from '../src/cli.js';
import { GENERATE_REPLY_URL, buildReplyRequest, generateReply, REQUEST_TIMEOUT_MS, postJson } from '../src/request.js';

const samples = ['First original message', 'Second original message', 'Third original message'].map(text => ({ text, source: 'test fixture: human authorship assertion', authorship: 'human' }));
const input = { tweet: 'How do you find useful conversations?', user: { account: 'example_builder' }, style_samples: samples };
const context = { schema_version: 1, product: 'A project tool', audience: 'Founders',
  style_samples: samples, facts: ['The preview is local'], voice: 'Clear and concise', examples: ['A genuine writing sample'], sources: ['local/README.md'] };

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
    saved.style_samples = samples;
    await writeFile(init.result.path, JSON.stringify(saved));
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
      await writeFile(join(cwd, 'style.json'), JSON.stringify(samples));
      const result = await run(['draft', 'reply', '--style-file', 'style.json', ...args, '--account', '@builder', '--dry-run', '--json'],
        conversation, undefined, cwd);
      assert.equal(result.exitCode, 0);
      assert.deepEqual(result.result.payload, { tweet: conversation, user: { account: 'builder' }, externalRelies: samples.map(s => s.text), fast: 1 });
    }
  });
});

test('saved context is only used when explicitly requested', async () => {
  await withProject(async cwd => {
    await run(['init', '--product', 'Local project facts', '--audience', 'Founders', '--account', 'builder', '--json'], input, undefined, cwd);
    const result = await run(['draft', 'reply', '--text', input.tweet, '--account', 'builder', '--dry-run', '--json'], input, undefined, cwd);
    assert.equal(result.exitCode, 2);
    assert.equal(result.result.error.code, 'INVALID_INPUT');
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
  assert.equal(payload.externalRelies.length, 5);
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

test('unverified legacy style is rejected and fast mode forwards the existing field', () => {
  assert.throws(() => buildReplyRequest({ ...input, style_prompt: 'Invented AI style' }, context), error => error.code === 'INVALID_INPUT');
  assert.equal(buildReplyRequest(input, context, { fast: true }).fast, 1);
});

test('reply request uses the exact endpoint and preserves API metadata', async () => {
  let calls = 0;
  const response = await generateReply(input, { fetchImpl: async (url, options) => {
    calls += 1;
    assert.equal(url, GENERATE_REPLY_URL);
    assert.equal(options.method, 'POST');
    assert.equal(options.redirect, 'error');
    assert.deepEqual(JSON.parse(options.body), { fast: 1, ...input });
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
  assert.deepEqual(result.result.payload, buildReplyRequest(input));
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
  for (const args of [['review'], ['auth'], ['usage']]) {
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

test('post generation and rewriting send human samples using the existing routes', async () => {
  await withProject(async cwd => {
    await writeFile(join(cwd, 'style.json'), JSON.stringify(samples));
    for (const rewrite of [false, true]) {
      const args = ['draft', 'post', '--account', 'builder', '--style-file', 'style.json', '--max-length', '280', '--json', ...(rewrite ? ['--text', 'We shipped a faster export.'] : ['--language', 'English'])];
      const preview = await run([...args, '--dry-run'], input, undefined, cwd);
      assert.equal(preview.exitCode, 0);
      assert.equal(preview.result.endpoint, `https://api.sandhive.io/cli/${rewrite ? 'rewrite-twitter-post' : 'generate-news-twitter-post'}`);
      assert.deepEqual(preview.result.payload.externalRelies, samples.map(s => s.text));
      assert.equal(preview.result.payload.style_samples, undefined);
      let calls = 0;
      const live = await run(args, input, async (url, options) => {
        calls++;
        assert.equal(url, preview.result.endpoint);
        assert.deepEqual(JSON.parse(options.body), preview.result.payload);
        return new Response(JSON.stringify({ post: 'A post draft', wait: 1 }));
      }, cwd);
      assert.equal(calls, 1);
      assert.equal(live.result.draft.text, 'A post draft');
    }
  });
});

test('missing, unknown, and AI authorship fail before any API call for posts and replies', async () => {
  for (const style_samples of [undefined, [], samples.slice(0, 2), samples.map(s => ({ ...s, authorship: 'ai' })), samples.map(s => ({ ...s, source: '' }))]) {
    for (const kind of ['post', 'reply']) {
      const result = await run(['draft', kind, '--input', '-', '--json'], kind === 'post' ? { user: input.user, style_samples } : { ...input, style_samples });
      assert.equal(result.exitCode, 2);
      assert.equal(result.result.error.code, 'INVALID_INPUT');
    }
  }
});

test('post no-draft and errors retain the shared response contract', async () => {
  await withProject(async cwd => {
    await writeFile(join(cwd, 'style.json'), JSON.stringify(samples));
    const args = ['draft', 'post', '--account', 'builder', '--style-file', 'style.json', '--json'];
    const empty = await run(args, input, async () => new Response('{"post":false,"wait":1}'), cwd);
    assert.equal(empty.result.status, 'no_draft');
    const bad = await run(args, input, async () => new Response('{"reply":"wrong schema"}'), cwd);
    assert.equal(bad.result.error.code, 'INVALID_RESPONSE');
    const invalidLength = await run([...args, '--max-length', '20'], input, undefined, cwd);
    assert.equal(invalidLength.exitCode, 2);
  });
});

test('explicit invalid samples never fall back to valid context samples', () => {
  for (const style_samples of [null, [], [{ text: 'AI draft', source: 'generated', authorship: 'ai' }]]) {
    assert.throws(() => buildReplyRequest({ ...input, style_samples }, context), error => error.code === 'INVALID_INPUT');
  }
  const payload = buildReplyRequest(input, context);
  assert.equal(JSON.stringify(payload).includes('test fixture:'), false);
  assert.equal(JSON.stringify(payload).includes('A genuine writing sample'), false);
});

test('discovery previews and sends the backend contract, preserving evidence', async () => {
  const args = ['find', '--query', 'first customers', '--query', 'manual outreach', '--icp', 'sandhive', '--max-items', '10', '--min-icp-score', '5', '--json'];
  const preview = await run([...args, '--dry-run']);
  assert.equal(preview.exitCode, 0);
  assert.deepEqual(preview.result.payload, { fast: 1, queries: ['first customers', 'manual outreach'], icp: 'sandhive', max_items: 10, query_type: 'Latest', min_icp_score: 5 });
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
  assert.deepEqual(preview.result.payload, { fast: 1, user_id: 'builder', refresh: true, max_items: 20 });
  const result = await run(args, input, async (url, options) => {
    assert.equal(url, 'https://api.sandhive.io/cli/user-twitter-style');
    assert.deepEqual(JSON.parse(options.body), preview.result.payload);
    return new Response('{"style":"A genuine writing sample","samples":["A genuine writing sample"],"cached":false}');
  });
  assert.equal(result.result.status, 'style');
  assert.equal(buildReplyRequest(input, { ...context, examples: result.result.samples }).externalRelies.includes('A genuine writing sample'), false);
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

test('all five endpoint requests default to numeric fast mode', async () => {
  for (const [kind, content, body] of [
    ['reply', input, { reply: 'Reply' }],
    ['post', { user: input.user, style_samples: samples }, { post: 'Post' }],
    ['post', { user: input.user, style_samples: samples, post: 'Update' }, { post: 'Post' }],
    ['find', { queries: ['pain'], icp: 'sandhive' }, { tweets: [] }],
    ['style', { user_id: 'builder' }, { style: 'Candidate', samples: ['Candidate'], cached: true }],
  ]) {
    const args = kind === 'reply' || kind === 'post' ? ['draft', kind] : [kind];
    const preview = await run([...args, '--input', '-', '--dry-run', '--json'], content);
    assert.equal(preview.result.payload.fast, 1);
    const live = await run([...args, '--input', '-', '--json'], content, async (url, options) => {
      assert.equal(JSON.parse(options.body).fast, 1);
      return new Response(JSON.stringify(body));
    });
    assert.equal(live.exitCode, 0);
  }
});

test('shared requests use a 20-minute timeout covering response body reads', async () => {
  const original = AbortSignal.timeout;
  const durations = [];
  AbortSignal.timeout = duration => { durations.push(duration); return new AbortController().signal; };
  try {
    await postJson(GENERATE_REPLY_URL, {}, { fetchImpl: async () => new Response('{}') });
    assert.deepEqual(durations, [1200000]);
    assert.equal(REQUEST_TIMEOUT_MS, 1200000);
  } finally { AbortSignal.timeout = original; }
  await assert.rejects(postJson(GENERATE_REPLY_URL, {}, { timeoutMs: 1, fetchImpl: async (url, options) => ({
    text: () => new Promise((resolve, reject) => {
      options.signal.addEventListener('abort', () => reject(options.signal.reason), { once: true });
      setTimeout(() => resolve('{}'), 30);
    }),
  }) }), error => error.code === 'TIMEOUT');
});

test('beta notice is present in JSON without breaking structured output', async () => {
  const result = await run(['--help', '--json']);
  assert.match(result.result.notice, /beta and active development/);
  assert.equal(result.err, '');
  const error = await run(['unknown', '--json']);
  assert.match(error.result.notice, /Update your checkout/);
});

test('human output includes the beta notice on stderr', async () => {
  let out = '', err = '';
  await main(['--version'], { stdout: { write: s => { out += s; } }, stderr: { write: s => { err += s; } } });
  assert.equal(out.trim(), '0.1.0');
  assert.match(err, /beta and active development/);
});

test('news manifest flags, UTF-8 file, and JSON send the same brief on the news route', async () => {
  await withProject(async cwd => {
    const manifest = 'Sandhive CLI AGENTCI TOOL for twitter harness\nVerified update: supports human style samples.';
    await writeFile(join(cwd, 'manifest.md'), `\uFEFF${manifest}`, 'utf8');
    await writeFile(join(cwd, 'style.json'), JSON.stringify(samples));
    const requests = [
      { args: ['--manifest', manifest, '--account', 'builder', '--style-file', 'style.json'], content: input },
      { args: ['--manifest-file', 'manifest.md', '--account', 'builder', '--style-file', 'style.json'], content: input },
      { args: ['--input', '-'], content: { user: { account: 'builder' }, style_samples: samples, manifest } },
    ];
    let expected;
    for (const request of requests) {
      const args = ['draft', 'post', ...request.args, '--json'];
      const preview = await run([...args, '--dry-run'], request.content, undefined, cwd);
      assert.equal(preview.exitCode, 0);
      assert.equal(preview.result.endpoint, 'https://api.sandhive.io/cli/generate-news-twitter-post');
      assert.equal(preview.result.payload.manifest, manifest);
      assert.equal(preview.result.payload.fast, 1);
      if (expected) assert.deepEqual(preview.result.payload, expected);
      expected = preview.result.payload;
      const live = await run(args, request.content, async (url, options) => {
        assert.equal(url, preview.result.endpoint);
        assert.deepEqual(JSON.parse(options.body), expected);
        return new Response('{"post":"A news post","manifest_draft_index":1}');
      }, cwd);
      assert.equal(live.result.draft.text, 'A news post');
      assert.equal(live.result.api.manifest_draft_index, 1);
    }
  });
});

test('invalid and conflicting manifests fail before sending a request', async () => {
  const base = { user: input.user, style_samples: samples };
  for (const manifest of ['', '   ', null, 42, {}]) {
    const result = await run(['draft', 'post', '--input', '-', '--json'], { ...base, manifest });
    assert.equal(result.exitCode, 2);
  }
  for (const [args, content] of [
    [['draft', 'post', '--input', '-'], { ...base, post: 'Rewrite material', manifest: 'Brief' }],
    [['draft', 'post', '--manifest', 'Brief', '--manifest-file', 'manifest.md', '--account', 'builder'], input],
    [['draft', 'post', '--manifest-file', '-', '--account', 'builder'], input],
    [['draft', 'post', '--input', '-', '--manifest', 'Brief'], base],
    [['draft', 'reply', '--input', '-'], { ...input, manifest: 'Brief' }],
  ]) {
    const result = await run([...args, '--json'], content);
    assert.equal(result.exitCode, 2);
    assert.equal(result.result.error.code, 'INVALID_INPUT');
  }
});
