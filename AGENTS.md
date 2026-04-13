# AI-DLC — contributor guide

Public **skills + agents** library and **Claude Code marketplace**. No orchestrator runtime, control plane, or brain MCP stack — those live elsewhere.

## Rules

> **When adding or changing skills:** update [docs/SKILLS.md](docs/SKILLS.md) and the bundle’s `SKILL.md`. Bundles live under `skills/`; run `./scripts/sync-plugin-skills.sh` so `plugins/ai-dlc-skills/skills/` stays identical (the Claude Code plugin must be self-contained — see [docs/CLAUDE-MARKETPLACE.md](docs/CLAUDE-MARKETPLACE.md)).

## Quick links

- **Skills catalog & format:** [docs/SKILLS.md](docs/SKILLS.md)
- **Install:** [docs/INSTALL.md](docs/INSTALL.md)
- **Claude marketplace:** [docs/CLAUDE-MARKETPLACE.md](docs/CLAUDE-MARKETPLACE.md)
- **Manifest schema (Zod):** [agent-library-mcp/src/manifest.ts](agent-library-mcp/src/manifest.ts)

## AIDLC phase orchestrators

Cursor / Claude slash skills: **`skills/plan`**, **`skills/build`**, **`skills/review`**, **`skills/ship`** — invoked as `/plan`, `/build`, `/review`, `/ship`. They expect **`docs/AIDLC.md`** in the **consumer workspace** (each repo vendors that document).

## Validation

From `agent-library-mcp/`:

```bash
npm ci
npm run validate-manifests
```

PRs that touch `skills/**` run [`.github/workflows/skill-ci.yml`](.github/workflows/skill-ci.yml).
