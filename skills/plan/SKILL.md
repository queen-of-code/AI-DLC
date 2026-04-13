---
name: plan
description: AIDLC Plan + Design orchestrator. Run when starting a feature — draft Product Spec and Tech Spec under feature/<slug>/, human gates, specialist Tech Spec review. Do not use for quick bugfixes.
type: skill
aidlc_phases: [plan, design]
tags: [aidlc, orchestrator, plan, design, specs]
requires: []
author: Melissa Benua
created_at: 2026-04-12
updated_at: 2026-04-12
---

# /plan — Plan + Design (phase orchestrator)

You are the **phase orchestrator** for AIDLC **Plan** and **Design**. Ground truth for phases, gates, and nomenclature is **not** in this file — read the canonical doc in the **workspace**:

- **AIDLC (canonical):** `docs/AIDLC.md` at the repository root (each project vendors or links this; e.g. [alexa-recipe-app](https://github.com/queen-of-code/alexa-recipe-app) tutorial uses `docs/AIDLC.md`).

**Library skills and agents** live in this repo under `skills/` — resolve them from your install (global AI-DLC / Claude plugin `ai-dlc-skills`) or from a vendored copy (e.g. `.claude/skills/<bundle>/` in the consumer repo). Catalog: [docs/SKILLS.md](../../docs/SKILLS.md).

## Before you start

1. Resolve **feature slug** from `$ARGUMENTS` or ask: kebab-case, stable for the life of the feature.
2. Ensure directory `feature/<slug>/` exists; copy from `feature/_template/` if empty (or your repo’s equivalent).
3. Open or create **GitHub** parent issue for the Feature (sub-issues allowed). Body must link to `feature/<slug>/`. If the repo documents a queue (e.g. `docs/github-queue.md`), follow it.

## Orchestration flow (do not skip human gates)

### A — Product Spec (`product-spec.md`)

1. Load and apply library skill **`spec-management`** ([skills/spec-management/SKILL.md](../spec-management/SKILL.md)).
2. Use **`agent-product-manager`** bundle behavior ([skills/agents/agent-product-manager/SKILL.md](../agents/agent-product-manager/SKILL.md)) for structured draft: problem, outcomes, success criteria for later Validate, out-of-scope, constraints — per AIDLC Plan phase in AIDLC.md.
3. **Conversation first (required):** Plan is a **dialogue**, not a form. If anything is ambiguous for product decisions (priorities, defaults, edge-case behavior, who the feature is for), **ask those questions in the chat** before you treat the Product Spec as ready. Do **not** use a long “Open questions” section in the document as a substitute for asking the human in-thread. You may record **resolved** decisions in the spec (short bullets or a small “Decisions” subsection) after the user answers.
4. Run **`agent-grounding-reviewer`** against the **repo** — flag blocking vs advisory; do not rewrite the whole spec silently ([skills/agents/agent-grounding-reviewer/SKILL.md](../agents/agent-grounding-reviewer/SKILL.md)).
5. **Stop for human approval** of Product Spec before Design.
6. DO NOT include technical implementation details or code architecture during this phase.
7. Anchor on outcomes: how we will know this feature succeeded (customers, production behavior, etc.).

### B — Tech Spec (`tech-spec.md`)

1. Translate approved Product Spec into one or more **Units**; one Tech Spec document for this feature folder unless the user splits work across sub-issues (link related specs).
2. Include: scope, architecture, API/UI contracts, data model, acceptance criteria for Review, **testing approach** (what Build+Test must cover), risks — per AIDLC Design phase.
3. **Tech Spec review passes** (nested library skills — run in order, merge resolved findings into the doc; initial issues go in an appendix):

| Pass | Library skill |
|------|----------------|
| Architecture / boundaries | `architecture` ([skills/architecture/SKILL.md](../architecture/SKILL.md)) |
| Frontend | `frontend-web` ([skills/frontend-web/SKILL.md](../frontend-web/SKILL.md)) |
| Backend / API | `backend-saas` ([skills/backend-saas/SKILL.md](../backend-saas/SKILL.md)) |
| Testing strategy | `testing` ([skills/testing/SKILL.md](../testing/SKILL.md)) |
| CI / Docker / deploy surface | `architecture` + read `.github/workflows/`, `docker-compose`, Dockerfiles |

4. **Stop for human approval** of Tech Spec before `/build`.

## Outputs

- `feature/<slug>/product-spec.md`
- `feature/<slug>/tech-spec.md`

## Rules

- Follow AIDLC **orchestration rhythm**: surface drafts → **chat with the user** (questions and clarifications) → revise → explicit **approve** before the next artifact (see `docs/AIDLC.md`, *Development: Orchestration Model*). User input means **messages in the conversation**, not only edits to markdown.
- Do not paste large chunks of `docs/AIDLC.md` into specs; **link** to it where needed.
