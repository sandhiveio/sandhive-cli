# Standalone posts: news or completed work, then rewrite

Read the CLI reference and publication registry. This flow is separate from `find` → opportunity triage → `draft reply`. A request only for a post stays within that scope. The guided setup requests both branches: complete the post here, then discovery and up to three useful replies as described in SKILL.md, without a second workflow-choice question.

## Shared preparation

Read project facts, account, original human style samples, project manifest if available, and the registry for that account/project. Identify the most recent `sent_for_publication` or `published` entry and its covered topics and work boundary. Use the user's selected branch; otherwise choose one with adequate evidence and explain the choice. Do not call both branches speculatively.

Human samples are required for both news generation and rewrite. Generated intermediate material is content to rewrite, never a human style sample. Source metadata and the registry remain local. Send only public/suitable factual material to the hosted service.

## Branch A: fresh news through the news endpoint

1. Browse current sources relevant to the project's audience and manifest. Prefer original announcements or primary reporting. Record the event date, publication date, source URL, verified facts, and connection to the project. Use the user's requested time window; otherwise prefer the last seven days and disclose any older material. Do not turn old reporting into a new event. If no relevant fresh news can be verified, report that and use the completed-work alternative only when supported and within scope.
2. Build one compact request brief in `.sandhive/manifest.md` from the project manifest: verified product/audience facts, the selected news facts and dates, the relevance to the audience, and the intended angle. Preserve an existing project manifest by creating a request-specific file instead. Do not invent adoption, integrations, endorsement, or product capabilities from a news connection. Avoid standalone `---` separators because the backend may select a section randomly.
3. Generate the initial news post:

```sh
sandhive draft post --manifest-file .sandhive/manifest.md --account <handle> --style-file .sandhive/style.json --language English --max-length 280 --json
```

This selects `https://api.sandhive.io/cli/generate-news-twitter-post`. Choose the user's language and requested length; English/280 are examples. The endpoint is not a verified news-retrieval tool: supply source-backed news in the manifest and fact-check its output. Local context is not sent automatically and an explicit manifest changes only this request, not the server manifest.
4. Only on `status: draft`, save the exact `draft.text` as UTF-8 `.sandhive/news-draft.txt`. Check for factual drift before sending it on. Then restyle:

```sh
sandhive draft post --file .sandhive/news-draft.txt --account <handle> --style-file .sandhive/style.json --max-length 280 --json
```

This selects `https://api.sandhive.io/cli/rewrite-twitter-post`. Do not combine the rewrite text with manifest or language flags. This branch makes two service requests; a preview uses `--dry-run` and must not be presented as a generated intermediate post. A second-stage preview requires actual supplied text.

## Branch B: what changed since the previous post

1. Use the registry's previous publication handoff as the boundary, not the last generated or rejected draft. Inspect available changelog, commits, releases, project files, and user-provided work notes. A commit alone does not prove deployment or customer availability.
2. Identify verified work not already covered by that post. If a Git checkpoint is recorded and applicable, inspect changes since that commit; otherwise use recorded covered work and dates and disclose uncertainty. With no prior entry, do not invent a “last post”: use an initial verified update or ask for the missing previous-post boundary when essential.
3. Write a short factual account in `.sandhive/update.txt`: what changed, whom it helps, and supported limitations. Skip empty updates and avoid claiming unfinished work was shipped. Restyle directly:

```sh
sandhive draft post --file .sandhive/update.txt --account <handle> --style-file .sandhive/style.json --max-length 280 --json
```

There is no news-generator request in this branch. The local factual description is input content, not an API-generated post.

## Review, show, and record

Apply draft review to the final rewritten output, checking it against the factual input and human samples. Show the final text, news source links or covered work, and material uncertainty. Record the reviewed draft with its sources/work boundary. After explicit approval or a confirmed publication handoff, update the same registry entry according to the registry contract. Preserve revisions rather than overwriting the text already handed off.

If either endpoint returns `no_draft`, fails, or times out, stop that dependent chain and explain which stage failed. Do not retry automatically or silently show the un-restyled intermediate as the final result. A local editorial fallback requires a clear label and must not be represented as successful rewrite output. Keep the reply flow independent so completed reply work remains usable.
