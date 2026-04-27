# AI-DLC — contributor guide

Public **skills + agents** library and **Claude Code marketplace**. No orchestrator runtime, control plane, or brain MCP stack — those live elsewhere.

## Rules

> **When adding or changing skills:** update [docs/SKILLS.md](docs/SKILLS.md) and the bundle’s `SKILL.md`. Bundles live under `skills/`; run `./scripts/sync-plugin-skills.sh` so `plugins/ai-dlc-skills/skills/` stays identical (the Claude Code plugin must be self-contained — see [docs/CLAUDE-MARKETPLACE.md](docs/CLAUDE-MARKETPLACE.md)).

## Quick links

- **Skills catalog & format:** [docs/SKILLS.md](docs/SKILLS.md)
- **Install:** [docs/INSTALL.md](docs/INSTALL.md)
- **Marketplaces (Claude + Cursor):** [docs/CLAUDE-MARKETPLACE.md](docs/CLAUDE-MARKETPLACE.md) — `.claude-plugin/` for Claude Code; [`.cursor-plugin/marketplace.json`](.cursor-plugin/marketplace.json) + `plugins/ai-dlc-skills/.cursor-plugin/` for Cursor team marketplace
- **Specs & ADRs:** [skills/spec-management/templates/](skills/spec-management/templates/) — Product, Tech, ADR template, and ADR folder guidance (consumer repos store numbered files under `adr/`)
- **Issue tracker (any vendor):** [docs/ISSUE-TRACKER-PORTABILITY.md](docs/ISSUE-TRACKER-PORTABILITY.md) — `AGENTS.md` template in **consumer** repos, **`agent-issue-tracker-setup`**
- **GitHub queue + cron:** [docs/GITHUB-AIDLC-PROJECT.md](docs/GITHUB-AIDLC-PROJECT.md) — **Projects (classic)** + `aidlc_work:*` labels, Actions (`project_card`), `launchd`
- **Manifest schema (Zod):** [agent-library-mcp/src/manifest.ts](agent-library-mcp/src/manifest.ts)

## AIDLC phase orchestrators

Cursor / Claude slash skills: **`skills/plan`**, **`skills/design`**, **`skills/build`**, **`skills/review`**, **`skills/ship`** — invoked as `/plan`, `/design`, `/build`, `/review`, `/ship`. They expect **`docs/AIDLC.md`** in the **consumer workspace** (each repo vendors that document). **Consumer app repos** should add **`## Issue tracker (AIDLC)`** in **their** `AGENTS.md` (see [ISSUE-TRACKER-PORTABILITY.md](docs/ISSUE-TRACKER-PORTABILITY.md)) so phase skills know whether work lives in GitHub, Linear, Jira, etc.

## Validation

From `agent-library-mcp/`:

```bash
npm ci
npm run validate-manifests
```

PRs that touch `skills/**` run [`.github/workflows/skill-ci.yml`](.github/workflows/skill-ci.yml).

**Cursor team marketplace:** after changing [`.cursor-plugin/marketplace.json`](.cursor-plugin/marketplace.json) or [`plugins/ai-dlc-skills/.cursor-plugin/plugin.json`](plugins/ai-dlc-skills/.cursor-plugin/plugin.json), run `node scripts/validate-cursor-marketplace.mjs` (same rules as [cursor/plugin-template](https://github.com/cursor/plugin-template)). CI runs this in [`.github/workflows/plugin-skills-sync.yml`](.github/workflows/plugin-skills-sync.yml).
