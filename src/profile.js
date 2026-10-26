import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { CliError } from './errors.js';
import { validateContext, humanStyle } from './request.js';

async function readJson(path, optional) {
  try { return JSON.parse((await readFile(path, 'utf8')).replace(/^\uFEFF/, '')); }
  catch (error) {
    if (optional && error.code === 'ENOENT') return undefined;
    throw new CliError('INVALID_INPUT', `Could not read a valid JSON profile at ${path}. Correct the file or use --no-profile to skip automatic loading.`, { exitCode: 2 });
  }
}

export async function loadProfile({ cwd, contextPath, stylePath, disabled = false, needsStyle = true }) {
  const sources = {};
  let context;
  if (contextPath !== undefined || !disabled) {
    const path = resolve(cwd, contextPath ?? '.sandhive/context.json');
    const value = await readJson(path, contextPath === undefined);
    if (value !== undefined) { context = validateContext(value); sources.context = path; }
  }
  let samples;
  if (stylePath !== undefined || (needsStyle && !disabled && context?.style_samples === undefined)) {
    const path = resolve(cwd, stylePath ?? '.sandhive/style.json');
    samples = await readJson(path, stylePath === undefined);
    if (samples !== undefined) { humanStyle(samples); sources.style = path; }
  }
  return { context, samples, sources };
}
