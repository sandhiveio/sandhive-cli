# Terminal workflow

The examples use sandhive as shorthand for node <checkout>/bin/sandhive.js; see [installation](installation.md). Keep commands in your project directory.

## Use from your terminal

### 1. Describe your project

Run this from your project's directory, replacing the example values:

```sh
sandhive init --product "A tool for organizing user feedback" --audience "Early-stage founders" --account your_handle --voice "Concise, practical, no hype" --fact "Feedback can be grouped by topic"
```

This creates `.sandhive/context.json` locally without an API request. Edit it as your product changes. Add only verified facts; repeat `--fact` as needed. Style samples are supplied separately in the next step. Existing profiles are never overwritten. The default `.sandhive` directory gets its own Git ignore file.

The profile belongs to the project where the agent runs, not the CLI package. Keep the working directory at your project root and invoke the CLI by its absolute path if it is installed elsewhere. Each project has its own `.sandhive/context.json`, `.sandhive/style.json` and agent-managed `.sandhive/posts.json`. Automatic loading never falls back to the package, home or parent directories. Explicit profile flags can select another file when intended.

### 2. Retrieve your style first

With an agent, reuse original writing already available in local samples, files or accessible user dialogue first. If more is needed, retrieve account messages with `sandhive style --account your_handle --json`. The agent selects usable originals and saves them with source metadata without asking for a separate authorship declaration. Manual examples are a last resort for the remaining gap.

### Human-written sample format

Save at least three established human originals in `.sandhive/style.json`. Use retrieved or existing messages; supply them manually only when needed:

```json
[
  { "text": "Paste your first original message", "source": "Your message URL or supplied file/location", "authorship": "human" },
  { "text": "Paste your second original message", "source": "Your message URL or supplied file/location", "authorship": "human" },
  { "text": "Paste your third original message", "source": "Your message URL or supplied file/location", "authorship": "human" }
]
```

Replace these placeholders with your own writing. **Original human writing is important for style quality; exclude known AI drafts and rewrites.** The agent can select original messages from available sources and fill authorship metadata without a separate user declaration. The CLI validates metadata and source references; it cannot independently prove authorship. At least three usable samples are required. `--voice` adds preferences; it cannot substitute for real samples. You can also store this array as `style_samples` in your context.

### 3. Preview a reply request

```sh
sandhive draft reply --text "We shipped our first release. How do we find useful conversations with potential users?" --context .sandhive/context.json --style-file .sandhive/style.json --dry-run
```

The preview shows exactly what would be sent and makes no API call. The account saved in your context is used unless you supply `--account`.

### 4. Request a draft and review it

Run the same command without `--dry-run`:

```sh
sandhive draft reply --text "We shipped our first release. How do we find useful conversations with potential users?" --context .sandhive/context.json --style-file .sandhive/style.json
```

Check the facts, tone, and contribution to the conversation. Edit the text and publish it manually in X when ready. The service may return no draft; that is a valid outcome.

For a longer conversation, use `--file conversation.txt` instead of `--text`. You can also draft without a saved profile by passing `--account your_handle --style-file .sandhive/style.json`.

Reply requests send the conversation, account identifier, human sample text and guidance from the selected project context. Draft commands automatically load `.sandhive/context.json` and, when no input/context samples are present, `.sandhive/style.json` from the current project. Explicit `--context` and `--style-file` select other files; `--no-profile` skips automatic loading. Previews include local profile source paths; source files are not uploaded wholesale. Keep secrets and confidential material out of these profiles and requests.

## Draft a post

Rewrite supplied material into a post using your human-written style:

```sh
sandhive draft post --file update.txt --context .sandhive/context.json --style-file .sandhive/style.json --max-length 280 --json
```

Use verified updates in `update.txt`. For news-post generation, prepare `manifest.md` with verified project facts, one recent news angle, source-backed facts and dates, then generate:

```sh
sandhive draft post --manifest-file manifest.md --account your_handle --style-file .sandhive/style.json --language English --max-length 280 --json
```

On a successful `draft` result, save only `draft.text` as UTF-8 `news-draft.txt`, check its facts, and restyle it:

```sh
sandhive draft post --file news-draft.txt --account your_handle --style-file .sandhive/style.json --max-length 280 --json
```

Review the rewritten text before publishing. If generation or rewrite fails or returns `no_draft`, stop that chain; do not retry automatically. The intermediate generated text is content to rewrite, never a human style sample.

Short briefs can use `--manifest "..."`. The supplied text overrides the server manifest for this request; it does not update a server file. Omitting manifest and post text uses the account's server manifest. Do not combine manifest with rewrite text. Local project facts are not uploaded automatically: include them in the brief. `--language` applies only to news generation. Add `--dry-run` to preview an individual request. See the [post workflow](../skills/sandhive/references/post-workflow.md) and [registry contract](../skills/sandhive/references/publication-registry.md) for the agent-managed process.

## For agents and scripts

Add `--json` for one structured result. The existing JSON input remains available:

```sh
sandhive draft reply --input examples/reply.json --style-file .sandhive/style.json --dry-run --json
```

Results distinguish a draft, no draft, a preview, and an error. Commands do not prompt. Replies use one attempt by default; retries for empty responses require an explicit `--attempts` limit. Network/timeout/HTTP failures are not retried. See the [CLI reference](../skills/sandhive/references/cli.md) for fields and exit codes, and [API notes](api.md) for service details and verification status.

## Find conversations and retrieve candidate samples

```sh
sandhive find --query "what are you building" --query "content distribution founder" --icp-description "Founders and expert-led teams who ship product but need help turning work into posts and finding useful conversations. They approve every post themselves. Exclude generic consumers, meme accounts, and autonomous posting bots." --json
sandhive style --account your_handle --json
```

Search requires `--icp-description` describing your actual target audience. For your own product, describe its actual audience, problem, desired outcome, and exclusions. Latest tweets are fetched by default; up to five backend workers score reply suitability and ICP fit. Scores are ranking signals, not proof of intent. The skill returns ranked opportunities with ICP reasons, a reply angle, and context readiness, then always provides a concrete reply-generation next step. If replies were already requested, it generates them through the CLI; otherwise it offers a simple candidate choice. Style retrieves additional messages when local writing is insufficient; select original texts without a separate authorship confirmation. Generated style summaries are never samples. See the CLI reference for limits and refresh options.

## Fast mode and request timeout

All five API requests send numeric `"fast": 1` by default. This requests faster generation with slightly lower quality. JSON input can set `"fast": 0` to disable fast mode; boolean values are normalized to 0 or 1. The reply `--fast` flag explicitly enables the default mode.

The request timeout defaults to **20 minutes (1,200,000 ms)** and can be set with `--timeout <seconds>` (1-1200). Replies use one attempt by default; explicitly chosen `--attempts` can increase the limit to five for empty successful responses. Network/timeout/HTTP errors are not retried. A server or proxy may enforce a shorter timeout.

## Troubleshooting

Run `sandhive doctor --json` to check Node.js, the fingerprint and readable local profile without network access or file writes. Live network/HTTP errors include `error.details.category`, endpoint, delivery uncertainty and a corrective hint. Safe codes distinguish DNS, TLS, connection and environment permission failures without exposing raw exceptions or response bodies.

| Result | Next step |
| --- | --- |
| `INVALID_INPUT` | Check the named field and selected original writing samples. Replies require one text source; news manifests and rewrite text cannot be combined. Supply an account directly or in your context. |
| `ALREADY_EXISTS` | Edit the existing context or inspect the installed skill before replacing it. |
| `NETWORK_ERROR` details | Use `error.details.category`, safe reason code, endpoint and hint to distinguish DNS, TLS, connection and permission failures. Raw exception messages are not exposed. |
| `no_draft` | Review the supplied conversation or choose another. The API may not provide the exact reason. |
| `RATE_LIMITED` | Respect `retry_after` in JSON output before trying again. |
| `TIMEOUT` / `NETWORK_ERROR` | The request may have reached the server. Avoid repeatedly submitting the same request; see [API notes](api.md). |
| `NOT_IMPLEMENTED` | The command is planned. Use the current reply workflow; see the [roadmap](roadmap.md). |

## Development and release terms

Run `npm test` for the offline test suite. Keep project files and commit messages in English.

Distribution and service terms are being finalized. This repository does not currently grant an open-source license; the npm package remains private until release terms are ready.

### Empty reply retries

`/cli/generate-tweet` always receives `t: 1`. Default: one attempt per conversation. Explicit `--attempts <1-5>` permits more attempts for empty successful responses only; network, timeout and HTTP/API errors are not retried. Results include actual `attempts`. Each request can incur generation usage. `--timeout <seconds>` accepts 1-1200 (default 1200). A dry run makes no attempts. Use `draft replies --input replies.json --concurrency <1-5> --progress --json` for different conversations concurrently, with independent ordered results; parallelism does not increase the default per-item attempt count.

### Generate different replies concurrently

Save the actual conversation texts in a JSON array (use `user.account` per item when no account is saved):

```json
[
  { "tweet": "Actual text of the first selected conversation" },
  { "tweet": "Actual text of the second selected conversation" }
]
```

With your saved project context and original style samples:

```sh
sandhive draft replies --input replies.json --concurrency 3 --progress --json
```

Choose 1-5 workers; the default is three, or a saved context `reply_concurrency`. Batch size is 1-20 conversations. Each uses one API attempt unless `--attempts` is chosen. The result contains one entry per input in input order and keeps successful drafts if another fails. Progress goes to stderr; stdout remains one JSON object. `--dry-run` previews every payload and the maximum request count. This is concurrency in a running command, not a detached/resumable job. See the [CLI reference](../skills/sandhive/references/cli.md) for input precedence and result fields.

Search results now include `received_count`, `skipped_count` and warnings. Invalid rows or provider placeholders are removed individually; valid posts remain available. A malformed top-level response still fails explicitly.

## Optional updates

From your `sandhive-cli` checkout:

```sh
git pull --ff-only
```

The CLI displays the beta notice on every run (in JSON results, it appears as `notice`). Interactive live service commands also check GitHub for newer commits, without downloading or applying updates. The check has short time limits and failures do not fail your command. Local commands (`init`, `doctor`, `skill path`, `skill install`, help/version and planned commands), JSON output, dry runs, and non-interactive runs skip this network check. Set `SANDHIVE_NO_UPDATE_CHECK=1` to disable automatic checks. If Git reports divergent branches or local changes, review them before updating.

Installed agent skills are copies: after updating the repository, refresh those copies as needed so your agent uses the current workflow.

