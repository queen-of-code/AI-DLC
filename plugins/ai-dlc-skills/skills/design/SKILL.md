---
name: design
description: AIDLC Design phase — Tech Spec on the Feature work item (default), review passes, human gate before /build. Requires an approved Product Spec (run /plan first or confirm approval in-thread).
type: skill
aidlc_phases: [design]
tags: [aidlc, orchestrator, design, tech-spec, specs]
requires: []
author: Melissa Benua
created_at: 2026-04-20
updated_at: 2026-09-28
---

# /design — Design (Tech Spec)

You are the **phase orchestrator** for AIDLC **Design** (Tech Spec). Ground truth is **`docs/AIDLC.md`** in the **consumer workspace**.

**Plan (Product Spec)** is **`/plan`** ([skills/plan/SKILL.md](../plan/SKILL.md)). This skill assumes **Product Spec is approved** (or the user explicitly approves proceeding in the current thread).

**Library skills** — [docs/SKILLS.md](../../docs/SKILLS.md); resolve from your install or `.claude/skills/<bundle>/`.

## Before you start

1. Read **`AGENTS.md` → Issue tracker (AIDLC)** and **Spec storage** — default **`issue-tracker`** ([ISSUE-TRACKER-PORTABILITY.md](../../docs/ISSUE-TRACKER-PORTABILITY.md)).
2. Resolve **feature slug** and the **parent Feature work item** (same as `/plan`).
3. **Read the approved Product Spec** from the Feature work item (Linear Document / issue body). If missing or not approved, **stop** and ask the human to run **`/plan`** or confirm approval — do not invent product scope. If **`repo-feature-folder`**, you may also read `feature/<slug>/product-spec.md` when kept in sync.
4. **Only if `repo-feature-folder`:** ensure `feature/<slug>/` exists; create `tech-spec.md` from **[`tech-spec-template.md`](../spec-management/templates/tech-spec-template.md)** if missing. Do **not** create `feature/<slug>/` for **`issue-tracker`** alone.
5. GitHub automation: [GITHUB-AIDLC-PROJECT.md](https://github.com/queen-of-code/AI-DLC/blob/main/docs/GITHUB-AIDLC-PROJECT.md). Portability: [ISSUE-TRACKER-PORTABILITY.md](https://github.com/queen-of-code/AI-DLC/blob/main/docs/ISSUE-TRACKER-PORTABILITY.md).

## Orchestration — Tech Spec

1. Translate the **approved** Product Spec into one or more **Units**; one Tech Spec artifact on the Feature item unless work is split across sub-issues (link related specs in the doc).
2. Include: scope, architecture, API/UI contracts, data model, acceptance criteria for **Review**, **testing approach** (what Build+Test must cover), risks — per AIDLC Design in `docs/AIDLC.md`.
   - **Architecturally-relevant changes** — anything touching a **state/status field, an enum, an async handoff, a gated or terminal action, a multi-step pipeline, or a publish/compile step** (trivial copy/CSS/config is exempt) — **must** additionally carry, per **[docs/ARCHITECTURAL-SOUNDNESS.md](../../docs/ARCHITECTURAL-SOUNDNESS.md)**: a **state machine** (states + a single transition function every path routes through + why illegal states are unreachable *by construction*), **sequence diagram(s)** for each cross-component/async handoff, the **invariants + their single enforcement chokepoint**, and the **validity boundary** (where invalid states are made unreachable — prefer schema/type/compile/publish over run-time guards). Without these, the change is **not ready** for the Design gate; `/review`'s Architectural Soundness pass scores against them.
3. **Write the Tech Spec on the Feature work item**; seed from **`tech-spec-template.md`** when empty.
4. **Tech Spec review passes** (run in order; merge findings into the doc; open issues in an appendix if needed):

| Pass | Library skill |
|------|----------------|
| Architecture / boundaries | `architecture` ([skills/architecture/SKILL.md](../architecture/SKILL.md)) |
| Frontend | `frontend-web` ([skills/frontend-web/SKILL.md](../frontend-web/SKILL.md)) |
| Backend / API | `backend-saas` ([skills/backend-saas/SKILL.md](../backend-saas/SKILL.md)) |
| Testing strategy | `testing` ([skills/testing/SKILL.md](../testing/SKILL.md)) |
| CI / Docker / deploy | `architecture` + read `.github/workflows/`, `docker-compose`, Dockerfiles |

5. **Stop for human approval** of the Tech Spec before **`/build`**.
6. If **`repo-feature-folder`**, keep tracker Tech Spec and `feature/<slug>/tech-spec.md` in sync.

## Outputs

- **Tech Spec** on the parent Feature work item (required).
- Optional `feature/<slug>/tech-spec.md` when **Spec storage** is `repo-feature-folder`.
- Linked ADR drafts under **`adr/`** in git when your repo uses them per **spec-management**.

## Rules

- Do not reopen settled Product decisions in the Tech Spec without flagging a **change request** to Product.
- **Conversation first** for technical ambiguities — same rhythm as `docs/AIDLC.md` orchestration model. **Headless:** ask on the work item with the owner @mentioned and **halt** until answered ([ASK-AND-HALT.md](../../docs/ASK-AND-HALT.md)); the same applies to the "stop and ask" in *Before you start*.
- Mark any example that must be reproduced exactly as **exact**; unmarked examples are illustrative ([INTENT-OVER-LITERAL.md](../../docs/INTENT-OVER-LITERAL.md)).
