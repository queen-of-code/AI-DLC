---
name: review
description: AIDLC Test gate + Review — runs five review passes (spec, tests, DevOps, UI, security); post feedback as GitHub PR comments; then hand off to /build for triage. Not a substitute for human sign-off.
type: skill
aidlc_phases: [review, test]
tags: [aidlc, orchestrator, review, test, pr]
requires: []
author: Melissa Benua
created_at: 2026-04-12
updated_at: 2026-04-12
---

# /review — Test gate + Review (phase orchestrator)

You are the **phase orchestrator** for the **human gate after Build+Test** (“are the right things tested?”) and AIDLC **Review**. Canonical text:

- **AIDLC:** `docs/AIDLC.md` at the repository root — Test & Review.

**Library:** apply **`agent-reviewer`**, **`agent-devops-review`**, **`agent-security-review`**, **`testing`**, **`architecture`**, **`frontend-web`**, **`backend-saas`**, **`git-workflow`** as needed — [docs/SKILLS.md](../../docs/SKILLS.md).

## How this phase interacts with GitHub (preferred)

Each review **dimension** below behaves like a **dedicated reviewer**: it should produce **actionable feedback**.

**Preferred delivery:** post feedback **directly on the open PR** as **GitHub comments** so the **build** phase can respond in-thread.

- **One top-level PR comment per dimension** (§1–§5), using a clear header, e.g. `### AIDLC Review — Tech Spec`, `### AIDLC Review — Testing`, … so threads stay scannable.
- Within each comment, list findings with **blocking** vs **advisory** and file references.
- If **GitHub MCP**, **`gh pr comment`**, or the GitHub API is **not** available: write the same content into **`feature/<slug>/review-report.md`** and tell the user to paste or post manually — but **prefer automation** when tools exist.

Also write or update **`feature/<slug>/review-report.md`** as a **durable mirror** of the same content (copy from posted comments or generate once and post from the file).

## Inputs

- `feature/<slug>/tech-spec.md` (approved) — **source of truth for “done”**
- **Open PR** URL or number for this branch; **CI** (GitHub Actions) results
- Diff vs default branch — infer whether **frontend/UI**, **API**, **infra**, or mixed

## Orchestration — five review dimensions (each posts feedback)

Run each pass **as if** a separate reviewer; consolidate only at the end for the summary comment if useful.

### 1. Tech Spec compliance

- Walk **`tech-spec.md`**: acceptance criteria, API/UI contracts, data model, out-of-scope boundaries.
- For each major item: **where in code/tests/PR** it is satisfied; **gaps** if not.
- Apply **`agent-reviewer`** behavior ([skills/agents/agent-reviewer/SKILL.md](../agents/agent-reviewer/SKILL.md)) for spec-to-implementation trace and regression risk.
- **Output:** PR comment `AIDLC Review — Tech Spec` + section in `review-report.md`.

### 2. Practical testing sufficiency

- Apply **`testing`** skill ([skills/testing/SKILL.md](../testing/SKILL.md)): judge whether tests prove **the right behaviors** — not coverage percentage as a vanity metric.
- Distinguish **unit** vs **integration** appropriateness; flag missing cases that the Tech Spec implies.
- **CI must be green**; flag flakiness or skipped tests.
- **Output:** PR comment `AIDLC Review — Testing` + section in `review-report.md`.

### 3. DevOps — rollout, deploy, monitoring

- Load and apply **`agent-devops-review`** ([skills/agents/agent-devops-review/SKILL.md](../agents/agent-devops-review/SKILL.md)) for CI/CD, containers, workflows, rollout/rollback, monitoring vs Tech Spec.
- **Output:** PR comment `AIDLC Review — DevOps` + section in `review-report.md`.

### 4. Frontend / UX — when the change touches UI

**Trigger** if the PR touches frontend paths (e.g. Website, Razor, wwwroot, CSS/JS, SPA) or **Tech Spec** lists UI acceptance criteria.

1. Apply **`frontend-web`** ([skills/frontend-web/SKILL.md](../frontend-web/SKILL.md)) for code patterns, accessibility basics, and alignment with stated UI/UX in the Tech Spec.
2. **Browser / computer-use validation** when UI is in scope: use browser MCP if available; capture evidence; compare to Tech Spec for **usability and design compliance**.
3. If no browser MCP: **manual browser test script** in the comment; mark validation pending.
4. **Output:** PR comment `AIDLC Review — Frontend/UX` + section in `review-report.md`. Omit only if UI is out of scope — state **N/A** in a short comment or skip with explanation on the PR.

### 5. Security review (lightweight, obvious issues)

- Load and apply **`agent-security-review`** ([skills/agents/agent-security-review/SKILL.md](../agents/agent-security-review/SKILL.md)); it composes **`backend-saas`** and **`architecture`** for API/auth and boundaries.
- **Output:** PR comment `AIDLC Review — Security` + section in `review-report.md`. For docs-only PRs, state **N/A** briefly.

## After posting — handoff to **build**

When review feedback is on the PR (and mirrored in `review-report.md`), **stop** — the next step is **`/build`** (build orchestrator), **not** another full review pass.

The **build** orchestrator **triages** each review thread: fix valid issues or **reply** with why a finding is invalid and **resolve** the conversation. See [skills/build/SKILL.md](../build/SKILL.md) § “Review feedback loop”.

## Synthesis (optional)

- One short **summary** PR comment listing **blocking** vs **advisory** counts if helpful.

## Outputs

- **GitHub PR comments** for §1–§5 (preferred).
- **`feature/<slug>/review-report.md`** mirror.
- **Human sign-off** still required per AIDLC.
