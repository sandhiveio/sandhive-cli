# SandHive CLI

**Draft useful X replies in your project's voice.**

Bring a conversation and a few verified product facts. SandHive helps you prepare a reply to review and publish yourself — from your terminal or through an agent such as Codex or Claude Code.

[Website](https://www.sandhive.io) · [CLI reference](skills/sandhive/references/cli.md) · [Roadmap](docs/roadmap.md) · [Issues](https://github.com/sandhiveio/sandhive-cli/issues)

> Early preview: reply drafting, local project context, and agent skill installation are available. Discovery, standalone posts, persistent review, and key activation are planned. There is no automatic publishing or npm release yet.

## What a useful reply looks like

**Conversation:** “We shipped our first release, but finding useful conversations with potential users has been harder than building it. What has worked for other founders?”

**Context:** Your product helps founders organize user feedback. Your voice is concise and practical.

**Illustrative draft:** “Pick one problem your product solves and look for people describing it in their own words. Answer the question they actually asked, then use their follow-up questions to decide what to explain next.”

The example shows the intended workflow, not a recorded API result. Replies should add something useful; a product link is optional.

## Install

Requires **Node.js 22 or later**. Install from source while the npm release is being prepared:

```sh
git clone https://github.com/sandhiveio/sandhive-cli.git
cd sandhive-cli
npm link
sandhive --help
```

## Use with your agent

From the directory of the project you want to talk about, install the skill for your agent:

```sh
sandhive skill install --agent codex --target .
# Or:
sandhive skill install --agent claude --target .
```

Then ask:

> Use SandHive to prepare this project's audience, verified facts, and writing voice from the available documentation. Preview the request, then draft a reply to this conversation for my review. My X handle is @your_handle. Conversation: [paste the post and relevant surrounding text].

The agent prepares a compact local profile, calls the CLI, and helps you review the draft. It uses sources available in its session; access to other chats is not assumed. The same [skill](skills/sandhive/SKILL.md) is used for both agents.

## Use from your terminal

### 1. Describe your project

Run this from your project's directory, replacing the example values:

```sh
sandhive init --product "A tool for organizing user feedback" --audience "Early-stage founders" --account your_handle --voice "Concise, practical, no hype" --fact "Feedback can be grouped by topic"
```

This creates `.sandhive/context.json` locally without an API request. Edit it as your product changes. Add only verified facts; `--fact` and `--example` can be repeated. Existing profiles are never overwritten. The default `.sandhive` directory gets its own Git ignore file.

### 2. Preview a reply request

```sh
sandhive draft reply --text "We shipped our first release. How do we find useful conversations with potential users?" --context .sandhive/context.json --dry-run
```

The preview shows exactly what would be sent and makes no API call. The account saved in your context is used unless you supply `--account`.

### 3. Request a draft and review it

Run the same command without `--dry-run`:

```sh
sandhive draft reply --text "We shipped our first release. How do we find useful conversations with potential users?" --context .sandhive/context.json
```

Check the facts, tone, and contribution to the conversation. Edit the text and publish it manually in X when ready. The service may return no draft; that is a valid outcome.

For a longer conversation, use `--file conversation.txt` instead of `--text`. You can also draft without a saved profile by passing `--account your_handle`.

Only the supplied conversation, account identifier, and writing guidance are sent to the hosted service. Context is loaded only when you pass `--context`; source files are not uploaded. Keep secrets and confidential material out of requests.

## For agents and scripts

Add `--json` for one structured result. The existing JSON input remains available:

```sh
sandhive draft reply --input examples/reply.json --dry-run --json
```

Results distinguish a draft, no draft, a preview, and an error. Commands do not prompt, and requests are not retried automatically. See the [CLI reference](skills/sandhive/references/cli.md) for fields and exit codes, and [API notes](docs/api.md) for service details and verification status.

## Troubleshooting

| Result | Next step |
| --- | --- |
| `INVALID_INPUT` | Check the named field. Use exactly one of `--text`, `--file`, or `--input`; supply an account directly or in your context. |
| `ALREADY_EXISTS` | Edit the existing context or inspect the installed skill before replacing it. |
| `no_draft` | Review the supplied conversation or choose another. The API may not provide the exact reason. |
| `RATE_LIMITED` | Respect `retry_after` in JSON output before trying again. |
| `TIMEOUT` / `NETWORK_ERROR` | The request may have reached the server. Avoid repeatedly submitting the same request; see [API notes](docs/api.md). |
| `NOT_IMPLEMENTED` | The command is planned. Use the current reply workflow; see the [roadmap](docs/roadmap.md). |

## Development and release terms

Run `npm test` for the offline test suite. Keep project files and commit messages in English.

Distribution and service terms are being finalized. This repository does not currently grant an open-source license; the npm package remains private until release terms are ready.
