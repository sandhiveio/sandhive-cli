import { CliError } from './errors.js';
import { postJson, fastValue } from './request.js';

export const SEARCH_TWEETS_URL = 'https://api.sandhive.io/cli/search-score-tweets';
export const USER_STYLE_URL = 'https://api.sandhive.io/cli/user-twitter-style';
const invalid = message => { throw new CliError('INVALID_INPUT', message, { exitCode: 2 }); };
function object(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) invalid('Input must be a JSON object.');
}
function fields(input, allowed) {
  for (const key of Object.keys(input)) if (!allowed.includes(key)) invalid(`Unsupported input field: ${key}.`);
}
function count(value, fallback, max) {
  if (value !== undefined && (typeof value === 'boolean' || value === null || value === '')) invalid('max_items must be a positive integer.');
  const result = value === undefined ? fallback : Number(value);
  if (!Number.isInteger(result) || result < 1 || result > max) invalid(`max_items must be an integer from 1 to ${max}.`);
  return result;
}
function rejectProviderPlaceholder(text) {
  if (/from\s+kaitoeasyapi,?\s+a\s+reminder/i.test(text) || /returned\s+\w+\s+pieces\s+of\s+mock\s+data/i.test(text)) {
    throw new CliError('INVALID_RESPONSE', 'The provider returned placeholder data instead of genuine tweets. Do not use it as evidence or writing samples.');
  }
}
export function buildSearchRequest(input) {
  object(input);
  fields(input, ['queries', 'icp', 'max_items', 'query_type', 'min_icp_score', 'fast']);
  if (!Array.isArray(input.queries) || !input.queries.length || !input.queries.every(q => typeof q === 'string' && q.trim())) invalid('Provide one or more non-empty queries.');
  if (!['sandhive', 'arc'].includes(input.icp)) invalid('icp must be sandhive or arc; custom product scoring is not supported by this API.');
  const query_type = input.query_type ?? 'Latest';
  if (!['Latest', 'Top'].includes(query_type)) invalid('query_type must be Latest or Top.');
  const payload = { fast: fastValue(input.fast), queries: input.queries.map(q => q.trim()), icp: input.icp, max_items: count(input.max_items, 20, 50), query_type };
  if (input.min_icp_score !== undefined) {
    if (input.min_icp_score === null || input.min_icp_score === '' || typeof input.min_icp_score === 'boolean' || !Number.isFinite(Number(input.min_icp_score))) invalid('min_icp_score must be a finite number.');
    payload.min_icp_score = Number(input.min_icp_score);
  }
  return payload;
}
export function buildStyleRequest(input) {
  object(input);
  fields(input, ['user_id', 'refresh', 'max_items', 'fast']);
  const user_id = typeof input.user_id === 'string' ? input.user_id.trim().replace(/^@/, '') : '';
  if (!/^[a-zA-Z0-9_-]+$/.test(user_id)) invalid('Provide a valid account handle.');
  if (input.refresh !== undefined && typeof input.refresh !== 'boolean') invalid('refresh must be a boolean.');
  return { fast: fastValue(input.fast), user_id, refresh: input.refresh ?? false, max_items: count(input.max_items, 40, 200) };
}
export async function searchTweets(payload, options) {
  const api = await postJson(SEARCH_TWEETS_URL, payload, options);
  if (!api || !Array.isArray(api.tweets) || !api.tweets.every(row => row && typeof row.text === 'string' && row.text.trim() && typeof row.icp_score === 'number' && Number.isFinite(row.icp_score))) throw new CliError('INVALID_RESPONSE', 'The API returned an unexpected search format.');
  api.tweets.forEach(row => rejectProviderPlaceholder(row.text));
  return { schema_version: 1, status: 'opportunities', tweets: api.tweets, count: api.tweets.length, api };
}
export async function userStyle(payload, options) {
  const api = await postJson(USER_STYLE_URL, payload, options);
  if (!api || typeof api.style !== 'string' || !api.style.trim() || !Array.isArray(api.samples) || !api.samples.every(s => typeof s === 'string') || typeof api.cached !== 'boolean') throw new CliError('INVALID_RESPONSE', 'The API returned an unexpected style format.');
  rejectProviderPlaceholder(api.style);
  api.samples.forEach(rejectProviderPlaceholder);
  return { schema_version: 1, status: 'style', style: api.style, samples: api.samples, cached: api.cached, api };
}
