# AI-DLC

**AI-DLC** is the public **skills and agents library** for the AI Development Lifecycle (AIDLC): phase orchestrators (`/plan`, `/design`, `/build`, `/review`, `/ship`), domain skills (architecture, testing, backend, frontend, …), and agent bundles. It ships as a **Claude Code** and **Cursor team** marketplace (see [`.cursor-plugin/marketplace.json`](.cursor-plugin/marketplace.json)) and works with Cursor via symlinked skill directories or the team plugin UI.

**What is this repo? A SEED**. There are a million ways of doing agentic orchestration - different LLMs, different platforms, different everything. Rather than solving for all, what this seed is meant to be is something you can feed into your LLM platform of choice, say 'here are my preferred tools', and ask it to make it work based on this pattern. Can you do this in Github with Actions/Issues? Yes. Can you feed the same seed into Gitlab with Jenkins and Jira? Also yes. 

**The goal is to give you somewhere to start.** Pick and choose what you need - start with just skills, or go to the agentic team of skills like `/review`, or set up the triggers and gates that make this truly hands-off agentic. The choice is yours!

## Quick install

```bash
curl -fsSL https://raw.githubusercontent.com/queen-of-code/AI-DLC/main/install.sh | bash
```

This clones to `~/.ai-dlc` and links skills into `~/.cursor/skills` and `~/.claude/skills`.

## Claude Code marketplace

```bash
/plugin marketplace add /path/to/AI-DLC
/plugin install ai-dlc-skills@ai-dlc
```

See [docs/CLAUDE-MARKETPLACE.md](docs/CLAUDE-MARKETPLACE.md).

## Docs

| Doc | Description |
|-----|-------------|
| [docs/SKILLS.md](docs/SKILLS.md) | Bundle format, manifest schema, skill catalog |
| [docs/INSTALL.md](docs/INSTALL.md) | Install paths and updates |
| [docs/CLAUDE-MARKETPLACE.md](docs/CLAUDE-MARKETPLACE.md) | Claude Code & Cursor marketplace usage |
| [docs/GITHUB-AIDLC-PROJECT.md](docs/GITHUB-AIDLC-PROJECT.md) | GitHub Projects (classic) + labels + Actions + Mac cron for AIDLC |
| [docs/ISSUE-TRACKER-PORTABILITY.md](docs/ISSUE-TRACKER-PORTABILITY.md) | Declare GitHub / Linear / Jira in consumer `AGENTS.md`; setup agent |
| [AGENTS.md](AGENTS.md) | Contributor / agent instructions |

## Layout

- **`skills/`** — All skill and agent bundles (`SKILL.md` + optional `tool.ts`, `system-prompt.md`).
- **`skills/spec-management/templates/`** — **Product Spec**, **Tech Spec**, **ADR** template (`adr-template.md`), and **ADR folder** guidance (`adr-guidance.md`) — all packaged with the `spec-management` skill / plugin.
- **`agent-library-mcp/`** — Manifest validation and CI helpers (`npm run validate-manifests`).
- **`.claude-plugin/marketplace.json`** — Claude Code marketplace catalog.
- **`.cursor-plugin/marketplace.json`** — Cursor team marketplace catalog (`metadata.pluginRoot`: `plugins`).
- **`plugins/ai-dlc-skills/`** — `.claude-plugin/` + `.cursor-plugin/` manifests and copy of `skills/` (synced via `./scripts/sync-plugin-skills.sh`).
- **`scripts/`** — `aidlc-cron.sh`, `prompts/`, `launchd/` examples for GitHub + Claude automation ([docs/GITHUB-AIDLC-PROJECT.md](docs/GITHUB-AIDLC-PROJECT.md)); `validate-cursor-marketplace.mjs` checks the Cursor team marketplace layout ([docs/CLAUDE-MARKETPLACE.md](docs/CLAUDE-MARKETPLACE.md)).

## License

See [LICENSE](LICENSE).
