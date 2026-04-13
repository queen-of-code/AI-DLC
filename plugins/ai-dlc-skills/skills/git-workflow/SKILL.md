---
name: git-workflow
description: Git workflow standards including commit messages, branch management, and success criteria. Use when committing code, creating branches, or preparing changes for review.
type: skill
aidlc_phases: [build, test, review]
tags: [git, version-control, workflow, commits, branches]
requires: []
author: Melissa Benua
created_at: 2026-03-07
updated_at: 2026-03-22
---

# Git Workflow Standards

## When to Use

- When creating commits
- When deciding whether to create a branch
- Before declaring work complete
- When preparing changes for pull requests

## Branch Protection

1. **Never commit directly to `main`** - create a feature branch first
2. **Always pull from main before branching** - run `git fetch origin && git rebase origin/main` (or `git pull origin main`) before creating a feature branch or starting work. This prevents merge conflicts in the PR.
3. **Branch naming**: Use kebab-case that describes the change (e.g., `add-user-authentication`, `fix-memory-leak`)
4. **Stay on feature branches** - don't create feature branches off feature branches

## Success Criteria

Changes are considered successful when ALL of the following are met:

1. **Requirements satisfied** - original task goals are achieved
2. **Build passes** - code compiles without errors
3. **Tests pass** - all existing and new tests succeed
4. **No linting errors** - code follows project style guidelines
5. **Files formatted** - code is properly formatted
6. **Complete changes** - no partial or incomplete modifications
7. **Dependencies included** - all necessary imports and packages added
8. **Documentation updated** - relevant docs reflect the changes

### Language-Specific Checks

| Language | Build Command | Test Command |
|----------|---------------|--------------|
| JavaScript/TypeScript | `npm run build` | `npm test` |
| Python | N/A | `pytest` or `python -m unittest` |
| Go | `go build` | `go test ./...` |
| Rust | `cargo build` | `cargo test` |
| C# | `dotnet build` | `dotnet test` |

## Commit Message Format

```
<type>(<scope>): <brief description>

<detailed description>

Cursor-Task: <original task description>
```

### Types

| Type | When to Use |
|------|-------------|
| `feat` | New feature |
| `fix` | Bug fix |
| `refactor` | Code restructuring without behavior change |
| `style` | Formatting, whitespace changes |
| `docs` | Documentation only |
| `test` | Adding or modifying tests |
| `infra` | Infrastructure, CI/CD, deployment |
| `chore` | Maintenance tasks |

### Guidelines

- **Brief description**: Max 72 characters, imperative mood ("add" not "added")
- **Scope**: Optional, indicates area affected (e.g., `auth`, `api`, `ui`)
- **Detailed description**: 1-2 sentences explaining the why
- **Cursor-Task**: Reference the original task that prompted the change

## Examples

### Good Commit

```bash
git commit -m "feat(auth): implement OAuth2 user authentication

Add Google OAuth2 authentication flow with JWT token handling.
Update user model to support OAuth providers.

Cursor-Task: Add OAuth2 authentication for user login"
```

### Good Infrastructure Commit

```bash
git commit -m "infra(aws): update ECS task definitions

Increase memory allocation and add CloudWatch logging.

Cursor-Task: Optimize ECS resource allocation"
```

### Bad Commits

- `git commit -m "fixed stuff"` - Missing type, not descriptive
- `git commit -m "wip"` - Never commit work-in-progress
- Committing with failing tests - Always verify success criteria first

## Tools

- Prefer git command line for operations
- Use GitHub MCP for creating pull requests when available
- If MCP isn't working, prompt the user for next steps

## Pre-Commit Checklist

Before every commit, verify:

- [ ] **Pulled from main first** — `git fetch origin && git rebase origin/main` before branching
- [ ] Build compiles successfully
- [ ] All tests pass
- [ ] No linting errors
- [ ] Changes match the original task
- [ ] No secrets or credentials in the commit
- [ ] Documentation updated if needed
