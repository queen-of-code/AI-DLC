# Claude Code marketplace

This repo is a Claude Code plugin marketplace. Skills are the primary plugin. Source bundles live in [../skills/](../skills/); a **full copy** is kept under [../plugins/ai-dlc-skills/skills/](../plugins/ai-dlc-skills/skills/) so the plugin is self-contained. Claude Code copies plugins to a cache and **does not support** content outside the plugin directory (see [Discover plugins — Troubleshooting](https://code.claude.com/docs/en/discover-plugins#troubleshooting)). After editing `skills/`, run `./scripts/sync-plugin-skills.sh` before commit.

## Use from your local repo

```bash
/plugin marketplace add /path/to/AI-DLC
/plugin install ai-dlc-skills@ai-dlc
```

Replace `/path/to/AI-DLC` with your clone path (e.g. `~/GitHub/AI-DLC`).

## Share with others

Push the repo to GitHub. Others can run:

```bash
/plugin marketplace add queen-of-code/AI-DLC
/plugin install ai-dlc-skills@ai-dlc
```

Nothing is submitted to a central Anthropic store; your repo is the marketplace.

## Catalog and plugin

- **Catalog:** [../.claude-plugin/marketplace.json](../.claude-plugin/marketplace.json)
- **Plugin:** [../plugins/ai-dlc-skills/](../plugins/ai-dlc-skills/) (manifest + copy of `skills/` under `skills/`)

After installing, skills appear as `ai-dlc-skills:skill-name` (e.g. `/ai-dlc-skills:architecture`).
