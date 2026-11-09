---
name: design
description: AIDLC Design (local transport override) — Tech Spec as a Linear Document with the slice plan inside it; no issues are created until the human gates Design to Build+Test. Overrides the library design skill for OpenCode.
---

# /design — local transport override

**Overrides:** the library skill at `.claude/skills/design/SKILL.md`. Read that file and follow it — including the architectural-soundness requirements — the deltas below win on conflict.

1. Load the **`aidlc-local`** skill first.
2. **Input:** the Feature issue key. Read the approved `Product Spec — <feature>` Document. If it is missing, ask and halt.
3. **Write** the Tech Spec as the Linear Document `Tech Spec — <feature>` (`save_document`), seeded from the library's `tech-spec-template.md` when empty. Proposed ADRs go in a `## Decisions` section of the Tech Spec; the ADR files land in the repo later (first slice PR or `/learn`).
4. **Slice plan — in the Tech Spec, never as issues.** You cannot create or update issues, and you must not try. Slices exist only as this block in a `## Slice plan` section of the Tech Spec. They become sub-issues **after** the human moves the Feature to Build+Test (`aidlc-slices.sh` in P1, the daemon in P2), so nothing can be built before the gate.

   ````markdown
   ## Slice plan

   ```aidlc-slices
   {
     "version": 1,
     "slices": [
       {
         "key": "export-api",
         "title": "CSV export endpoint",
         "section": "3.1 Export API",
         "acceptance": ["GET /export returns text/csv", "Large exports stream"],
         "blockedBy": []
       },
       {
         "key": "export-ui",
         "title": "Export button on the reports page",
         "section": "3.2 Reports UI",
         "acceptance": ["Button downloads the current filter's CSV"],
         "blockedBy": ["export-api"]
       }
     ]
   }
   ```
   ````

   Rules for the block:
   - Exactly **one** `aidlc-slices` block, valid JSON (no comments, no trailing commas).
   - `key`: lowercase kebab-case, unique, **stable** — never rename a key once the human has seen it; the creator uses it to avoid duplicates.
   - `title` and `acceptance` (non-empty list) are required; `section` names the Tech Spec section the slice implements.
   - `blockedBy` lists earlier keys only, in build order — the chain must have no cycles.
   - **1 slice:** `"slices": []` — the Feature itself is the unit.
   - **2–9 slices:** list them. **10+:** stop and propose splitting the Feature instead.
5. **End** with a handoff comment: Tech Spec link, the slice list (key + title, in order), risks, and "approve by moving this issue to **Build+Test** — the slices are created then, not before".
