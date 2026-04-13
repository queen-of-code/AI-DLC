---
name: build
description: AIDLC Build + Test orchestrator (TDD). Implements after Tech Spec approval; also re-enters to triage /review PR comments — fix or reply+resolve. Not for spec-only work.
type: skill
aidlc_phases: [build, test]
tags: [aidlc, orchestrator, build, test, tdd]
requires: []
author: Melissa Benua
created_at: 2026-04-12
updated_at: 2026-04-12
---

# /build — Build + Test (phase orchestrator)

You are the **phase orchestrator** for AIDLC **Build** and **Test** as **one practice**: tests are written **with** the code (TDD), not in a separate follow-up stage. Canonical definitions:

- **AIDLC:** `docs/AIDLC.md` at the repository root — Build phase, Test phase, V-model.

**Library skills:** [docs/SKILLS.md](../../docs/SKILLS.md). Resolve bundles from your install or `.claude/skills/<bundle>/` in the workspace.

## Inputs

- Approved `feature/<slug>/tech-spec.md`
- **If re-entering after `/review`:** open **PR** with **AIDLC Review — …** comments (see `/review` orchestrator).

## Orchestration — initial implementation

1. **Branch:** use a descriptive branch (e.g. `feature/<slug>-short-name`). Apply **`git-workflow`** ([skills/git-workflow/SKILL.md](../git-workflow/SKILL.md)).
2. **Implement by Tech Spec section:** in PR/commits, reference which section you are implementing (AIDLC Build guidance).
3. **TDD:** for each unit of work, prefer **test first or alongside** — frontend (`npm test` / vitest as applicable), backend (`dotnet test`, etc.). Load **`testing`** ([skills/testing/SKILL.md](../testing/SKILL.md)); use **`frontend-web`** for UI, **`backend-saas`** for API layers.
4. **Do not** “finish code” and add tests only at the end unless the Tech Spec explicitly sequenced an exception.
5. **CI:** ensure local build/test pass before handoff to `/review`.

## Review feedback loop (after `/review` has posted on the PR)

When **`/review`** has run, each **dimension** (Tech Spec, Testing, DevOps, Frontend/UX, Security) should have left **GitHub PR comments** (preferred). The **build** orchestrator **owns the response**:

1. **Read** all open **review threads** on the PR — especially comments titled `AIDLC Review — …`.
2. **For each finding** (or each thread), decide:
   - **Valid:** implement the fix (code/tests/config/docs as appropriate), push commits, and **reply** on the same thread briefly stating what changed **or** mark the conversation **resolved** once the fix is on the branch (per team habit).
   - **Invalid / won’t fix (with cause):** **reply** on the **same GitHub comment thread** with a **clear rationale** (cite Tech Spec section, intentional scope, or false positive). Then **resolve the conversation** so reviewers see closure.
3. **Do not** silently ignore review feedback — every thread gets either a **code change** or a **documented reply**.
4. Re-run **local build/tests**; ensure **CI** is green.
5. If changes were substantive, run **`/review`** again for a **follow-up pass**; otherwise proceed toward merge per team rules.

**Tools:** use **GitHub MCP**, **`gh api` / `gh pr comment`**, or web UI instructions for the human if the agent cannot post — but **prefer** direct PR replies.

## Nested library skills (typical)

| When | Skill |
|------|--------|
| Implementation patterns | `frontend-web`, `backend-saas`, `architecture` |
| Tests | `testing` |
| Commits / PR | `git-workflow` |

## Outputs

- Code + tests on a branch; PR with **addressed or replied-to** review threads.
- Traceability to Tech Spec sections in commits/PR body.
