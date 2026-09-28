---
name: build
description: AIDLC Build + Test orchestrator (TDD). Delivers an open PR with green CI per Tech Spec; re-enters to triage /review PR comments — fix or reply+resolve. Not for spec-only work.
type: skill
aidlc_phases: [build, test]
tags: [aidlc, orchestrator, build, test, tdd]
requires: []
author: Melissa Benua
created_at: 2026-04-12
updated_at: 2026-09-23
---

# /build — Build + Test (phase orchestrator)

You are the **phase orchestrator** for AIDLC **Build** and **Test** as **one practice**: tests are written **with** the code (TDD), not in a separate follow-up stage. Canonical definitions:

- **AIDLC:** `docs/AIDLC.md` at the repository root — Build phase, Test phase, V-model.

**Library skills:** [docs/SKILLS.md](../../docs/SKILLS.md). Resolve bundles from your install or `.claude/skills/<bundle>/` in the workspace.

## Inputs

- Approved `feature/<slug>/tech-spec.md`
- **If re-entering after `/review`:** open **PR** with **AIDLC Review — …** comments (see `/review` orchestrator).

## Headless runs: ask, don't assume

Before step 1, and whenever the contract is ambiguous: follow **[docs/ASK-AND-HALT.md](../../docs/ASK-AND-HALT.md)**. If the work item carries `needs-a-human` and no human has answered the bot's last question, **stop immediately**. Questions go on the work item with a human @mentioned, and the run **halts** until they answer — do not continue on a default.

## Orchestration — initial implementation

0. **Orient:** read the contract (Tech Spec, or the issue for reactive work). Separate the **rules** from the **examples** — examples illustrate, they don't specify (**[docs/INTENT-OVER-LITERAL.md](../../docs/INTENT-OVER-LITERAL.md)**). Anything you can't resolve with standard behavior is a question: ask and halt now, before code.
1. **Branch:** use a descriptive branch (e.g. `feature/<slug>-short-name`). Apply **`git-workflow`** ([skills/git-workflow/SKILL.md](../git-workflow/SKILL.md)).
2. **Implement by Tech Spec section:** in PR/commits, reference which section you are implementing (AIDLC Build guidance).
3. **TDD:** for each unit of work, prefer **test first or alongside** — frontend (`npm test` / vitest as applicable), backend (`dotnet test`, etc.). Load **`testing`** ([skills/testing/SKILL.md](../testing/SKILL.md)); use **`frontend-web`** for UI, **`backend-saas`** for API layers.
4. **Do not** “finish code” and add tests only at the end unless the Tech Spec explicitly sequenced an exception.
   - **Intent over literal:** implement with the platform's / codebase's standard behavior. When it differs from an example in the spec or ticket, keep the standard behavior and record the deviation — **never** add a branch, `replace`, lookup, override, or test-keyed conditional whose only purpose is reproducing a specific example value. An expected value copied from an example gets checked against the real standard output before you change code to match it; a red test against an illustrative example means the test is wrong.
   - **Spec deviations & assumptions:** the PR body starts with a `## Spec deviations & assumptions` section listing each place the implementation differs from an example or makes a judgment call (what the spec said, what ships, why) — or `None`. Reviewers and humans read this first.
5. **Open a PR** targeting the repo’s integration branch (e.g. `main` / `develop` per **`git-workflow`**). **Build is not complete** until the PR is **open** and **CI is green** (required checks passing on the latest commit). Iterate until green — same bar as AIDLC Phase 3 in `docs/AIDLC.md`.
6. **Local checks** first, then push; treat remote CI as authoritative for handoff to Test/Review.
7. **PR body matches the final diff.** Before handoff (and after every fix push), re-read the diff and update the PR summary and deviations section so they describe what the code does **now**, not what an earlier commit did.

## Review feedback loop (after `/review` has posted on the PR)

When **`/review`** has run, each **dimension** (Tech Spec, Testing, DevOps, Frontend/UX, Security, Architectural Soundness) should have left **GitHub PR comments** (preferred). The **build** orchestrator **owns the response**:

1. **Read** all open **review threads** on the PR — especially comments titled `AIDLC Review — …`.
2. **For each finding** (or each thread), decide:
   - **Valid:** implement the fix (code/tests/config/docs as appropriate), push commits, and **reply** on the same thread briefly stating what changed **or** mark the conversation **resolved** once the fix is on the branch (per team habit).
   - **Invalid / won’t fix (with cause):** **reply** on the **same GitHub comment thread** with a **clear rationale** (cite Tech Spec section, intentional scope, or false positive). Then **resolve the conversation** so reviewers see closure.
3. **Do not** silently ignore review feedback — every thread gets either a **code change** or a **documented reply**.
   - **Literal-match findings** (per [INTENT-OVER-LITERAL.md](../../docs/INTENT-OVER-LITERAL.md)): the fix is to **remove the special case** and record the deviation in the PR body — not to defend it with "the spec example said so." If you believe the example really was meant literally, that is a question for the human: ask and halt.
   - **Root cause vs guarding** (per **[docs/ARCHITECTURAL-SOUNDNESS.md](../../docs/ARCHITECTURAL-SOUNDNESS.md)** — the anti-spinning rule): for each finding, first ask *is this an invalid state being reached?* If so, fix it at the earliest boundary (make it unrepresentable, or enforce it at a single chokepoint) — **not** with a run-time guard at the observation site. **You may not close an `Architectural Soundness` / architectural-root finding with a guard**: revise the Tech Spec + record the decision (an ADR under `docs/adr/`) + implement to it. **Anti-babysit:** if this is the **second** patch to the **same symptom**, stop — a second guard is not allowed without an updated Tech Spec + recorded decision; the machine, not the call site, is wrong.
4. Re-run **local build/tests**; ensure **CI** is green.
5. If changes were substantive, run **`/review`** again for a **follow-up pass**; otherwise proceed toward merge per team rules.

**Tools:** use **GitHub MCP**, **`gh api` / `gh pr comment`**, or web UI instructions for the human if the agent cannot post — but **prefer** direct PR replies.

## Consumer specialist dispatch (optional)

Default routing uses horizontal library skills below. Consumer repos may add **`.cursor/skills/build/SKILL.md`** or an **`AGENTS.md` dispatch table** that routes Tech Spec sections to vertical specialists (backend, frontend, infra, testing) in parallel when files do not overlap.

See [docs/CONSUMER-SETUP.md](../../docs/CONSUMER-SETUP.md). Generic **`/build`** contract (TDD, open PR, green CI) still applies.

## Nested library skills (typical)

| When | Skill |
|------|--------|
| Implementation patterns | `frontend-web`, `backend-saas`, `architecture` |
| Tests | `testing` |
| Commits / PR | `git-workflow` |
| Manual UI check before PR (optional) | [INTERACTIVE-UI-VALIDATION.md](../../docs/INTERACTIVE-UI-VALIDATION.md) |

## Outputs

- **Initial Build pass:** **Open PR** + **green CI** + code/tests implementing the Tech Spec; traceability to Tech Spec sections in commits/PR body.
- **After `/review`:** same PR with **addressed or replied-to** review threads, CI still green.
- **Halted run:** a numbered question comment on the work item @mentioning the human, `needs-a-human` applied, in-flight label and delegate cleared, state unchanged, no PR opened or marked ready ([ASK-AND-HALT.md](../../docs/ASK-AND-HALT.md)).
