# Installation

## Quick install

```bash
curl -fsSL https://raw.githubusercontent.com/queen-of-code/AI-DLC/main/install.sh | bash
```

This clones the repo to `~/.ai-dlc` (or uses an existing clone) and symlinks **skills** into `~/.cursor/skills` and `~/.claude/skills`.

## What gets installed

- **Skills** — Symlinked from `~/.ai-dlc/skills` into Cursor and Claude Code skill directories.

## Updating

```bash
cd ~/.ai-dlc && git pull && ./install.sh
```

Or re-run the curl command from [../install.sh](../install.sh).

## Claude Code

Use the marketplace flow documented in [CLAUDE-MARKETPLACE.md](CLAUDE-MARKETPLACE.md).

## GitHub Issues + Projects (optional)

To wire **GitHub Projects (v2)** Status columns, **`aidlc_work:*` labels**, **Actions**, and **Mac `launchd`** cron for Claude Code, see [GITHUB-AIDLC-PROJECT.md](GITHUB-AIDLC-PROJECT.md).
