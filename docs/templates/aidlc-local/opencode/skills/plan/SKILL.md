---
name: plan
description: AIDLC Plan (local transport override) — Product Spec as a Linear Document on the Feature issue, conversation-first, ends asking the human for approval. Overrides the library plan skill for OpenCode.
---

# /plan — local transport override

**Overrides:** the library skill at `.claude/skills/plan/SKILL.md`. Read that file and follow it; the deltas below win on conflict.

1. Load the **`aidlc-local`** skill first.
2. **Input:** the Feature issue key (e.g. `ENG-123`). Read the issue, its comments, and any existing `Product Spec — <feature>` Document with the Linear MCP.
3. **Write** the Product Spec as the Linear Document `Product Spec — <feature>` on the Feature issue (`save_document`; update in place on later runs). Seed it from the library's `product-spec-template.md` (`spec-management` skill) when empty.
4. **Conversation-first** across runs: post the open questions in a Linear comment @mentioning the owner. A human reply re-dispatches Plan (P2) or the human re-runs `/aidlc/plan`; the next run reads the Document plus the new comments and revises. The Document *is* the state.
5. **End** with a handoff comment: Document link, what changed, open questions, and "approve by moving this issue to **Design**".
6. **Never** move the issue to Design yourself.
