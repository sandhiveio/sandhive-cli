import { readFile, cp, mkdir, access } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CliError, errorResult } from './errors.js';
import { GENERATE_REPLY_URL, buildReplyRequest, generateReply } from './request.js';

const HELP = `SandHive — social drafts for people and agents

Usage:
  sandhive draft reply --input <file|-> [--context <file>] [--fast] [--dry-run] [--json]
  sandhive skill install --agent <codex|claude> --target <project-directory> [--json]
  sandhive find | draft post | review | auth | usage   (planned; no API calls)

Options:
  --input <file|->     Reply request JSON; use - for stdin
  --context <file>     Optional project context JSON
  --fast              Use the API's existing fast option
  --dry-run           Preview the request without sending it
  --json              Emit one JSON result; no interactive prompts
  --agent <name>      Skill installation target: codex or claude
  --target <path>     Project directory for skill installation
  --help              Show help
  --version           Show version

Drafts require human review. This CLI does not publish to X.
`;

async function loadJson(path, stdin) {
  let text;
  try {
    if (path === '-') {
      if (stdin.isTTY) throw new CliError('INVALID_INPUT', 'Pipe JSON to stdin when using --input -.', { exitCode: 2 });
      stdin.setEncoding?.('utf8');
      text = '';
      for await (const chunk of stdin) text += chunk;
    } else text = await readFile(path, 'utf8');
  } catch (error) {
    if (error instanceof CliError) throw error;
    throw new CliError('INVALID_INPUT', 'Could not read the input file.', { exitCode: 2 });
  }
  try { return JSON.parse(text.replace(/^\uFEFF/, '')); }
  catch { throw new CliError('INVALID_INPUT', 'Input must be valid JSON.', { exitCode: 2 }); }
}

function emit(result, json, stdout) {
  if (json) stdout.write(`${JSON.stringify(result)}\n`);
  else if (result.status === 'draft') stdout.write(`${result.draft.text}\n`);
  else if (result.status === 'no_draft') stdout.write('No draft returned. Review the conversation or try another one.\n');
  else if (result.status === 'preview') stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  else stdout.write(`${result.message}\n`);
}

export async function main(argv, { stdout = process.stdout, stderr = process.stderr,
  stdin = process.stdin, fetchImpl = globalThis.fetch } = {}) {
  let json = argv.includes('--json');
  try {
    const { values, positionals } = parseArgs({ args: argv, allowPositionals: true, strict: true, options: {
      input: { type: 'string' }, context: { type: 'string' }, agent: { type: 'string' }, target: { type: 'string' },
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
    const allowed = command === 'draft reply' ? ['input', 'context', 'fast', 'dry-run', 'json']
      : command === 'skill install' ? ['agent', 'target', 'json'] : ['json'];
    for (const option of Object.keys(values)) {
      if (!allowed.includes(option)) throw new CliError('INVALID_INPUT', `Option --${option} is not supported for ${command}.`, { exitCode: 2 });
    }
    if (command === 'draft reply') {
      if (!values.input) throw new CliError('INVALID_INPUT', 'Provide --input <file|->.', { exitCode: 2 });
      if (values.context === '-') throw new CliError('INVALID_INPUT', 'Use a file for --context; stdin is reserved for --input -.', { exitCode: 2 });
      const input = await loadJson(values.input, stdin);
      const context = values.context ? await loadJson(values.context, stdin) : undefined;
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
      const target = resolve(values.target, values.agent === 'codex' ? '.agents' : '.claude', 'skills', 'sandhive');
      try { await access(target); throw new CliError('ALREADY_EXISTS', 'The target skill already exists. Review it before replacing it.', { exitCode: 2 }); }
      catch (error) { if (error.code !== 'ENOENT') throw error; }
      await mkdir(dirname(target), { recursive: true });
      await cp(source, target, { recursive: true, force: false, errorOnExist: true });
      emit({ schema_version: 1, status: 'ok', message: `Installed the SandHive skill at ${target}.`, path: target }, json, stdout);
      return 0;
    }
    if (['find', 'draft post', 'review', 'auth', 'usage'].includes(command)) {
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
