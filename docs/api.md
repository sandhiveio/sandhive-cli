# SandHive API

Reply drafting sends a JSON request to:

```text
POST https://api.sandhive.io/cli/generate-tweet
Content-Type: application/json
```

Inputs and results are documented in the [CLI reference](../skills/sandhive/references/cli.md). The public request uses the existing field names, including `externalRelies`.

A reply response can include:

```json
{
  "reply": "A draft reply for human review.",
  "wait": 1,
  "icp_score": 0,
  "cta_opportunity": 0,
  "gate_score": 0,
  "reply_mode": "default"
}
```

The CLI preserves the response in `api`. It does not interpret `wait` as a delay in seconds or scores as probabilities. `reply: false` means no draft was returned; the API does not always provide a specific reason.

Requests have a 120-second timeout and are not retried automatically. A timeout can occur after server-side processing has started. No idempotency, authentication, or usage contract is assumed. A deployment may reject requests until access is enabled. On October 4, 2026, an empty POST returned HTTP 200 with `reply: false`; this checks routing and input handling, not successful generation. Draft generation has been tested against mocked responses only.

Only the supplied conversation, account identifier, and writing guidance are submitted. The hosted service may process and retain request data. Use summaries appropriate for that service and avoid including secrets or confidential source material.

## Twitter discovery and style

POST https://api.sandhive.io/cli/search-score-tweets accepts queries, icp (sandhive or arc), max_items, query_type, and optional min_icp_score. It returns tweets, count, icp, queries, elapsed. Tweet rows include id, text, author, url, created_at, query, icp_profile, gate_score, icp_score, cta_opportunity. These are individual posts, not full conversation trees.

POST https://api.sandhive.io/cli/user-twitter-style accepts user_id, refresh, max_items. It returns user_id, style, samples, cached, elapsed; no tweets produces HTTP 404. The updated Python backend uses Apify for both methods and model scoring for discovery. Provider credentials remain on the backend.

The CLI uses the existing /cli gateway prefix for both new routes. Local source inspection confirms the Flask route contracts, and both gateway routes were checked live on October 5, 2026. Mocked CLI tests do not establish live provider availability. Requests share the 120-second timeout and no automatic retries.

Live verification on October 5, 2026: both gateway routes returned HTTP 400 for empty input. A one-item search returned a tweet with source URL and zero gate/ICP scores; that validates retrieval, not positive qualification. Style retrieval for sandhiveio returned a KaitoEasyAPI placeholder rather than account posts. The CLI now rejects this known placeholder with INVALID_RESPONSE in either endpoint. Genuine style retrieval remains unverified; the backend should filter provider placeholders before caching or scoring them.

### Discovery request example

```json
{
  "queries": ["\"first customers\" lang:en", "\"manual outreach\" lang:en"],
  "icp": "sandhive",
  "max_items": 10,
  "query_type": "Latest",
  "min_icp_score": 5
}
```

The optional minimum is measured in the backend's score units. The CLI does not convert scores into percentages. Use `--dry-run` to inspect the request without starting Apify or model calls.

### Style request example

```json
{
  "user_id": "your_handle",
  "refresh": false,
  "max_items": 40
}
```

To apply returned samples, place selected genuine samples in `.sandhive/context.json` under `examples`, then pass `--context` when drafting. Neither discovery nor style retrieval automatically updates that file. An account handle identifies a public profile; it does not authenticate the user's X account.
