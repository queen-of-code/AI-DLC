---
name: design
description: AIDLC Design phase — Tech Spec under feature/<slug>/, review passes, human gate before /build. Requires an approved Product Spec (run /plan first or confirm approval in-thread).
type: skill
aidlc_phases: [design]
tags: [aidlc, orchestrator, design, tech-spec, specs]
requires: []
author: Melissa Benua
created_at: 2026-04-20
updated_at: 2026-04-21
---

# /design — Design (Tech Spec)

You are the **phase orchestrator** for AIDLC **Design** (Tech Spec). Ground truth is **`docs/AIDLC.md`** in the **consumer workspace**.

**Plan (Product Spec)** is **`/plan`** ([skills/plan/SKILL.md](../plan/SKILL.md)). This skill assumes **Product Spec is approved** (or the user explicitly approves proceeding in the current thread).

**Library skills** — [docs/SKILLS.md](../../docs/SKILLS.md); resolve from your install or `.claude/skills/<bundle>/`.

## Before you start

1. Resolve **feature slug** from `$ARGUMENTS` or from the same folder the team used for `/plan`.
2. **Read `feature/<slug>/product-spec.md`**. If it is missing or clearly not approved, **stop** and ask the human to run **`/plan`** or confirm approval — do not invent product scope.
3. Ensure `feature/<slug>/` exists. If `tech-spec.md` is missing, create it from **[`tech-spec-template.md`](../spec-management/templates/tech-spec-template.md)**.
4. Link the work to the same **parent work item** as `/plan` (per **`AGENTS.md` → Issue tracker (AIDLC)**). For GitHub-only automation, see [GITHUB-AIDLC-PROJECT.md](https://github.com/queen-of-code/AI-DLC/blob/main/docs/GITHUB-AIDLC-PROJECT.md). Portability: [ISSUE-TRACKER-PORTABILITY.md](https://github.com/queen-of-code/AI-DLC/blob/main/docs/ISSUE-TRACKER-PORTABILITY.md).

## Orchestration — Tech Spec (`tech-spec.md`)

1. Translate the **approved** Product Spec into one or more **Units**; one `tech-spec.md` in this feature folder unless work is split across sub-issues (link related specs in the doc).
2. Include: scope, architecture, API/UI contracts, data model, acceptance criteria for **Review**, **testing approach** (what Build+Test must cover), risks — per AIDLC Design in `docs/AIDLC.md`.
3. **Tech Spec review passes** (run in order; merge findings into the doc; open issues in an appendix if needed):

| Pass | Library skill |
|------|----------------|
| Architecture / boundaries | `architecture` ([skills/architecture/SKILL.md](../architecture/SKILL.md)) |
| Frontend | `frontend-web` ([skills/frontend-web/SKILL.md](../frontend-web/SKILL.md)) |
| Backend / API | `backend-saas` ([skills/backend-saas/SKILL.md](../backend-saas/SKILL.md)) |
| Testing strategy | `testing` ([skills/testing/SKILL.md](../testing/SKILL.md)) |
| CI / Docker / deploy | `architecture` + read `.github/workflows/`, `docker-compose`, Dockerfiles |

4. **Stop for human approval** of the Tech Spec before **`/build`**.

## Outputs

- `feature/<slug>/tech-spec.md` (and linked ADR drafts under `adr/` if your repo uses them per **spec-management**)

## Rules

- Do not reopen settled Product decisions in the Tech Spec without flagging a **change request** to Product.
- **Conversation first** for technical ambiguities — same rhythm as `docs/AIDLC.md` orchestration model.
