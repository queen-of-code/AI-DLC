# Installation

## Quick install

```bash
curl -fsSL https://raw.githubusercontent.com/queen-of-code/AI-DLC/main/install.sh | bash
```

This clones the repo to `~/.ai-dlc` (or uses an existing clone) and symlinks **skills** into `~/.cursor/skills` and `~/.claude/skills`.

If those directories already exist (plain folders or old symlinks), the installer **skips** them. To **replace** them with symlinks into `~/.ai-dlc/skills`, use **`--force`**:

```bash
curl -fsSL https://raw.githubusercontent.com/queen-of-code/AI-DLC/main/install.sh | bash -s -- --force
```

From a clone: `./install.sh --force`

## What gets installed

- **Skills** — Symlinked from `~/.ai-dlc/skills` into Cursor and Claude Code skill directories.

## Updating

```bash
cd ~/.ai-dlc && git pull && ./install.sh
cd ~/.ai-dlc && git pull && ./install.sh --force
```

Or re-run the curl command from [../install.sh](../install.sh).

## Claude Code

Use the marketplace flow documented in [CLAUDE-MARKETPLACE.md](CLAUDE-MARKETPLACE.md).

## GitHub Issues + Projects (optional)

To wire **GitHub Projects (classic)** columns, **`aidlc_work:*` labels**, **Actions** (card-move triggers), and **Mac `launchd`** cron for Claude Code, see [GITHUB-AIDLC-PROJECT.md](GITHUB-AIDLC-PROJECT.md).
