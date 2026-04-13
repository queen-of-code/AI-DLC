# AI-DLC

**AI-DLC** is the public **skills and agents library** for the AI Development Lifecycle (AIDLC): phase orchestrators (`/plan`, `/build`, `/review`, `/ship`), domain skills (architecture, testing, backend, frontend, …), and agent bundles. It ships as a **Claude Code marketplace** and works with Cursor via symlinked skill directories.

Runtime orchestration (control plane, TS agent loop, Docker stack) lives in a separate private repo and is **not** included here.

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
| [docs/CLAUDE-MARKETPLACE.md](docs/CLAUDE-MARKETPLACE.md) | Marketplace usage |
| [AGENTS.md](AGENTS.md) | Contributor / agent instructions |

## Layout

- **`skills/`** — All skill and agent bundles (`SKILL.md` + optional `tool.ts`, `system-prompt.md`).
- **`agent-library-mcp/`** — Manifest validation and CI helpers (`npm run validate-manifests`).
- **`.claude-plugin/marketplace.json`** — Marketplace catalog.
- **`plugins/ai-dlc-skills/`** — Plugin manifest + copy of `skills/` (synced via `./scripts/sync-plugin-skills.sh`).

## License

See [LICENSE](LICENSE).
