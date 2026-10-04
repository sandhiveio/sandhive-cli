# SandHive CLI

**Turn project context into useful conversations and social drafts.**

A CLI for people and an agent skill for tools such as Codex and Claude Code. Bring your product facts and voice, draft a useful reply, and review it before publishing.

[Website](https://www.sandhive.io) · [Report an issue](https://github.com/sandhiveio/sandhive-cli/issues) · [Roadmap](docs/roadmap.md)

> Early scaffold. Reply generation is connected to the existing API contract. Discovery, standalone posts, persistent review, and key activation are planned. No npm package has been published yet.

## Get started

Requires **Node.js 22 or later**. No runtime dependencies or build step.

```sh
git clone https://github.com/sandhiveio/sandhive-cli.git
cd sandhive-cli
npm install
node bin/sandhive.js --help
```

### Preview your first request

Replace `user.account` in `examples/reply.json` with your X handle without `@`, and replace the conversation and writing guidance with your own.

```sh
node bin/sandhive.js draft reply --input examples/reply.json --dry-run --json
```

This shows exactly what would be sent and makes no API request. To request a draft:

```sh
node bin/sandhive.js draft reply --input examples/reply.json
```

Generation requires network access and a service deployment that accepts your request. Tests cover mocked generation; a live empty-request check confirmed routing, but real draft generation is not yet verified. The API can return no draft. Review any generated text before publishing manually in X.

To make the `sandhive` command available locally:

```sh
npm link
sandhive --help
```

## Use with an agent

Install the CLI as above, then copy the bundled skill into the project where your agent works:

```sh
sandhive skill install --agent codex --target /path/to/your-project
# Or:
sandhive skill install --agent claude --target /path/to/your-project
```

The installer uses `.agents/skills/sandhive` for Codex and `.claude/skills/sandhive` for Claude Code. It refuses to overwrite an existing skill. The source is a single portable [SKILL.md](skills/sandhive/SKILL.md).

Example request to your agent:

> Use SandHive to summarize this project's audience, verified facts, and writing voice. Draft a useful reply to this X conversation and show it to me for review.

The agent gathers context from sources available to it. It cannot automatically access other chats or accounts. The skill guides context preparation and review; the CLI executes the API request.

## Bring your project context

Use [examples/context.json](examples/context.json) as a template. Keep the product description, audience, verified facts, and voice compact and current. Save your own files under `.sandhive/`, which is ignored by this repository.

```sh
sandhive draft reply --input .sandhive/reply.json --context .sandhive/context.json --dry-run --json
```

Inspect the summary, then omit `--dry-run` when ready. Context is passed through the API's existing writing-guidance field. Source files are not uploaded. Do not include credentials or confidential material; supplied text is sent to the hosted service. Style adherence and factual accuracy still require review.

## Current commands

| Command | Status |
| --- | --- |
| `draft reply` | API adapter, optional context, fast mode, JSON output, and dry run |
| `skill install` | Project-local installation for Codex or Claude Code |
| `find` | Planned: relevant conversations with reasons |
| `draft post` | Planned: posts from updates and completed work |
| `review` | Planned: edits, approvals, skips, and manual handoff |
| `auth`, `usage` | Planned: key activation, quotas, and usage |

Planned commands return `NOT_IMPLEMENTED` and make no requests. This version does not publish, store draft history, enforce spending limits, or authenticate with generated keys.

For agents and scripts, use `--json` and `--input <file|->`. Results have a versioned envelope and explicit errors. Requests are not retried automatically. See the [CLI reference](skills/sandhive/references/cli.md) and [API notes](docs/api.md).

## Development

```sh
npm test
```

Tests use mocked API responses and do not call the hosted service. Keep code, documentation, issues, and commit messages in English. Contributions should include a clear description and relevant verification; see the [roadmap](docs/roadmap.md) for the next steps.

## Release terms

Distribution and service terms are being finalized. This repository does not currently grant an open-source license. The npm package is marked private until release terms and packaging are ready.
