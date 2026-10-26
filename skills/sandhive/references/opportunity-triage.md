# Opportunity triage

Use for discovered conversations before spending a generation request. For a directly supplied conversation, check relevance and missing context without turning the task into prospect research.

## Identify the evidence

Read the actual post and available surrounding conversation. Classify the strongest observed signal:

| Signal | Evidence | Interpretation |
|---|---|---|
| Solution request | Asking for a tool, recommendation, or alternative | High intent only when the request matches the product's verified capability |
| Pain | Describing a specific unresolved work problem | Problem awareness; willingness to buy is unknown |
| Workaround | Describing repeated manual steps or a substitute | Possible opportunity; confirm the product addresses that job |
| Switching | Seeking migration or describing a relevant vendor limitation | Possible active evaluation; a complaint alone is not a purchase decision |
| Trigger | A launch, new workflow, or other relevant business event | Timing evidence only when its connection to the problem is supported |
| Topic match | Discussing the category or matching an audience profile | No demand established; may still merit a useful relationship reply |

Record source URL and visible date. If either is unavailable, say so; do not invent them. Separate the author's words from inferred fit. Use the user's requested time window; older posts are not automatically invalid, but check whether the question remains open. Do not infer company size, budget, buying authority, or personal experience from a handle.

Backend `gate_score` and `icp_score` are retrieval signals, not purchase probabilities. Preserve them as backend scores when reported. Supply the project's own audience/problem/intent description through `--icp-description`; do not choose an internal preset for the user. Keep an agent's qualitative fit assessment separate, with its reasoning. Do not manufacture a numerical score or call someone interested, consenting, or a confirmed buyer.

## Choose an action

- **Reply:** the conversation is understood and there is a specific contribution: an actionable answer, a supported counterexample, or a focused question that resolves a real ambiguity. State that contribution before drafting. Product fit matters for product recommendations; a useful answer need not recommend the product.
- **Obtain context:** a parent post, reference, or unresolved ambiguity could materially change the answer. Inspect it using available authorized tools, or request the missing text. Do not generate a context-dependent draft until resolved. There is no CLI command for retrieving complete conversations.
- **Skip:** irrelevant, duplicate, already handled according to available history, provider placeholder, unverifiable evidence, or no contribution beyond praise or promotion. A relevant post may also be skipped when a reply would violate its explicit no-promotion rule.

A public work-problem post can support a potential-customer hypothesis, not permission to DM. Topic-only matches can support relationship replies when useful, but keep them outside a demand-based prospect shortlist. Do not require product mentions or links. Respect the user's requested scope and available request budget; stop when adequate opportunities are found or the bounded search is exhausted. Empty results are acceptable.

## Evidence card

Use a compact card or equivalent table for selected discovered opportunities. Include only enough text for the user to assess the decision:

```text
Source: URL; @author; visible date or date unavailable
Signal: category + concise observed evidence
Fit: connection to verified product facts, or relationship opportunity
Contribution: specific answer/insight/question worth adding
Uncertainty: missing evidence or inference, if material
Decision: reply / skip / obtain context + reason
Draft: reviewed text, when available
```

Show backend scores only when helpful or requested, explicitly labeled. Before generation, omit Draft rather than implying a draft exists. For `no_draft`, report that outcome without inventing a refusal reason. Summarize skipped candidates instead of producing a large report unless requested. These are review notes, not new CLI fields, persisted history, or CRM records.

## Examples

- “Can anyone recommend a way to find founders asking for help with first customers?” + a matching verified capability: solution request; reply with a specific relevant method or recommendation.
- “We launched our SaaS today!”: trigger/topic match; no demand established. Skip if all you can offer is congratulations or a sales link.
- “That is why I stopped using it” without the referenced parent: obtain context. A high `icp_score` does not resolve what “it” means.
- A request for accounting automation with high SandHive score, when the user's product handles social replies: product mismatch. Skip a product pitch; offer another answer only if supported and useful within scope.

Methodology adapted in original wording from [prospecting demand signals](https://github.com/coreyhaines31/marketingskills/blob/main/skills/prospecting/references/demand-signals.md) and [social listening](https://github.com/coreyhaines31/marketingskills/blob/main/skills/social/references/listening.md). No installation of those skills or their optional tools is required.
