# CLI reference

## Human style (required for every draft)

Supply `--style-file <file>` containing a JSON array, or `style_samples` in request JSON or an explicit context file. At least three items are required:

```json
{ "text": "Original message written by the user", "source": "URL or supplied file/location", "authorship": "human" }
```

These are placeholders, not usable samples. Never mark generated, rewritten, or unknown-origin text as human. The CLI verifies the assertion structure, not actual authorship. Missing samples produce `INVALID_INPUT`, exit 2, before sending. Explicit request samples take precedence over context samples; invalid explicit samples do not fall back to context. Source references and authorship metadata stay local. The API receives message text through its existing `externalRelies` field. `--voice` and legacy `examples` are not an alternate sample source. Free-form request fields `externalRelies`, `style_prompt`, and `style` are rejected.

## Local context

```sh
sandhive init --product "..." --audience "..." --account your_handle --voice "..." --fact "..."
```

Creates `.sandhive/context.json`, never overwriting a profile. Add confirmed `style_samples` before drafting. Only an explicit `--context` loads it. Product/audience/facts and voice preferences supplement reply requests; source metadata is not sent. Post rewriting gets its factual material from the supplied text. News generation uses an explicit manifest when supplied, otherwise the server manifest. Local context facts are not uploaded automatically.

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

`--dry-run` returns endpoint, method, and exact wire payload without sending. `--json` emits one JSON result and never prompts. `draft` contains `draft.text`, `draft.platform: x`, and raw `api` metadata; `no_draft` contains `draft: null`. No exact skip reason is inferred. `preview` describes the request. Errors contain `error.code`, message, retryability, and optional retry-after.

Exit codes: 0 success including no draft; 1 API/network failure; 2 invalid input or existing destination; 3 `NOT_IMPLEMENTED`. Rate limits preserve Retry-After. Timeout/network errors may have reached the server and are not retried automatically. Requests have a 20-minute timeout. No draft is published or recorded as approved.

## Skill installation and planned commands

`sandhive skill install --agent codex|claude --target <directory>` copies the skill and references into the project's host-specific skill folder and refuses overwrite. `review`, `auth`, and `usage` return `NOT_IMPLEMENTED` without network calls.

## Discovery and sample retrieval

`sandhive find --query "..." --query "..." --icp-description "..." --json` searches and scores posts. User searches require --icp-description "..." describing the project's own audience. Latest is the default. Scoring runs in up to five backend workers and returns gate_score (reply suitability) and icp_score (ICP fit), sorted by ICP fit then reply suitability. Options: max-items 1-50, query-type Latest/Top, min-icp-score numeric. `sandhive style --account handle --json` retrieves candidate messages; refresh and max-items 1-200 are optional. Both accept --input JSON, --dry-run, and --json. JSON fields: queries plus icp_description for search, user_id for style; do not combine JSON input with command flags.

Search returns opportunities/tweets with source evidence; empty results are valid. Style returns style/samples and cache metadata; it never automatically saves or applies samples. Confirm human authorship before creating local style_samples. Generated summaries cannot be samples. Provider placeholders are rejected. Requests may incur scraping/model usage; no automatic retries.

## Fast mode and request timeout

All five API requests send numeric `"fast": 1` by default. This requests faster generation with slightly lower quality. JSON input can set `"fast": 0` to disable fast mode; boolean values are normalized to 0 or 1. The reply `--fast` flag explicitly enables the default mode.

The client timeout is **20 minutes (1,200,000 ms)** per request, including reading the response body. Requests are not retried automatically. A server or proxy may enforce its own shorter timeout.

## News manifest input

Use `sandhive draft post --manifest "Sandhive CLI AGENTCI TOOL for twitter harness" --account your_handle --style-file style.json --json`, or `--manifest-file manifest.md` for UTF-8 text (BOM supported; file path required). JSON requests may contain `manifest`. Use only one source; manifest flags cannot be combined with --input. Manifest must be non-empty text and cannot be combined with rewrite text/post. Use `--dry-run` to see the exact manifest sent.

Request manifest overrides the server file for this generation only. Omit it to use the existing server manifest. The backend splits drafts on standalone `---` lines and randomly chooses one; use one brief when a specific angle is intended. Manifest supplies factual content and the intended message, never writing style. Human style samples are still mandatory.

## Style acquisition priority

First retrieve candidates with `sandhive style --account <handle> --json` unless confirmed samples are already saved. Then use accessible human chats/dialogues/files if retrieval is unavailable or insufficient. Ask for manual examples only for the remaining gap. Select actual samples, never the generated style summary. Show uncertain candidates with sources for authorship review; reuse established human originals without repeatedly asking. CLI validation still requires at least three sourced human samples.
