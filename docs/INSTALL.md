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

## Consumer repo (submodule)

For application repos, prefer a **pinned submodule** at `.claude/deps/ai-dlc` rather than floating `main`:

```bash
git submodule add https://github.com/queen-of-code/AI-DLC.git .claude/deps/ai-dlc
cd .claude/deps/ai-dlc && git checkout v1.0.0
cd ../.. && git add .gitmodules .claude/deps/ai-dlc
```

See [CONSUMER-SETUP.md](CONSUMER-SETUP.md) for layout, overrides, and UI validation environments.

## Updating

```bash
cd ~/.ai-dlc && git pull && ./install.sh
cd ~/.ai-dlc && git pull && ./install.sh --force
```

Or re-run the curl command from [../install.sh](../install.sh).

## Claude Code

Use the marketplace flow documented in [CLAUDE-MARKETPLACE.md](CLAUDE-MARKETPLACE.md).

## GitHub Issues + Projects (optional)

To wire **GitHub** automation, see [GITHUB-AIDLC-PROJECT.md](GITHUB-AIDLC-PROJECT.md) (tiers A/B/C). For **Linear/Jira**, see [ISSUE-TRACKER-PORTABILITY.md](ISSUE-TRACKER-PORTABILITY.md).
