# Draft review

Apply a short review after a successful draft response and before handoff. Checking a draft does not require another generation request. Preserve the exact successful CLI text and follow the skill's provenance labels. A substantive AI revision requires another CLI generation within the user's requested scope; user-supplied edits can be preserved with the human-edits label. A `no_draft`, timeout, or network failure remains its original outcome; do not invent text and label it an API draft.

## Review checks

1. **Answer the actual question.** A reply should contribute the answer, concrete next step, supported counterexample, or focused clarification selected during triage. Remove generic praise and unrelated product positioning. A standalone post should communicate one main point supported by the supplied material.
2. **Check every material claim.** Match product capabilities, quantities, outcomes, and personal stories to verified supplied facts. Remove or qualify unsupported claims; never make copy more specific by inventing numbers. Human style samples establish phrasing, not the author's experiences or endorsement of the current product.
3. **Preserve the author's voice.** Compare language, rhythm, length, formality, humor, and terminology against the selected original writing and explicit preferences. Improve clarity without imposing a generic corporate voice. Keep the original corpus unchanged; approved, edited, or published AI drafts are still not original human samples.
4. **Keep one useful point.** Cut filler, canned openings, redundant qualifications, and excess jargon. Do not require every reply to have a hook, question, CTA, statistic, or product mention. Use a follow-up question only when it helps the conversation.
5. **Check links and context.** A link should support the answer or satisfy a requested recommendation. Do not invent destinations, add tracking parameters unasked, or insert a sales link into a no-promotion conversation. Review the length against the user's requested format; do not claim platform acceptance from a simple character count.

Identify needed revisions against the evidence, then use another CLI generation for substantive AI changes when requested. Do not silently rewrite `draft.text`. If missing context or an essential factual claim prevents a reliable answer, explain what is missing and hold that draft. Do not block an entire batch when other candidates can be completed independently. Ask only for information that materially affects the result.

## Examples

Conversation: “How do you find relevant conversations without spending the whole day scrolling?”

Weak: “Great question! We have helped thousands of founders 10x their growth. Try our revolutionary platform.”

Review: remove unsupported numbers and outcomes, generic praise, and the unrelated pitch. A possible answer, if consistent with the author's voice: “Search for one problem in the words people use when asking for help. Save a few queries, then review the matches for questions you can answer concretely.” This is an illustrative editorial example, not an API result or usable human style sample.

Conversation: “Our migration keeps failing after the export step.”

Weak: “I had exactly the same issue last month; switching tools fixed it.”

Review: the author's personal history is unverified. If the tools and error are unknown, a focused question such as “Which tools are you migrating between, and what error appears after export?” can be useful without fabricating a fix or experience.

## Handoff

Show the reviewed final text and source URL when known. Mention a material removed claim or unresolved uncertainty when it affects the user's decision; do not attach a full editorial checklist to every short reply. Distinguish local revisions from fresh service output. Publication remains manual, and opening a link does not confirm posting.

Review method adapted in original wording from the clarity, voice, proof, and specificity passes in [copy-editing](https://github.com/coreyhaines31/marketingskills/blob/main/skills/copy-editing/SKILL.md). The source skill is not a runtime dependency.
