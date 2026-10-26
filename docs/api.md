# API contract

All routes use POST JSON on `https://api.sandhive.io`:

All five service requests carry `X-SandHive-Installation-Id: shf1_<sha256>`. The CLI computes it in memory using a SandHive namespace plus hostname, home path, platform and architecture. No identity files, hardware probes or subprocesses are used; raw inputs are not sent. Stable inputs yield a stable fingerprint across projects and updates; host/profile changes can change it, and clones can share it. Old UUID files and `SANDHIVE_HOME` are ignored. It is transport metadata, not a JSON field, credential or idempotency key. Server-side storage/aggregation is not implemented by the CLI. Other API origins and GitHub update checks do not receive it.

| CLI mode | Route | Existing backend fields | Response field |
| --- | --- | --- | --- |
| `draft reply` | `/cli/generate-tweet` | `tweet`, `user.account`, `externalRelies`, optional `fast` | `reply` |
| `draft post` without supplied text | `/cli/generate-news-twitter-post` | `user.account`, `externalRelies`, optional `max_length`, `language`, `manifest` | `post` |
| `draft post` with supplied text | `/cli/rewrite-twitter-post` | `post`, `user.account`, `externalRelies`, optional `max_length` | `post` |

The Python application exposes the corresponding routes without `/cli`; deployment must map the public prefix for all three. The reply URL was previously confirmed reachable with an empty request. New public post routes and actual paid generation have not been verified live. Offline tests verify URL selection, payloads, and response handling against the inspected Python contract.

The news generator accepts optional `manifest` as non-empty text. It uses that text instead of reading the account's server-side manifest, for this request only. Omitted manifest falls back to the server file. The backend also falls back for empty/non-string manifest, but the CLI rejects those values to avoid unintentionally using a different brief. Local context is not automatically converted to manifest. The backend splits multiple drafts on lines containing `---` and randomly selects one; send a single brief for a specific angle. The rewrite generator uses supplied `post` text. No invented server fields are sent.

`style_samples` is a local CLI field: at least three original messages, each with non-empty text/source and `authorship: human`. Only sample text is sent in `externalRelies`. Reply context supplements these samples with explicitly labeled factual context/preferences. No sample can be replaced with an AI-generated voice description. The CLI cannot independently prove authorship; the agent selects original writing from available sources without requiring a separate user declaration.

A successful response contains the mode's text field as a non-empty string or false. False normalizes to `no_draft`; metadata is preserved without interpreting scores as probabilities or `wait` as seconds. HTTP errors, non-JSON responses, and incorrect text fields are explicit errors. Replies use one attempt by default, with explicitly configurable empty-response attempts; there are no authentication, idempotency, or spending-limit contracts yet. Inputs are processed by a hosted service; do not send secrets or confidential material.

## Discovery and sample retrieval

POST /cli/search-score-tweets uses queries, icp_description (non-empty audience/problem/intent description for user requests), optional max_items, query_type, and min_icp_score. POST /cli/user-twitter-style uses user_id, optional refresh and max_items. Search preserves post evidence; scores are not probabilities. Style returns candidate samples and cache metadata. Select original message texts without a separate authorship confirmation. Generated summaries are not samples. Shared postJson handles installation headers, HTTP and timeout errors.

## Fast mode and request timeout

All five API requests send numeric `"fast": 1` by default. This requests faster generation with slightly lower quality. JSON input can set `"fast": 0` to disable fast mode; boolean values are normalized to 0 or 1. The reply `--fast` flag explicitly enables the default mode.

The request timeout defaults to **20 minutes (1,200,000 ms)** and can be set with `--timeout <seconds>` (1-1200). Replies use one attempt by default; explicitly chosen `--attempts` can increase the limit to five for empty successful responses. Network/timeout/HTTP errors are not retried. A server or proxy may enforce a shorter timeout.

## Request manifest

```json
{
  "user": { "account": "your_handle" },
  "manifest": "Sandhive CLI AGENTCI TOOL for twitter harness",
  "externalRelies": ["First original human message", "Second original human message", "Third original human message"],
  "language": "English",
  "max_length": 280,
  "fast": 1
}
```

This wire-payload example uses placeholders for human samples. In CLI JSON input, supply sourced `style_samples` instead of `externalRelies`; the CLI converts them. Manifest is content/brief, never a style sample. `manifest` is supported only by the news generator, not the rewrite or reply endpoints. No server manifest file is changed.

Search defaults to `query_type: Latest`. The backend scores individual tweets in up to five parallel workers for reply suitability (`gate_score`) and ICP fit (`icp_score`), returning rows sorted by ICP score then gate score. `min_icp_score` filters scored results. Pass an explicit description of the project audience, problem, intent, and exclusions for ICP scoring. These are ranking signals, not probabilities or validated demand. Public CLI requests use `/cli/search-score-tweets`, mapped to the Flask `/search-score-tweets` route.

### Empty reply retries

`/cli/generate-tweet` always receives `t: 1`. Default: one attempt per conversation. Explicit `--attempts <1-5>` permits more attempts for empty successful responses only; network, timeout and HTTP/API errors are not retried. Results include actual `attempts`. Each request can incur generation usage. `--timeout <seconds>` accepts 1-1200 (default 1200). A dry run makes no attempts. Use `draft replies --input replies.json --concurrency <1-5> --progress --json` for different conversations concurrently, with independent ordered results; parallelism does not increase the default per-item attempt count.
