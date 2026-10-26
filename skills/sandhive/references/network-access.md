# Network access and task scope

Read before the first live request or when diagnosing a blocked request. Announce the requested API work and proceed within the user's task; do not add a separate skill-level consent gate. Host permissions independently control whether a command may run or reach a destination.

## Destinations and data

All live service commands send HTTPS POST requests to `https://api.sandhive.io`:

| Command | Path | Data sent |
| --- | --- | --- |
| `find` | `/cli/search-score-tweets` | Search queries, project-specific ICP description, result limits and filters. |
| `style` | `/cli/user-twitter-style` | X handle, refresh preference and sample limit. |
| `draft reply` | `/cli/generate-tweet` | Conversation text, X handle, selected original writing samples; product, audience, selected facts and voice preferences when context is supplied. |
| `draft post` with manifest or server manifest | `/cli/generate-news-twitter-post` | X handle, human sample texts, optional manifest, language and length preferences. Without a manifest, the backend uses its account manifest. |
| `draft post` with text | `/cli/rewrite-twitter-post` | Supplied post material, X handle, human sample texts and optional length preference. |

Payloads also include fast-mode settings. Every SandHive API request includes `X-SandHive-Installation-Id: shf1_<sha256>`, computed in memory from hostname, home-directory path, platform and architecture with a SandHive namespace. No identity file, hardware probe or subprocess is used. Raw inputs are not sent. Host/profile changes can change the fingerprint, and cloned environments can share it. This is not a credential or an idempotency key. GitHub update checks and other API origins do not receive it. Computing it makes no network request and needs no write permission. Old UUID files and `SANDHIVE_HOME` are ignored.

Sample source metadata is validated locally; only sample texts are sent as writing examples. Project files are not uploaded automatically. Requests may be retained; include only material suitable for the hosted service. Search, style retrieval and generation may cause backend scraping/model usage. There is no server-enforced spending limit in the CLI.

Interactive live commands may also make a best-effort GET to `api.github.com/repos/sandhiveio/sandhive-cli/compare/<installed-commit>...main` to check updates. This sends the installation commit identifier, not project content. Set `SANDHIVE_NO_UPDATE_CHECK=1` to disable it. JSON runs, non-interactive runs, previews, and local commands (`init`, `skill install`, help/version and planned commands) skip this check. Git installation and updates contact GitHub separately; they do not authorize SandHive data submission.

`--dry-run` is local: it shows the exact endpoint, method, headers (including fingerprint) and wire payload without sending it. `doctor` is also read-only and local. `init` and `skill install` write only their requested project files. These commands do not prove that live network access works. Draft commands load the current project's saved context/style by default; inspect previews or use `--no-profile` when needed. The CLI does not publish to X.

## First-run notice and execution

Adapt this example to the actual task and the user's language:

> I selected [project] and built the voice profile from [available original writing]. Next I will send HTTPS requests to api.sandhive.io: [style retrieval if needed], one post request, one search using [two or three specific phrases], and up to three reply requests for suitable conversations. I will send only the selected facts, writing samples, brief/conversation, queries and account handle. The service may use scraping/models. I will show the drafts and source links for review.

Adapt the notice to the actual plan: a work update uses one rewrite request; a news post uses generation followed by rewrite (two calls). Each reply uses one request by default. Multiple different conversations can run concurrently with `draft replies --concurrency <1-5>`; `--attempts` only increases per-item generation attempts when explicitly chosen. State the number of items, concurrency and maximum request count; each request can cause usage. Network/timeout/HTTP failures are not retried. Start the CLI work immediately after the notice when setup and first drafts are requested. The initial default is one post, one search with up to 20 results and replies to up to three ready conversations. Honor a narrower task or different user limits. No scheduling or publishing follows from a drafting task. Local-only mode prepares context and previews; it does not silently substitute agent-generated drafts for SandHive results.

Choose the active or explicitly named project, collect local original writing and derive search phrases before asking for manual input. Do not require the user to certify that the samples are human-written. Ask only for a genuinely missing account, project choice or usable writing after accessible sources are exhausted. Do not ask whether to continue after saving context, retrieving style or listing search results.

The installer prints a first-run prompt requesting setup and a first draft batch; it cannot open a host approval dialog or force an agent turn by copying skill files. An agent already carrying out that setup continues in the same conversation. A request solely to install files remains installation-only. If the user asks for per-request preview or no API use, honor it.

## When access fails

- **Host approval denied:** name the exact action and summarize the stated denial. Follow the host's supported approval or user-override flow if available. Continue local preparation; do not switch tools, encode the payload, or use another route to perform the denied transfer.
- **Sandbox/network restriction:** request only the needed host-supported permission for the concrete command and destination. A task request or API notice does not reconfigure sandboxing or organization policy. Do not ask for unrestricted external requests or disable protections.
- **CLI `NETWORK_ERROR` or `TIMEOUT`:** the request may already have reached the server. Report that uncertainty; do not blame ChatGPT without host evidence or retry automatically.
- **HTTP/API failure:** report the actual CLI code/status. A 429 or server error is a service response, not evidence of a host denial.

For current host behavior, see official OpenAI documentation on [sandboxing](https://learn.chatgpt.com/docs/sandboxing) and [Auto-review](https://learn.chatgpt.com/docs/sandboxing/auto-review). Other agents have their own approval controls. The skill cannot promise permanent permissions or prevent all future approval requests.
