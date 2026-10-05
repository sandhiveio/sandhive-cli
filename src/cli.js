import { readFile, writeFile, cp, mkdir, access } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CliError, errorResult } from './errors.js';
import { GENERATE_REPLY_URL, buildReplyRequest, generateReply, validateContext } from './request.js';
import { SEARCH_TWEETS_URL, USER_STYLE_URL, buildSearchRequest, buildStyleRequest, searchTweets, userStyle } from './twitter.js';

const HELP = `SandHive — social drafts for people and agents

Usage:
  sandhive init --product <description> --audience <people> [--account <handle>] [--voice <style>]
  sandhive draft reply --text <conversation> [--account <handle>] [--context <file>] [--dry-run] [--json]
  sandhive draft reply --file <file|-> [--account <handle>] [--context <file>] [--dry-run] [--json]
  sandhive draft reply --input <file|-> [--context <file>] [--fast] [--dry-run] [--json]
  sandhive skill install --agent <codex|claude> --target <project-directory> [--json]
  sandhive find --query <search> --icp <sandhive|arc> [--query <search>] [--max-items <1-50>] [--query-type <Latest|Top>] [--min-icp-score <number>] [--dry-run] [--json]
  sandhive style --account <handle> [--refresh] [--max-items <1-200>] [--dry-run] [--json]
  sandhive find | style --input <file|-> [--dry-run] [--json]
  sandhive draft post | review | auth | usage   (planned; no API calls)

Options:
  --product <text>     Product description for init
  --audience <text>    Target audience for init
  --voice <text>       Writing voice for init (default: clear, concise, specific)
  --fact <text>        Verified fact for init; repeat to add more
  --example <text>     Writing example for init; repeat to add more
  --account <handle>   X handle; accepts an optional leading @
  --text <text>        Conversation text to reply to
  --file <file|->      Conversation text file; use - for stdin
  --input <file|->     Reply request JSON; use - for stdin
  --context <file>     Context JSON to use; init writes here (default: .sandhive/context.json)
  --fast              Use the API's existing fast option
  --dry-run           Preview the request without sending it
  --json              Emit one JSON result; no interactive prompts
  --agent <name>      Skill installation target: codex or claude
  --target <path>     Project directory for skill installation
  --help              Show help
  --version           Show version

Drafts require human review. This CLI does not publish to X.
`;

async function loadText(path, stdin) {
  let text;
  try {
    if (path === '-') {
      if (stdin.isTTY) throw new CliError('INVALID_INPUT', 'Pipe input to stdin when using -.', { exitCode: 2 });
      stdin.setEncoding?.('utf8');
      text = '';
      for await (const chunk of stdin) text += chunk;
    } else text = await readFile(path, 'utf8');
  } catch (error) {
    if (error instanceof CliError) throw error;
    throw new CliError('INVALID_INPUT', 'Could not read the input file.', { exitCode: 2 });
  }
  return text.replace(/^\uFEFF/, '');
}

async function loadJson(path, stdin) {
  const text = await loadText(path, stdin);
  try { return JSON.parse(text); }
  catch { throw new CliError('INVALID_INPUT', 'Input must be valid JSON.', { exitCode: 2 }); }
}

function emit(result, json, stdout) {
  if (json) stdout.write(`${JSON.stringify(result)}\n`);
  else if (result.status === 'draft') stdout.write(`${result.draft.text}\n`);
  else if (result.status === 'no_draft') stdout.write('No draft returned. Review the conversation or try another one.\n');
  else if (result.status === 'preview') stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  else if (result.status === 'style') stdout.write(`${result.style}\n`);
  else if (result.status === 'opportunities') stdout.write(result.tweets.length
    ? result.tweets.map(row => `@${row.author || 'unknown'} | ICP ${row.icp_score}\n${row.text}\n${row.url || ''}`).join('\n\n') + '\n'
    : 'No matching tweets returned.\n');
  else stdout.write(`${result.message}\n`);
}

export async function main(argv, { stdout = process.stdout, stderr = process.stderr,
  stdin = process.stdin, fetchImpl = globalThis.fetch, cwd = process.cwd() } = {}) {
  let json = argv.includes('--json');
  try {
    const { values, positionals } = parseArgs({ args: argv, allowPositionals: true, strict: true, options: {
      input: { type: 'string' }, context: { type: 'string' }, agent: { type: 'string' }, target: { type: 'string' },
      text: { type: 'string' }, file: { type: 'string' }, account: { type: 'string' },
      product: { type: 'string' }, audience: { type: 'string' }, voice: { type: 'string' },
      fact: { type: 'string', multiple: true }, example: { type: 'string', multiple: true },
      query: { type: 'string', multiple: true }, icp: { type: 'string' },
      'max-items': { type: 'string' }, 'query-type': { type: 'string' }, 'min-icp-score': { type: 'string' }, refresh: { type: 'boolean' },
      fast: { type: 'boolean' }, 'dry-run': { type: 'boolean' }, json: { type: 'boolean' },
      help: { type: 'boolean' }, version: { type: 'boolean' },
    } });
    json = Boolean(values.json);
    if (values.help || !positionals.length || values.version) {
      const message = values.version ? '0.1.0' : HELP;
      emit({ schema_version: 1, status: 'ok', message }, json, stdout);
      return 0;
    }
    const command = positionals.join(' ');
    const allowed = command === 'draft reply' ? ['input', 'text', 'file', 'account', 'context', 'fast', 'dry-run', 'json']
      : command === 'init' ? ['product', 'audience', 'voice', 'fact', 'example', 'account', 'context', 'json']
      : command === 'skill install' ? ['agent', 'target', 'json'] : ['json'];
    if (command === 'find') allowed.push('input', 'query', 'icp', 'max-items', 'query-type', 'min-icp-score', 'dry-run');
    if (command === 'style') allowed.push('input', 'account', 'refresh', 'max-items', 'dry-run');
    for (const option of Object.keys(values)) {
      if (!allowed.includes(option)) throw new CliError('INVALID_INPUT', `Option --${option} is not supported for ${command}.`, { exitCode: 2 });
    }
    const localPath = path => path === '-' ? '-' : resolve(cwd, path);
    const account = values.account?.trim().replace(/^@/, '');
    if (command === 'find' || command === 'style') {
      if (values.input !== undefined && Object.keys(values).some(key => !['input', 'dry-run', 'json'].includes(key))) {
        throw new CliError('INVALID_INPUT', 'Use either --input JSON or command flags, not both.', { exitCode: 2 });
      }
      const input = values.input !== undefined ? await loadJson(localPath(values.input), stdin)
        : command === 'find' ? { queries: values.query, icp: values.icp, max_items: values['max-items'], query_type: values['query-type'], min_icp_score: values['min-icp-score'] }
        : { user_id: account, refresh: values.refresh, max_items: values['max-items'] };
      const payload = command === 'find' ? buildSearchRequest(input) : buildStyleRequest(input);
      const endpoint = command === 'find' ? SEARCH_TWEETS_URL : USER_STYLE_URL;
      const result = values['dry-run'] ? { schema_version: 1, status: 'preview', endpoint, method: 'POST', payload }
        : await (command === 'find' ? searchTweets : userStyle)(payload, { fetchImpl });
      emit(result, json, stdout);
      return 0;
    }
    if (command === 'init') {
      if (values.context === '-') throw new CliError('INVALID_INPUT', 'Use a file path for --context.', { exitCode: 2 });
      const context = validateContext({
        schema_version: 1, product: values.product, audience: values.audience,
        voice: values.voice || 'Clear, concise, and specific.', facts: values.fact || [],
        examples: values.example || [], updated_at: new Date().toISOString(), sources: [],
        ...(values.account !== undefined ? { account } : {}),
      });
      const path = localPath(values.context || '.sandhive/context.json');
      try {
        await mkdir(dirname(path), { recursive: true });
        if (dirname(path) === resolve(cwd, '.sandhive')) {
          try { await writeFile(resolve(cwd, '.sandhive', '.gitignore'), '*\n', { flag: 'wx' }); }
          catch (error) { if (error.code !== 'EEXIST') throw error; }
        }
        await writeFile(path, `${JSON.stringify(context, null, 2)}\n`, { flag: 'wx', mode: 0o600 });
      }
      catch (error) {
        if (error.code === 'EEXIST') throw new CliError('ALREADY_EXISTS', 'Context already exists. Edit it to update facts and voice; init will not overwrite it.', { exitCode: 2 });
        throw new CliError('FILE_ERROR', 'Could not save context. Check the destination and write permissions.');
      }
      emit({ schema_version: 1, status: 'ok', message: `Saved context at ${path}. Review it before sending a draft request.`, path }, json, stdout);
      return 0;
    }
    if (command === 'draft reply') {
      if (['input', 'text', 'file'].filter(key => values[key] !== undefined).length !== 1) {
        throw new CliError('INVALID_INPUT', 'Provide exactly one of --text <conversation>, --file <file|->, or --input <file|->.', { exitCode: 2 });
      }
      if (values.input !== undefined && values.account !== undefined) {
        throw new CliError('INVALID_INPUT', 'Use user.account inside --input JSON; --account is for --text or --file.', { exitCode: 2 });
      }
      if (values.context === '-') throw new CliError('INVALID_INPUT', 'Use a file for --context; stdin is reserved for conversation input.', { exitCode: 2 });
      const context = values.context !== undefined ? validateContext(await loadJson(localPath(values.context), stdin)) : undefined;
      if (values.input === undefined && !/^[a-zA-Z0-9_-]+$/.test(account ?? context?.account ?? '')) {
        throw new CliError('INVALID_INPUT', 'Provide --account <handle> or save an account in the context. Use letters, numbers, underscores, or hyphens, with an optional leading @ on the flag.', { exitCode: 2 });
      }
      const input = values.input !== undefined ? await loadJson(localPath(values.input), stdin)
        : { tweet: values.text ?? await loadText(localPath(values.file), stdin),
          user: { account: account ?? context?.account } };
      const payload = buildReplyRequest(input, context, { fast: values.fast });
      const result = values['dry-run']
        ? { schema_version: 1, status: 'preview', endpoint: GENERATE_REPLY_URL, method: 'POST', payload }
        : await generateReply(payload, { fetchImpl });
      emit(result, json, stdout);
      return 0;
    }
    if (command === 'skill install') {
      if (!['codex', 'claude'].includes(values.agent) || !values.target) {
        throw new CliError('INVALID_INPUT', 'Provide --agent codex|claude and --target <project-directory>.', { exitCode: 2 });
      }
      const source = fileURLToPath(new URL('../skills/sandhive/', import.meta.url));
      const target = resolve(cwd, values.target, values.agent === 'codex' ? '.agents' : '.claude', 'skills', 'sandhive');
      try { await access(target); throw new CliError('ALREADY_EXISTS', 'The target skill already exists. Review it before replacing it.', { exitCode: 2 }); }
      catch (error) { if (error.code !== 'ENOENT') throw error; }
      await mkdir(dirname(target), { recursive: true });
      await cp(source, target, { recursive: true, force: false, errorOnExist: true });
      emit({ schema_version: 1, status: 'ok', message: `Installed the SandHive skill at ${target}.`, path: target }, json, stdout);
      return 0;
    }
    if (['draft post', 'review', 'auth', 'usage'].includes(command)) {
      throw new CliError('NOT_IMPLEMENTED', `${command} is planned. No API request was sent.`, { exitCode: 3 });
    }
    throw new CliError('INVALID_INPUT', 'Unknown command. Run sandhive --help.', { exitCode: 2 });
  } catch (error) {
    if (error.code?.startsWith('ERR_PARSE_ARGS')) error = new CliError('INVALID_INPUT', error.message, { exitCode: 2 });
    const result = errorResult(error);
    if (json) stdout.write(`${JSON.stringify(result)}\n`);
    else stderr.write(`${result.error.code}: ${result.error.message}\n`);
    return error.exitCode || 1;
  }
}
