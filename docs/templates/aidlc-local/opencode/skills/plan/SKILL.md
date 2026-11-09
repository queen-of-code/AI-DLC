---
name: plan
description: AIDLC Plan (local transport override) — Product Spec as a Linear Document on the Feature issue, built by five read-only specialist subagents, conversation-first, ends asking the human for approval. Overrides the library plan skill for OpenCode.
---

# /plan — local transport override

**Overrides:** the library skill at `.claude/skills/plan/SKILL.md`. Read that file and follow its steps in order; the deltas below win on conflict.

1. Load the **`aidlc-local`** skill first.
2. **Input:** the Feature issue key (e.g. `ENG-123`). Read the issue, its comments, and any existing `Product Spec — <feature>` Document with the Linear MCP. An existing Document is the starting `spec_draft`; otherwise seed it from the library's `product-spec-template.md` (`spec-management` skill).
3. **Specialists are real subagents.** You hold the one `spec_draft`. Pass it to each specialist and take back what it returns. Run them **one at a time** unless `AGENTS.md` says the machine can carry parallel subagents:

   | Library step | Subagent |
   |---|---|
   | Research brief | `aidlc-plan/researcher` (repo, ADRs, git history and Linear only; **no web research** on this transport) |
   | Draft | `aidlc-plan/product-manager` |
   | Customer pass | `aidlc-plan/product-marketer` |
   | Grounding review | `aidlc-plan/grounding-reviewer` |
   | Clarity review | `aidlc-plan/clarity-reviewer` (reads the spec and the process docs only) |

   The roles-first conversation (library step 3) is yours, not a subagent's. Never review your own draft in place of a reviewer subagent. If a subagent fails or times out, say so in the handoff rather than doing its step silently.
4. **Write** the Product Spec as the Linear Document `Product Spec — <feature>` on the Feature issue (`save_document`; update in place on later runs).
5. **Conversation-first** across runs: put every `pm_questions` item and every review finding that needs a product decision in **one** Linear comment @mentioning the owner, then halt. A human reply re-dispatches Plan (P2), or the human re-runs `/aidlc/plan`. The next run reads the Document and the new comments, revises, and **re-runs the clarity reviewer** until it reports no blocking finding. The Document *is* the state.
6. **End** with a handoff comment: Document link, what changed, which specialists ran, the roles covered, that every outcome has a criterion, the clarity verdict, open questions, and "approve by moving this issue to **Design**".
7. **Never** move the issue to Design yourself.
