# Changelog

All notable changes to the AI-DLC skills and docs library.

## [1.0.0] — 2026-06-09

### Added

- **`docs/templates/AIDLC.md`** — canonical process template for consumer repos
- **`docs/CONSUMER-SETUP.md`** — submodule, skill overrides, dual-tracker pattern
- **`docs/INTERACTIVE-UI-VALIDATION.md`** — Chrome DevTools MCP UI validation (distinct from Validate phase)
- **`docs/templates/mcp.json.example`** — sample `.cursor/mcp.json` for Chrome DevTools MCP
- **`skills/learn/SKILL.md`** — Learn orchestrator (after Validate PASS)

### Changed

- **`skills/ship/SKILL.md`** — Validate phase only; Learn handoff; UI validation by reference
- **`skills/review/SKILL.md`** — Frontend/UX pass requires Chrome DevTools MCP per INTERACTIVE-UI-VALIDATION
- **`skills/build/SKILL.md`** — consumer specialist dispatch section
- **`skills/frontend-web`**, **`skills/testing`** — cross-links to UI validation doc
- **`docs/ISSUE-TRACKER-PORTABILITY.md`** — dual-tracker template, PR ticket gate rows
- **`docs/GITHUB-AIDLC-PROJECT.md`** — automation tiers (A recommended / B minimal / C legacy)

### Deferred to v1.1

- Full GitHub queue workflow templates (merge advance, ship-after-deploy, `/aidlc-launch`, reconcile)
- Composite action enhancements (org Projects v2, ship context inputs)
