---
name: aidlc-local
description: Shared rules for the AIDLC local transport (OpenCode + self-hosted LLMs + Linear + GitHub). Load before any /aidlc phase override — privilege, Linear Documents, state names, robot lanes.
---

# AIDLC local transport — shared rules

Every phase override in `.opencode/skills/<phase>/` loads this first. On conflict, these rules win over the generic library skill; the generic skill still defines the phase's work.

## 1. You never satisfy your own gate

- **Do not change Linear workflow state, the delegate, or the assignee** — on any issue, ever. Human gates are state moves a human makes in the Linear UI; machine moves belong to the daemon.
- If you believe the phase should advance, **stop and say so** in a Linear comment @mentioning the owner.
- **Never merge a PR** (`gh pr merge` is denied; branch protection requires a human review anyway).
- **Never edit check definitions to make them pass** — `.github/workflows/**`, hook configs (`.pre-commit-config.yaml`, `.husky/**`, `lefthook.yml`), self-hosted runner configs. If the change genuinely requires it, say so in the PR body under `## Spec deviations & assumptions`; Review treats it as a blocking DevOps finding for a human.
- Do not call the Linear or GitHub APIs directly (curl, `gh api`). Use the Linear MCP tools and `gh pr …` commands you are given.

## 2. Specs live in Linear, never in the repo

Spec storage is `issue-tracker`. Use the **Linear MCP**:

| Artifact | Where |
|---|---|
| Product Spec | Linear Document `Product Spec — <feature>` on the Feature issue |
| Tech Spec (incl. the `aidlc-slices` slice plan) | Linear Document `Tech Spec — <feature>` |
| Review summary | PR comments (one per dimension) + one Linear comment |
| Validate scorecard | Linear Document `Validate Scorecard — <feature>` |
| Learn notes | `## Learn` section appended to the Tech Spec Document |
| ADRs | **Repo**, `docs/adr/NNNN-title.md`, via a PR |

Do **not** create `feature/<slug>/`, `product-spec.md`, `tech-spec.md`, or `review-report.md`. The generic skills mention those only for `repo-feature-folder`, which this transport does not use.

## 3. Linear states (phase = state)

Feature: `Triage → Plan → Design → Build+Test → In Staging → Ship → Done` (`Canceled` drops it).
Slice (sub-issue): backlog (`Not Started`) `→ Build+Test → Review → In Staging → Done`.

Read the state; never write it. Use the names declared in `AGENTS.md → Issue tracker (AIDLC)` if they differ.

**No agent creates or updates issues.** Slices are planned in the Tech Spec's `aidlc-slices` block and created by a human-held tool (or the daemon) only after the Design → Build+Test gate.

## 4. Progress and questions

- Keep **one** status comment per run and **edit it in place** (`save_comment` with its id) — no comment spam.
- Questions follow [ASK-AND-HALT.md](../../../.claude/deps/ai-dlc/docs/ASK-AND-HALT.md) (the AI-DLC submodule): one comment @mentioning the owner, numbered questions with a recommended default, then **stop**. Do not continue on a default. **The comment's first line is exactly `**AIDLC question**`** — that is how the daemon tells a question from a handoff. The daemon (or, without the daemon, the human) applies `needs-a-human` and resumes your session when a human answers; you only post the question and halt.
- Files you want attached to the issue (screenshots, captured output) go in `.aidlc/evidence/` in the lane; the daemon uploads them before the lane is removed.
- End every run with a handoff comment @mentioning the owner: what you produced, where, and what decision is theirs.

## 5. Robot lanes

You run in a worktree pinned to a SHA (or the slice branch on a bounce), separate from the human's checkout. Build and boot the app **from the lane**. Do not touch paths outside it. Commit on the lane's branch only.

## 6. Model honesty

You may be a small local model. If a task exceeds what you can do reliably (long spec reasoning, a large diff, missing vision for screenshots), say so in the handoff instead of guessing. A truthful "I could not verify X" is a valid outcome; a fabricated PASS is not.
