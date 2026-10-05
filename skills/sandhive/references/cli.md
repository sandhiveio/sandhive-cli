# CLI reference

## Available commands

```sh
sandhive init --product "Your product" --audience "Your audience" --account your_handle --voice "Your writing voice"
sandhive draft reply --text "The conversation text" --context .sandhive/context.json --dry-run --json
sandhive draft reply --file .sandhive/conversation.txt --context .sandhive/context.json --json
sandhive draft reply --input .sandhive/reply.json --context .sandhive/context.json --json
sandhive draft reply --input .sandhive/reply.json --dry-run --json
sandhive skill install --agent codex --target .
sandhive skill install --agent claude --target .
```

`init` requires `--product` and `--audience`. It writes `.sandhive/context.json` without a network request, or a custom path supplied with `--context`. Optional flags: `--voice`, `--account`, repeated `--fact`, and repeated `--example`. The default voice is clear, concise, and specific. Existing context is never overwritten. The default `.sandhive` directory gets a local `.gitignore`; choose appropriate version-control handling for custom locations.

For replies, use exactly one of `--text`, `--file`, or `--input`. `--file -` reads plain text from stdin; `--input -` reads JSON. `--account` accepts an optional leading `@` and is available with `--text` or `--file`; when omitted, the account comes from an explicitly supplied context. With JSON input, set `user.account` in that input instead. `--fast` forwards the API's existing fast option. Context is never discovered or uploaded automatically; pass `--context` to use it.

Skill installation copies this folder into the selected project's skill directory and refuses to overwrite an existing installation.

## Input

```json
{
  "tweet": "The actual conversation text",
  "user": { "account": "your_x_handle" },
  "externalRelies": [
    "A concise description of the user's voice.",
    "A genuine writing example or additional guidance.",
    "Another writing example or factual constraint."
  ]
}
```

Supported optional input fields: `externalRelies` (string array), `style_prompt` (string), `style` (string), and `fast` (boolean). The CLI requires a non-empty `tweet` and a valid `user.account`. The account field is a profile identifier, not an authentication credential.

With `--context`, the CLI places the product, audience, facts, voice, examples, and supplied writing guidance in `externalRelies`. Only the summary is sent; source files and `sources` metadata are not uploaded. The API has no dedicated project-context field in this version. The API may apply its own generation rules, so review the result.

## Results

JSON output contains `schema_version: 1` and a `status`:

- `draft`: `draft.text` is ready for review; `api` contains the API response.
- `no_draft`: `draft` is null; the API returned `reply: false`. This is a successful response with no draft, not proof of a particular rejection reason.
- `preview`: the endpoint, method, and payload are shown; no request was sent.
- `ok`: help, version, or skill installation completed.
- `error`: `error.code`, `message`, `retryable`, and `retry_after` describe the failure.

Exit codes: `0` success (including no draft), `1` API/network/response failure, `2` invalid input or installation conflict, `3` planned command.

Common error codes: `INVALID_INPUT`, `ALREADY_EXISTS`, `FILE_ERROR`, `RATE_LIMITED`, `API_ERROR`, `INVALID_RESPONSE`, `NETWORK_ERROR`, `TIMEOUT`, `NOT_IMPLEMENTED`. For HTTP 429, `retry_after` preserves the server's Retry-After header, which can be seconds or an HTTP date. Other failures are not marked automatically retryable because the server may already have processed the request.

## Planned commands

`draft post`, `review`, `auth`, and `usage` return `NOT_IMPLEMENTED` and make no API calls. Persistent history, approval storage, publishing, authentication, PoW activation, and spending controls are not implemented.

## Discovery and writing samples

`sandhive find --query "finding first customers lang:en" --icp sandhive --max-items 10 --query-type Latest --min-icp-score 5 --json`

Repeat --query for multiple searches. ICP is required and must be sandhive or arc (predefined backend profiles). max-items is 1–50 (default 20), query-type is Latest or Top (default Latest), min-icp-score is an optional finite number in the backend's score units. JSON input uses queries (non-empty string array), icp, max_items, query_type, min_icp_score. Custom product descriptions are not accepted as ICP profiles.

`sandhive style --account your_handle --max-items 40 --refresh --json`

Style max-items is 1–200 (default 40). refresh is false by default. JSON input uses user_id, max_items, refresh. Both commands accept --input file or --input - instead of flags, and --dry-run previews without sending. Input JSON and command-specific flags cannot be mixed.

Results: opportunities contains tweets, count, and api; style contains style, samples, cached, and api. Empty search results succeed. Missing style can return HTTP 404 (API_ERROR). Responses preserve backend metadata, including elapsed, scores, and source URLs. Neither command saves files, retrieves complete conversation threads, publishes, or applies voice to future drafts automatically. Save selected samples as context examples or externalRelies when drafting. cached is the backend's indicator; it does not guarantee freshness.
