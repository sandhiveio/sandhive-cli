import { CliError, errorResult } from './errors.js';
import { buildReplyRequest, generateReply, GENERATE_REPLY_URL } from './request.js';

export function batchLimit(value, fallback, maximum, label) {
  const number = value === undefined ? fallback : Number(value);
  if (!Number.isInteger(number) || number < 1 || number > maximum) {
    throw new CliError('INVALID_INPUT', `${label} must be an integer from 1 to ${maximum}.`, { exitCode: 2 });
  }
  return number;
}

export function buildReplyBatch(input, context, samples) {
  if (!Array.isArray(input) || !input.length || input.length > 20) {
    throw new CliError('INVALID_INPUT', 'Provide a JSON array of 1 to 20 reply inputs.', { exitCode: 2 });
  }
  return input.map(item => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      throw new CliError('INVALID_INPUT', 'Every batch item must be a reply input object.', { exitCode: 2 });
    }
    const request = { ...item };
    if (request.user === undefined && context?.account) request.user = { account: context.account };
    if (request.style_samples === undefined && samples !== undefined) request.style_samples = samples;
    return buildReplyRequest(request, context);
  });
}

export async function generateReplyBatch(payloads, { concurrency = 1, onProgress, ...options } = {}) {
  const workers = batchLimit(concurrency, 1, 5, 'concurrency');
  const results = new Array(payloads.length);
  let next = 0;
  let completed = 0;
  async function worker() {
    while (next < payloads.length) {
      const index = next++;
      try { results[index] = { index, ...await generateReply(payloads[index], options) }; }
      catch (error) { results[index] = { index, ...errorResult(error) }; }
      completed++;
      onProgress?.({ completed, total: payloads.length, index, status: results[index].status });
    }
  }
  await Promise.all(Array.from({ length: Math.min(workers, payloads.length) }, worker));
  return { schema_version: 1, status: 'batch', endpoint: GENERATE_REPLY_URL, concurrency: workers, results,
    summary: { total: results.length, drafts: results.filter(row => row.status === 'draft').length,
      no_draft: results.filter(row => row.status === 'no_draft').length, errors: results.filter(row => row.status === 'error').length } };
}
