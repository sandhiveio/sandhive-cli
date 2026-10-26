# Project context and your writing style

Your agent already knows your project and what you built. SandHive uses that context to draft posts and replies in your voice. Provide post examples or ask it to retrieve them from your X account. Keep using your agent; review the draft before publishing.

## Use with Codex or Claude Code

After [installing the CLI](../README.md#install), open the project you want to write about and install the skill:

```sh
sandhive skill install --agent codex --target .
# Or:
sandhive skill install --agent claude --target .
```

Give your agent this starting prompt, replacing the placeholders:

> Set up SandHive for the active project and produce one post and up to three replies to relevant conversations. Build my voice from original writing available locally, or retrieve more from @your_handle if needed. Choose the search phrases, tell me what will be sent to api.sandhive.io, then run the CLI and show drafts with source links without another routine confirmation. Do not publish.

The agent uses sources available in its session. It does not assume access to other chats, private systems, or your entire X history. It selects the active project and proceeds using verified facts; correct the audience or product description when needed. It asks only for essential information unavailable from existing sources.

## What project context contains

The local profile in `.sandhive/context.json` inside the agent's active project contains the product description, audience, verified facts, voice preferences and source information. Run CLI commands with that project as the working directory, even if the CLI executable lives elsewhere; do not change into the package checkout. Each project owns its `.sandhive` directory, style samples and local history. There is no automatic package-level or global profile fallback. The agent can also prepare a manifest for the post workflow. Keep assumptions separate from facts and refresh the profile as your product changes.

The bare CLI does not discover project facts by scanning your repository. Create a profile from your project's directory:

```sh
sandhive init --product "A tool for organizing user feedback" --audience "Early-stage founders" --account your_handle --voice "Concise, practical, no hype" --fact "Feedback can be grouped by topic"
```

Replace these example values. Creating context makes no drafting API call and does not overwrite an existing profile. Subsequent draft commands automatically load this project's saved context; `--context` can explicitly select another file. For a post rewrite, supply a factual work update; for news generation, include verified project facts in the manifest. See the [post workflow](../skills/sandhive/references/post-workflow.md).

## Use your existing posts as style samples

Choose at least three original posts or messages you wrote yourself. Use examples that reflect the voice you want to keep, and include a source URL or file location for each. Save this array in `.sandhive/style.json`, replacing every placeholder:

```json
[
  { "text": "Replace with your first original post", "source": "Replace with its URL or file location", "authorship": "human" },
  { "text": "Replace with your second original post", "source": "Replace with its URL or file location", "authorship": "human" },
  { "text": "Replace with your third original post", "source": "Replace with its URL or file location", "authorship": "human" }
]
```

These are placeholders, not valid writing samples to submit unchanged. Original human writing matters for a useful style match; exclude known AI drafts, rewrites and other authors' quotations. The agent selects usable originals from available sources and fills authorship metadata without requiring the user to certify them. The CLI validates metadata and source references; it cannot independently prove who wrote a post.

Draft commands load `.sandhive/context.json` and fallback `.sandhive/style.json` from the current project automatically. You can supply explicit `--context`/`--style-file` paths or disable automatic loading with `--no-profile`. Explicit input samples take precedence over context/default samples. Tone or length preferences supplement the samples; they do not replace them. Reuse local writing first. If more is needed, `sandhive style` retrieves candidates; select original message texts and continue without a separate authorship question. Ask for missing examples only when available sources cannot supply three usable samples.

## Preview, generate, and review

```sh
sandhive draft reply --text "How do we explain our product?" --context .sandhive/context.json --style-file .sandhive/style.json --dry-run
```

Replace the conversation text. The preview shows the request without making a drafting API call. Remove `--dry-run` when you are ready to generate, then check facts, style, and relevance. Publish manually when you approve the final text.

## What stays local and what is sent

Context and style files are stored locally and selected automatically from the current project, unless disabled or overridden. Drafting sends the supplied text, account identifier and writing guidance derived from context and samples to SandHive's hosted service. A hashed host/profile fingerprint is included in a request header without writing an identity file. Source code is not uploaded automatically. Requests may be retained; do not include secrets or confidential material. The CLI's default `.sandhive` directory gets a Git ignore file; check your own storage and sharing choices.

For exact fields, supported commands, and failure handling, see the [CLI reference](../skills/sandhive/references/cli.md) and [API notes](api.md).
