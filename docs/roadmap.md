# Roadmap

## X MVP

- [x] CLI skeleton with human-readable output and JSON results.
- [x] Reply generation using the existing API contract; dry-run preview.
- [x] Portable skill for context preparation, replies, and manual review.
- [x] Local context initialization and direct conversation input with text/file flags.
- [ ] Verify live API access and complete a real Codex and Claude Code workflow.
- [ ] Find up to five relevant conversations with reasons and source links.
- [ ] Draft standalone posts from verified updates and completed work.
- [ ] Store drafts, edits, approval of a specific version, skips, and feedback.
- [ ] Open X for manual publication; distinguish opening from confirmed publication.
- [ ] Add history, server-enforced usage/spending limits, and safe request retries.
- [ ] Choose release terms and package distribution before publishing to npm.

## Key activation

- [ ] Generate a local Ed25519 key pair and keep the private key in the OS credential store.
- [ ] Issue a signed, expiring PoW challenge bound to the public key and activation purpose.
- [ ] Verify work and proof of key ownership; atomically accept each challenge once.
- [ ] Apply a small starting quota and server limits to challenge issuance, verification, and API use, including repeated registration with new keys.
- [ ] Benchmark hash-based and memory-hard puzzles on ordinary devices and measure server verification cost before selecting adjustable difficulty.
- [ ] Define token expiry, key revocation, rotation, and recovery.

PoW increases registration cost; it does not prove a unique person or replace spending limits. No activation endpoints or credentials are implemented in the current scaffold.

## Later

- [ ] X: conversation memory, monitoring, outcome analytics, and publishing approved posts where supported.
- [ ] Threads: platform adapter, adapted drafts, review, and publishing.
- [ ] LinkedIn: professional conversations, posts/comments, contact context, and team review.
