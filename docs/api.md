# API contract

All routes use POST JSON on `https://api.sandhive.io`:

| CLI mode | Route | Existing backend fields | Response field |
| --- | --- | --- | --- |
| `draft reply` | `/cli/generate-tweet` | `tweet`, `user.account`, `externalRelies`, optional `fast` | `reply` |
| `draft post` without supplied text | `/cli/generate-news-twitter-post` | `user.account`, `externalRelies`, optional `max_length`, `language`, `manifest` | `post` |
| `draft post` with supplied text | `/cli/rewrite-twitter-post` | `post`, `user.account`, `externalRelies`, optional `max_length` | `post` |

The Python application exposes the corresponding routes without `/cli`; deployment must map the public prefix for all three. The reply URL was previously confirmed reachable with an empty request. New public post routes and actual paid generation have not been verified live. Offline tests verify URL selection, payloads, and response handling against the inspected Python contract.

The news generator accepts optional `manifest` as non-empty text. It uses that text instead of reading the account's server-side manifest, for this request only. Omitted manifest falls back to the server file. The backend also falls back for empty/non-string manifest, but the CLI rejects those values to avoid unintentionally using a different brief. Local context is not automatically converted to manifest. The backend splits multiple drafts on lines containing `---` and randomly selects one; send a single brief for a specific angle. The rewrite generator uses supplied `post` text. No invented server fields are sent.

`style_samples` is a local CLI field: at least three original messages, each with non-empty text/source and `authorship: human`. Only sample text is sent in `externalRelies`. Reply context supplements these samples with explicitly labeled factual context/preferences. No sample can be replaced with an AI-generated voice description. The CLI cannot independently prove authorship; callers must establish it from original sources or the user's explicit assertion.

A successful response contains the mode's text field as a non-empty string or false. False normalizes to `no_draft`; metadata is preserved without interpreting scores as probabilities or `wait` as seconds. HTTP errors, non-JSON responses, and incorrect text fields are explicit errors. Replies retry empty text up to five total attempts; there are no authentication, idempotency, or spending-limit contracts yet. Inputs are processed by a hosted service; do not send secrets or confidential material.

## Discovery and sample retrieval

POST /cli/search-score-tweets uses queries, icp_description (required non-empty ICP text for user requests), optional max_items, query_type, and min_icp_score. POST /cli/user-twitter-style uses user_id, optional refresh and max_items. Search preserves post evidence; scores are not probabilities. Style returns candidate samples and cache metadata. Confirm original human authorship before using samples. Generated summaries are not samples. Shared postJson handles HTTP and timeout errors.

## Fast mode and request timeout

All five API requests send numeric `"fast": 1` by default. This requests faster generation with slightly lower quality. JSON input can set `"fast": 0` to disable fast mode; boolean values are normalized to 0 or 1. The reply `--fast` flag explicitly enables the default mode.

The client timeout is **20 minutes (1,200,000 ms)** per request, including reading the response body. Reply requests retry empty text up to five total attempts; network/timeout/HTTP errors and other methods are not retried automatically. A server or proxy may enforce its own shorter timeout.

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

`/cli/generate-tweet` always receives `t: 1`. On a successful JSON response with missing, null, false, empty, or whitespace-only reply text, the CLI makes up to five attempts total (the initial request plus four retries). It stops as soon as text is returned; after exhaustion it returns `no_draft`. Reply results include `attempts`. Each attempt can incur generation usage and has its own 20-minute timeout. No retries are made for HTTP errors, API errors, malformed responses, network failures, or timeouts. Post/search/style calls are unchanged. A dry run makes no attempts.
