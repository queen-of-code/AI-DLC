---
name: review
description: AIDLC Review (local transport override) — review the PR with six read-only specialist subagents (sequential by default), post one PR comment per dimension plus a Linear summary; human merges or bounces. Overrides the library review skill for OpenCode.
---

# /review — local transport override

**Overrides:** the library skill at `.claude/skills/review/SKILL.md`. Read that file and follow it (six dimensions, severity rule, literal-match test, handoff to build); the deltas below win on conflict.

1. Load the **`aidlc-local`** skill first.
2. **The PR is the object of review.** Input: slice key + PR number. Collect: base/head SHAs, the diff (`gh pr diff`), check results at head (`gh pr checks`), the Tech Spec Document, and the slice's acceptance criteria.
3. **Fan out** to the six specialist subagents, passing each the same collected context:

   | Subagent | Dimension |
   |---|---|
   | `aidlc-review/tech-spec` | Tech Spec compliance + the every-PR literal-match test |
   | `aidlc-review/testing` | Testing sufficiency |
   | `aidlc-review/devops` | DevOps — and the **check-definition tamper rule** |
   | `aidlc-review/frontend-ux` | Frontend/UX (N/A when no UI is touched) |
   | `aidlc-review/security` | Security |
   | `aidlc-review/architectural-soundness` | Architectural Soundness |

   Run them **one at a time** unless `AGENTS.md` says the machine can carry parallel reviewers. Subagents are read-only; they return findings, you post them.
4. **Post** one PR comment per dimension headed `### AIDLC Review — <Dimension>` with blocking vs advisory findings, then one Linear comment on the slice @mentioning the owner: blocking/advisory counts and "merge the PR, or bounce the slice to **Build+Test**".
5. **Tamper rule (invariant §2.7):** any diff touching `.github/workflows/**`, hook configs, or runner configs is a **blocking** DevOps finding, regardless of intent — a human decides.
6. **Never** approve, merge, or move state. Your review is evidence for the human's gate, not the gate.
