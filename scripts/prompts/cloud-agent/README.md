# Cloud Agent prompts

Per-phase headless prompts for **Cursor Cloud Agents** launched via the
[`aidlc-agent-launch.yml`](../../docs/templates/github-workflows/aidlc-agent-launch.yml) workflow.

## CLI vs Cloud Agent

| | CLI (`aidlc-phase-issue.md`) | Cloud Agent (this folder) |
|---|---|---|
| **Who runs it** | Human invokes `claude` or `/plan` locally | GitHub Actions launches via Cursor API |
| **Human in the loop** | Yes -- agent can ask questions | No -- must self-complete |
| **Phase scope** | Follows skill orchestrator naturally | Explicit HARD STOP per phase |
| **Approval gates** | Human provides interactively | Agent opens a draft PR and posts next-step instructions |
| **Callback** | N/A | Agent calls GitHub API to clear `aidlc_work:in_progress` |

## Why hard stops?

The CLI phase skills (e.g. `/plan`) include human approval gates between phases.
A headless Cloud Agent has no human to provide that gate, so without an explicit stop condition,
a `/plan` invocation will continue into Design, then Build, etc. -- running the entire AIDLC in
one session, which is usually not what you want.

Each prompt here names exactly one deliverable and includes `Do NOT` directives to prevent
phase bleed.

## Path assumption: `.claude/skills/`

These prompts tell the agent to read skill files at `.claude/skills/`. This path exists because
the consumer repo vendors AI-DLC as a **git submodule** at `.claude/deps/ai-dlc/` with a
**symlink** at `.claude/skills/` pointing to `deps/ai-dlc/skills/` — the convention described
in [AGENTS.md](https://github.com/queen-of-code/AI-DLC/blob/main/AGENTS.md).

The Cursor Cloud Agent checks out the repo but does **not** initialize submodules automatically.
Your `.cursor/environment.json` `install` command must include:

```
git submodule update --init --recursive
```

Without this, `.claude/deps/ai-dlc/` will be empty, the symlink will dangle, and the agent
will not find any skills. See the setup instructions in
[GITHUB-AIDLC-PROJECT.md](../../docs/GITHUB-AIDLC-PROJECT.md) for the full `environment.json` pattern.

## Placeholders

These files use `{{REPO}}` and `{{ISSUE_NUMBER}}` as placeholders. The
`aidlc-agent-launch.yml` workflow builds the actual prompt text dynamically in JavaScript
(see the `phasePrompts` object). These markdown files serve as the human-readable source of
truth for what each prompt should accomplish.

## Files

| File | Phase | Deliverable |
|------|-------|-------------|
| `plan.md` | Plan | `feature/<slug>/product-spec.md` |
| `design.md` | Design | `feature/<slug>/tech-spec.md` |
| `build.md` | Build | Open PR with passing CI |
| `review.md` | Review | PR review comments |
| `ship.md` | Ship | Scorecard, ADR, retro; issue closed |
