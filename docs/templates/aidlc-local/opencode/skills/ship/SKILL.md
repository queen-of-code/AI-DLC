---
name: ship
description: AIDLC Validate (local transport override) — feature-level validate in the robot lane at merged main via the declared validation surface (web, macos-app, cli), scorecard as a Linear Document. Overrides the library ship skill for OpenCode.
---

# /ship — local transport override

**Overrides:** the library skill at `.claude/skills/ship/SKILL.md`. Read that file and follow it (scorecard vs Product Spec success criteria, 90% default threshold); the deltas below win on conflict.

1. Load the **`aidlc-local`** skill first.
2. **Input:** the Feature key. Runs only when the Feature is whole (all slices Done, or the 1-slice Feature merged). The lane is pinned to **merged main** — "staging" is the app built from that SHA.
3. **Validation surface** — read `AGENTS.md → Validation target`:
   - `web`: start the declared stack (docker compose or dev server) on the lane's port offset, wait for the readiness probe, validate with Chrome DevTools MCP per `INTERACTIVE-UI-VALIDATION.md`.
   - `macos-app`: `xcodebuild` the declared scheme, boot the lane's own simulator device (`xcrun simctl`), launch, screenshot via `xcrun simctl io <device> screenshot`.
   - `cli`: run the declared entrypoint and assert on output.
   - **Build or boot failure = immediate FAIL** with the diagnosis. Never validate a broken build.
4. **Evidence per success criterion:** screenshot or captured output. If you cannot interpret screenshots (no vision), attach them and mark the row **`evidence attached — human-verified`** — that row is human-pending and holds auto-Learn.
5. **Scorecard** → Linear Document `Validate Scorecard — <feature>`: per-criterion PASS/FAIL/human-pending, the percentage, and on FAIL a **proposed return phase** with the root cause (usually a specific slice).
6. **Tear down** the stack / delete the simulator device. Attach evidence to Linear before the lane goes away.
7. **End** with a handoff comment @mentioning the owner. Do **not** start `/learn` and do not move state — the daemon or the human does.
