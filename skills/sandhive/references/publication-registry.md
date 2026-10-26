# Local publication registry

The skill maintains `.sandhive/posts.json` with available local file tools. This is a local workflow record, not a new SandHive CLI command, server history, scheduler, or publishing integration. Create it on the first reviewed post; do not invent historical entries. Read existing data before writing. Keep it private and Git-ignored with the project's local context.

## Format

Use a JSON object with `schema_version: 1` and a `posts` array. Each entry records:

- `id`: unique local ID, reused for state transitions of the same draft.
- `account`: intended X handle; do not mix accounts when choosing the previous post.
- `kind`: `news` or `work_update` (standalone posts only; replies remain in their separate flow).
- `status`: `draft`, `approved`, `sent_for_publication`, `published`, or `rejected`.
- `created_at`, `updated_at`: ISO 8601 timestamps with timezone/UTC, representing actual actions.
- `text`: current reviewed draft text; keep a `revisions` array when it changes, with text and timestamp.
- `topic`: concise description for avoiding repetition.
- `sources`: source URLs and verified event/publication dates when available; no invented dates.
- `covered_work`: factual changes or release/commit references addressed by this post.
- `work_checkpoint`: optional known commit/ref through which work was reviewed; do not claim it was deployed.
- `previous_post_id`: applicable prior publication-handoff entry, or null when unknown/first post.
- `approved_at`, `sent_at`, `published_at`, `publication_url`: optional, set only when supported.
- `handoff_text`: exact text sent for publication; preserve it even if a later draft is edited.
- `confirmation`: concise user assertion or authorized tool evidence supporting handoff/publication; omit raw private conversations.

Missing evidence stays null or absent. Never set publication dates from the draft creation date. Do not upload this registry as style guidance or include its drafts in `style_samples`.

## State transitions and the previous-post boundary

1. A final reviewed rewrite starts as `draft`. Merely generating or showing it does not count as publication.
2. Explicit approval can set `approved`. “Looks good” approves the text; it does not prove it was posted or queued.
3. Set `sent_for_publication` when the user explicitly says it went to publication, or an explicitly authorized handoff to a publishing destination succeeds. Record `sent_at` and exact `handoff_text`. An instruction to publish without an available publishing tool is not a successful handoff; explain the limitation and leave it approved.
4. Set `published` only with user confirmation of actual posting or verified evidence from an authorized tool. Record the URL and date when known. A browser opening the compose page or source URL is insufficient.
5. Set `rejected` when the user discards the draft. Do not delete earlier handoff evidence; corrections to already handed-off text should be new draft entries linked to the prior entry.

For “since the previous post,” choose the latest confirmed handoff/publication for the same account and this project using its recorded event timestamp. Exclude merely approved, shown, rejected, and failed drafts. If there are historical gaps or unknown handoff dates, state the limitation instead of claiming exhaustive coverage. Check previous topics and covered work to avoid repeating the same announcement.

## Write safely

Validate the existing JSON and preserve unrelated entries. If it is malformed, stop the registry update and report the repair needed; do not reset it to an empty array. Build an updated document, write a sibling temporary file, reread/validate it, confirm the original has not changed during the edit, then replace the original atomically where supported. If another task changed it, reload and merge by entry ID; never discard that task's entries. Do not append duplicate records on repeated confirmations. No registry write changes publication status on X.
