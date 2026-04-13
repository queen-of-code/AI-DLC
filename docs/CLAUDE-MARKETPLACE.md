# Claude Code marketplace

This repo is a Claude Code plugin marketplace. Skills are the primary plugin; they live in [../skills/](../skills/) and are exposed via a symlink from [../plugins/ai-dlc-skills/](../plugins/ai-dlc-skills/) (no duplicated copy).

## Use from your local repo

```bash
/plugin marketplace add /path/to/AI-DLC
/plugin install ai-dlc-skills@ai-dlc
```

Replace `/path/to/AI-DLC` with your clone path (e.g. `~/GitHub/AI-DLC`). Claude Code follows the symlink when installing, so you don’t need to copy skills into the plugin dir.

## Share with others

Push the repo to GitHub. Others can run:

```bash
/plugin marketplace add queen-of-code/AI-DLC
/plugin install ai-dlc-skills@ai-dlc
```

Nothing is submitted to a central Anthropic store; your repo is the marketplace.

## Catalog and plugin

- **Catalog:** [../.claude-plugin/marketplace.json](../.claude-plugin/marketplace.json)
- **Plugin:** [../plugins/ai-dlc-skills/](../plugins/ai-dlc-skills/) (manifest + symlink to `../skills`)

After installing, skills appear as `ai-dlc-skills:skill-name` (e.g. `/ai-dlc-skills:architecture`).
