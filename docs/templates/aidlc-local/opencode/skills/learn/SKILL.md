---
name: learn
description: AIDLC Learn (local transport override) — ADRs in the repo via a bot PR, retro notes appended to the Tech Spec Document, then hand the final Done gate to the human. Overrides the library learn skill for OpenCode.
---

# /learn — local transport override

**Overrides:** the library skill at `.claude/skills/learn/SKILL.md`. Read that file and follow it; the deltas below win on conflict.

1. Load the **`aidlc-local`** skill first.
2. **Input:** the Feature key. Requires a filed `Validate Scorecard — <feature>` at or above threshold with **no human-pending rows** (or a human comment confirming them). Otherwise ask and halt.
3. **ADRs** for every decision in the Tech Spec's `## Decisions` section (and any new ones from Validate): `docs/adr/NNNN-title.md` from the `spec-management` ADR template, on a branch `<key-lowercase>-learn`, opened as a PR with the Feature key in title and body. You do not merge it.
4. **Retro notes:** read the current `Tech Spec — <feature>` Document (Linear MCP read tools), append a `## Learn` section (what worked, what bounced and why, model limits observed per phase), and write the **complete** document back as `tech-spec.md` in the docs dir (`AIDLC_DOCS_DIR`) — the daemon republishes it over the Document.
5. **End** with a comment @mentioning the owner: ADR PR link, the Learn section, "ready for **Done**". Never move the Feature to Done.
