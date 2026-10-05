# API contract

All routes use POST JSON on `https://api.sandhive.io`:

| CLI mode | Route | Existing backend fields | Response field |
| --- | --- | --- | --- |
| `draft reply` | `/cli/generate-tweet` | `tweet`, `user.account`, `externalRelies`, optional `fast` | `reply` |
| `draft post` without supplied text | `/cli/generate-news-twitter-post` | `user.account`, `externalRelies`, optional `max_length`, `language` | `post` |
| `draft post` with supplied text | `/cli/rewrite-twitter-post` | `post`, `user.account`, `externalRelies`, optional `max_length` | `post` |

The Python application exposes the corresponding routes without `/cli`; deployment must map the public prefix for all three. The reply URL was previously confirmed reachable with an empty request. New public post routes and actual paid generation have not been verified live. Offline tests verify URL selection, payloads, and response handling against the inspected Python contract.

The news generator reads the account's server-side manifest. It accepts no local topic/update/context field. The rewrite generator uses supplied `post` text. No invented server fields are sent.

`style_samples` is a local CLI field: at least three original messages, each with non-empty text/source and `authorship: human`. Only sample text is sent in `externalRelies`. Reply context supplements these samples with explicitly labeled factual context/preferences. No sample can be replaced with an AI-generated voice description. The CLI cannot independently prove authorship; callers must establish it from original sources or the user's explicit assertion.

A successful response contains the mode's text field as a non-empty string or false. False normalizes to `no_draft`; metadata is preserved without interpreting scores as probabilities or `wait` as seconds. HTTP errors, non-JSON responses, and incorrect text fields are explicit errors. There are no automatic retries, authentication, idempotency, or spending-limit contracts yet. Inputs are processed by a hosted service; do not send secrets or confidential material.

## Discovery and sample retrieval

POST /cli/search-score-tweets uses queries, icp (sandhive/arc), optional max_items, query_type, and min_icp_score. POST /cli/user-twitter-style uses user_id, optional refresh and max_items. Search preserves post evidence; scores are not probabilities. Style returns candidate samples and cache metadata. Confirm original human authorship before using samples. Generated summaries are not samples. Shared postJson handles HTTP and timeout errors.
