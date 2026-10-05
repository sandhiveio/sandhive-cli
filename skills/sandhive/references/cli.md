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

Creates `.sandhive/context.json`, never overwriting a profile. Add confirmed `style_samples` before drafting. Only an explicit `--context` loads it. Product/audience/facts and voice preferences supplement reply requests; source metadata is not sent. Post rewriting gets its factual material from the supplied text. News generation uses a server manifest, not local context facts.

## Replies

```sh
sandhive draft reply --file conversation.txt --context .sandhive/context.json --json
sandhive draft reply --text "..." --account your_handle --style-file style.json --dry-run --json
sandhive draft reply --input request.json --style-file style.json --json
```

Exactly one of text/file/input is required. File and input accept `-` for stdin; context/style files must be paths. Request JSON uses `tweet`, `user.account`, optional `style_samples`, and optional boolean `fast`. `--fast` also sets the API fast flag. Use safe literal quoting or files for shell-sensitive text.

## Posts

```sh
sandhive draft post --file update.txt --account your_handle --style-file style.json --max-length 280 --json
sandhive draft post --account your_handle --style-file style.json --language English --max-length 280 --json
```

Text/file supplies material to `/cli/rewrite-twitter-post`; no text source uses `/cli/generate-news-twitter-post` and its server-side account manifest. JSON input accepts `user.account`, optional `post`, `max_length`, `language`, and `style_samples`. A JSON request without `post` selects manifest generation. `language` is only supported in manifest mode. Length must be an integer from 80 to 4000; omitted values use backend defaults (280 for news, 4000 for rewrite). Do not combine input with text/file or `--account` (use `user.account` in JSON).

## Output and errors

`--dry-run` returns endpoint, method, and exact wire payload without sending. `--json` emits one JSON result and never prompts. `draft` contains `draft.text`, `draft.platform: x`, and raw `api` metadata; `no_draft` contains `draft: null`. No exact skip reason is inferred. `preview` describes the request. Errors contain `error.code`, message, retryability, and optional retry-after.

Exit codes: 0 success including no draft; 1 API/network failure; 2 invalid input or existing destination; 3 `NOT_IMPLEMENTED`. Rate limits preserve Retry-After. Timeout/network errors may have reached the server and are not retried automatically. Requests have a 120-second timeout. No draft is published or recorded as approved.

## Skill installation and planned commands

`sandhive skill install --agent codex|claude --target <directory>` copies the skill and references into the project's host-specific skill folder and refuses overwrite. `review`, `auth`, and `usage` return `NOT_IMPLEMENTED` without network calls.

## Discovery and sample retrieval

`sandhive find --query "..." --query "..." --icp sandhive --json` searches and scores posts. ICP supports sandhive/arc only. Options: max-items 1-50, query-type Latest/Top, min-icp-score numeric. `sandhive style --account handle --json` retrieves candidate messages; refresh and max-items 1-200 are optional. Both accept --input JSON, --dry-run, and --json. JSON fields: queries/icp for search, user_id for style; do not combine JSON input with command flags.

Search returns opportunities/tweets with source evidence; empty results are valid. Style returns style/samples and cache metadata; it never automatically saves or applies samples. Confirm human authorship before creating local style_samples. Generated summaries cannot be samples. Provider placeholders are rejected. Requests may incur scraping/model usage; no automatic retries.
