# CLI reference

## Human style (required for every draft)

Supply `--style-file <file>` containing a JSON array, or `style_samples` in request JSON or an explicit context file. At least three items are required:

```json
{ "text": "Original message written by the user", "source": "URL or supplied file/location", "authorship": "human" }
```

These are placeholders, not usable samples. Original human writing matters for style quality; exclude known generated/rewritten texts and other authors' quotations. The agent selects originals from available sources and fills authorship metadata without asking for a separate user declaration. The CLI validates metadata structure, not actual authorship. Missing samples produce `INVALID_INPUT`, exit 2, before sending. Explicit request samples take precedence over context samples; invalid explicit samples do not fall back to context. Source references and authorship metadata stay local. The API receives message text through its existing `externalRelies` field. `--voice` and legacy `examples` are not an alternate sample source. Free-form request fields `externalRelies`, `style_prompt`, and `style` are rejected.

## Local context

```sh
sandhive init --product "..." --audience "..." --account your_handle --voice "..." --fact "..."
```

Creates `.sandhive/context.json`, never overwriting a profile. Draft commands automatically load this file from the current project; add selected original writing as `style_samples`, or save `.sandhive/style.json` for automatic fallback. Precedence: explicit input samples, explicit style file, context samples, default style file. Invalid selected samples do not silently fall back. Explicit paths select different files; `--no-profile` disables automatic loading while still allowing explicitly supplied files. Previews identify profile source paths. Product/audience/facts and voice preferences supplement reply requests; source metadata is not sent. Post rewriting gets factual material from the supplied text. News generation uses an explicit manifest when supplied, otherwise the server manifest.

## Replies

```sh
sandhive draft reply --file conversation.txt --context .sandhive/context.json --json
sandhive draft reply --text "..." --account your_handle --style-file style.json --dry-run --json
sandhive draft reply --input request.json --style-file style.json --json
```

Exactly one of text/file/input is required. File and input accept `-` for stdin; context/style files must be paths. Request JSON uses `tweet`, `user.account`, optional `style_samples`, and optional `fast` (0 or 1; boolean values also accepted). `fast: 1` is the default; `--fast` also enables it. Use safe literal quoting or files for shell-sensitive text.

## Posts

```sh
sandhive draft post --file update.txt --account your_handle --style-file style.json --max-length 280 --json
sandhive draft post --account your_handle --style-file style.json --language English --max-length 280 --json
```

Text/file supplies material to `/cli/rewrite-twitter-post`; no text source uses `/cli/generate-news-twitter-post` with an optional request manifest or the server-side account manifest. JSON input accepts `user.account`, optional `post`, `max_length`, `language`, `manifest`, and `style_samples`. A JSON request without `post` selects manifest generation. `language` is only supported in manifest mode. Length must be an integer from 80 to 4000; omitted values use backend defaults (280 for news, 4000 for rewrite). Do not combine input with text/file or `--account` (use `user.account` in JSON).

## Output and errors

`--dry-run` returns endpoint, method, headers and exact wire payload without sending. Headers include `X-SandHive-Installation-Id: shf1_<sha256>`, computed in memory from hostname, home path, platform and architecture with a SandHive namespace. No identity files, hardware probes or subprocesses are used; raw inputs are not sent. It is stable across projects/updates when those inputs are unchanged, but is not guaranteed unique across cloned environments. The fingerprint goes only to SandHive API, not GitHub or other origins. Old UUID files and `SANDHIVE_HOME` are ignored. This ID is not authentication or an idempotency key; host network permissions still apply.

`--json` emits one JSON result and never prompts. `draft` contains `draft.text`, `draft.platform: x`, and raw `api` metadata; `no_draft` contains `draft: null`. No exact skip reason is inferred. `preview` describes the request. Errors contain `error.code`, message, retryability, and optional retry-after.

Exit codes: 0 success including no draft; 1 API/network failure; 2 invalid input or existing destination; 3 `NOT_IMPLEMENTED`. Rate limits preserve Retry-After. Timeout/network errors may have reached the server and are not retried automatically. Requests have a 20-minute timeout. No draft is published or recorded as approved.

## Skill installation and planned commands

`sandhive skill install --agent codex|claude --target <directory>` copies the skill and references into the project's host-specific skill folder and refuses overwrite. Installation is local, skips update checks, and returns a user-sendable live authorization prompt as `next_step` (also printed in terminal output). It names `https://api.sandhive.io`, selected input data and at most seven first-batch API requests: optional style lookup, one search up to 20 results, one post (one or two requests) and up to three replies. An agent already carrying out authorized live setup continues; otherwise the person reviews and sends the prompt. A printed prompt is not consent. Installation, simulation and dry-run requests do not authorize live service calls, and the skill cannot grant host permissions. See [network access and task scope](network-access.md). `review`, `auth`, and `usage` return `NOT_IMPLEMENTED` without network calls.

## Discovery and sample retrieval

`sandhive find --query "..." --query "..." --icp-description "..." --json` searches and scores posts. User searches require --icp-description "..." describing the project's own audience. Latest is the default. Scoring runs in up to five backend workers and returns gate_score (reply suitability) and icp_score (ICP fit), sorted by ICP fit then reply suitability. Options: max-items 1-50, query-type Latest/Top, min-icp-score numeric. `sandhive style --account handle --json` retrieves candidate messages; refresh and max-items 1-200 are optional. Both accept --input JSON, --dry-run, and --json. JSON fields: queries plus icp_description for search, user_id for style; do not combine JSON input with command flags.

Search returns opportunities/tweets with source evidence; empty results are valid. Invalid records and provider placeholders are excluded individually with `received_count`, `skipped_count` and `warnings`; valid records remain usable. A malformed top-level response is still an error. The `api.tweets` array is filtered too. Style returns style/samples and cache metadata; the bare CLI never automatically saves or applies samples. The agent can select original message texts and save local style_samples without a separate user authorship confirmation. Reuse local writing before retrieving more. Generated summaries cannot be samples. Requests may incur scraping/model usage.

## Fast mode and request timeout

All five API requests send numeric `"fast": 1` by default. This requests faster generation with slightly lower quality. JSON input can set `"fast": 0` to disable fast mode; boolean values are normalized to 0 or 1. The reply `--fast` flag explicitly enables the default mode.

The request timeout defaults to **20 minutes (1,200,000 ms)** and can be set with `--timeout <seconds>` (1-1200). Replies use one attempt by default; explicitly chosen `--attempts` can increase the limit to five for empty successful responses. Network/timeout/HTTP errors are not retried. A server or proxy may enforce a shorter timeout.

## News manifest input

Use `sandhive draft post --manifest "Sandhive CLI AGENTCI TOOL for twitter harness" --account your_handle --style-file style.json --json`, or `--manifest-file manifest.md` for UTF-8 text (BOM supported; file path required). JSON requests may contain `manifest`. Use only one source; manifest flags cannot be combined with --input. Manifest must be non-empty text and cannot be combined with rewrite text/post. Use `--dry-run` to see the exact manifest sent.

Request manifest overrides the server file for this generation only. Omit it to use the existing server manifest. The backend splits drafts on standalone `---` lines and randomly chooses one; use one brief when a specific angle is intended. Manifest supplies factual content and the intended message, never writing style. Human style samples are still mandatory.

## Style acquisition priority

Reuse available local original writing from saved samples, accessible user dialogue or files first. If more is needed, retrieve candidates with `sandhive style --account <handle> --json`. Ask for manual examples only for the remaining gap after these sources are exhausted. Select actual original message texts, never the generated style summary, and save source metadata without a separate user authorship declaration. CLI validation still requires at least three sourced human samples.

### Empty reply retries

`/cli/generate-tweet` always receives `t: 1`. Default: one attempt per conversation. Explicit `--attempts <1-5>` permits more attempts for empty successful responses only; network, timeout and HTTP/API errors are not retried. Results include actual `attempts`. Each request can incur generation usage. `--timeout <seconds>` accepts 1-1200 (default 1200). A dry run makes no attempts. Use `draft replies --input replies.json --concurrency <1-5> --progress --json` for different conversations concurrently, with independent ordered results; parallelism does not increase the default per-item attempt count.

## Concurrent replies to different conversations

Create a JSON array with one normal reply input per conversation. Account and samples can come from the automatically loaded profile:

```json
[
  { "tweet": "Actual text of the first selected conversation" },
  { "tweet": "Actual text of the second selected conversation" }
]
```

```sh
sandhive draft replies --input replies.json --concurrency 3 --progress --json
```

These are input placeholders, not conversations to submit unchanged. Limits: 1-20 items, 1-5 concurrent workers (default 1), one attempt per conversation by default. `--attempts` explicitly changes the per-item limit. A saved context `reply_concurrency` can supply the worker preference. Per-item samples override shared samples; otherwise explicit `--style-file`, context samples or default style apply. All inputs validate before any generation starts. `--dry-run` returns all payloads, headers, concurrency and the maximum request count without sending.

Output is one `status: batch` JSON object with `results` in input order, per-item `index`, `status`, draft/error, and summary counts. Completed items remain available if another fails. Exit 1 means at least one item failed; inspect successful items too. `--progress` writes start, waiting and completion messages to stderr, so stdout remains valid JSON. This is asynchronous concurrency within a running CLI command, not a detached job or resumable server task. No duplicate variants of the same reply are generated automatically.

## Local diagnostics and network errors

`sandhive doctor --json` checks Node.js, the computed fingerprint and readable project profile without a network request or file writes. It does not prove network/service availability. Network failures keep `NETWORK_ERROR` or `TIMEOUT` and include safe `error.details`: category (`dns`, `tls`, `connection`, `permission`, `timeout`, `network`), allowlisted reason code when known, endpoint without query, delivery uncertainty and a corrective hint. HTTP errors include the status. Raw exceptions, response bodies and unknown reason strings are not exposed. These categories do not establish that ChatGPT rejected a request. Never disable TLS verification or work around a host denial as a retry strategy.
