# Scheduling handoff

Recommend a small starting routine the user can adjust: twice-weekly posts from verified new work, and a weekday search with up to five candidates and up to three useful reply drafts. These are suggested starting limits, not scheduled work or permission for new API calls. Confirm the desired cadence, timezone, account/project, and per-run scope before creating a schedule. Reuse values the user already supplied.

The CLI has no scheduler. Use the host's supported scheduling/automation tools when available and requested; otherwise describe how to run the workflow using the user's scheduler without claiming it is configured. Do not invent CLI schedule commands. If a supported tool is unavailable, state that limitation and give a concrete routine the user can save.

A recurring run must refresh relevant verified facts, reuse only selected original writing samples, generate every post/reply through the CLI, and return labeled drafts and source links for manual review. Skip a post when no meaningful verified update exists; do not fabricate work. Deduplicate candidates using available history, disclose when persistent history is unavailable, and keep within the agreed search/generation limits. Report failures without blind retries or local draft substitution. Describe possible scraping/model usage; no server-enforced spending limit is implemented. No automatic publishing or outreach is included.


