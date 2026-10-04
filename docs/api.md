# Reply API

The current CLI sends one JSON request to:

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
