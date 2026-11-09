---
name: build
description: AIDLC Build + Test (local transport override) — TDD in the robot lane on the slice branch, open a PR as the bot with the Linear key, never merge or move state; on a bounce, triage review threads. Overrides the library build skill for OpenCode.
---

# /build — local transport override

**Overrides:** the library skill at `.claude/skills/build/SKILL.md`. Read that file and follow it (TDD, PR body deviations section, review-feedback loop, intent-over-literal, root-cause-not-guard); the deltas below win on conflict.

1. Load the **`aidlc-local`** skill first.
2. **Input:** the slice key (or the Feature key for a 1-slice Feature). Never build an umbrella Feature that has slices — say so and stop.
3. **Contract:** the slice's acceptance criteria + its section of `Tech Spec — <feature>` (Linear Document).
4. **Branch:** the lane is already on the slice branch (`<key-lowercase>-<short-name>`, e.g. `eng-124-export-csv`); create it from the lane's HEAD only if it does not exist. On a **bounce**, the branch and PR already exist — continue on them.
5. **Hooks** run at every commit; never use `--no-verify`. A hook failure is feedback to fix, not to bypass.
6. **PR:** `gh pr create` as the bot account, base = the repo's integration branch, **slice key in the title and body** (Linear auto-links). Mark it ready when local checks pass — the daemon moves the slice to Review on that event; you do not.
7. **Bounce:** read every `AIDLC Review — …` thread on the PR and resolve each per the library loop (fix + reply, or reply with rationale + resolve). Re-run checks.
8. **End** with a handoff comment on the slice: PR link, what is implemented, deviations, check status.
9. **Never** `gh pr merge`, force-push, or move the slice's state.
