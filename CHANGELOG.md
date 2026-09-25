# Changelog

All notable changes to the AI-DLC skills and docs library.

## [Unreleased]

### Added

- **`docs/INTENT-OVER-LITERAL.md`** — examples in specs/tickets are illustrative unless marked exact; use standard behavior, never special-case code to reproduce a sample, disclose deviations in the PR body
- **`docs/ASK-AND-HALT.md`** — headless runs keep every "ask in chat" step: ask on the work item with a human @mentioned, apply `needs-a-human`, halt; dispatchers never auto-resume

### Changed

- **`/build`** — orient step separates rules from examples; `## Spec deviations & assumptions` PR section; PR body must match final diff; literal-match findings are fixed by removing the special case
- **`/review`** — every-PR **literal-match test** (never N/A); read the diff before the spec; hack/workaround findings are blocking; never edit the spec example to match code; PR body accuracy check
- **`/plan`, `/design`, `/ship`, `report-bug`, `agent-product-manager`, `spec-management`, `agent-reviewer`** — headless ask-and-halt; mark exact examples explicitly
- **`.github/actions/aidlc-launch`** — removed the "skip all ask-in-chat steps / document assumptions instead of asking" headless override; prompt now requires ask-and-halt; launch skips issues labeled `needs-a-human`
- **`aidlc-issue-comment-launch.yml`** — `/aidlc-launch` removes `needs-a-human` (human resume path); needs `issues: write`
- **`aidlc-pr-opened-review.yml`** — no Build → Review advance while the tracking issue is `needs-a-human`
- **`docs/LINEAR-AIDLC-PROJECT.md`** — `bot-working` / `needs-a-human` run-status labels; ask-and-halt on Linear
- **`docs/SELF-HOSTED-AIDLC.md`**, **`docs/GITHUB-AIDLC-QUEUE.md`**, **`docs/templates/AIDLC.md`** — `needs-a-human` as the paused signal

## [1.0.0] — 2026-06-09

### Added

- **`docs/templates/AIDLC.md`** — canonical process template for consumer repos
- **`docs/CONSUMER-SETUP.md`** — submodule, skill overrides, dual-tracker pattern
- **`docs/INTERACTIVE-UI-VALIDATION.md`** — Chrome DevTools MCP UI validation (distinct from Validate phase)
- **`docs/templates/mcp.json.example`** — sample `.cursor/mcp.json` for Chrome DevTools MCP
- **`skills/learn/SKILL.md`** — Learn orchestrator (after Validate PASS)
- **`docs/GITHUB-AIDLC-QUEUE.md`** — Projects v2 headless queue setup
- **Queue workflow templates** — `aidlc-launch-from-board`, `aidlc-pr-merged`, `aidlc-pr-opened-review`, `aidlc-ship-after-deploy`, `aidlc-issue-comment-launch`, `aidlc-project-phase-reconcile` under `docs/templates/github-workflows/`
- **`.github/actions/aidlc-launch/action.yml`** — org/user Projects v2, Ship CI context inputs

### Changed

- **`skills/ship/SKILL.md`** — Validate phase only; Learn handoff; UI validation by reference
- **`skills/review/SKILL.md`** — Frontend/UX pass requires Chrome DevTools MCP per INTERACTIVE-UI-VALIDATION
- **`skills/build/SKILL.md`** — consumer specialist dispatch section
- **`skills/frontend-web`**, **`skills/testing`** — cross-links to UI validation doc
- **`docs/ISSUE-TRACKER-PORTABILITY.md`** — dual-tracker template, PR ticket gate rows
- **`docs/GITHUB-AIDLC-PROJECT.md`** — automation tiers; Tier A points to queue doc + templates
