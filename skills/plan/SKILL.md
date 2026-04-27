---
name: plan
description: AIDLC Plan phase — Product Spec only under feature/<slug>/, conversation-first, human approval. Different owner may run /design for Tech Spec next. Not for quick bugfixes.
type: skill
aidlc_phases: [plan]
tags: [aidlc, orchestrator, plan, product-spec, specs]
requires: []
author: Melissa Benua
created_at: 2026-04-12
updated_at: 2026-04-21
---

# /plan — Plan (Product Spec)

You are the **phase orchestrator** for AIDLC **Plan** (Product Spec). Ground truth is **`docs/AIDLC.md`** in the **consumer workspace** (e.g. [alexa-recipe-app](https://github.com/queen-of-code/alexa-recipe-app) `docs/AIDLC.md`).

**Design (Tech Spec)** is a **separate** skill: **`/design`** ([skills/design/SKILL.md](../design/SKILL.md)) so a different person can own it after Product approval.

**Library skills and agents** — [docs/SKILLS.md](../../docs/SKILLS.md); resolve from your install or `.claude/skills/<bundle>/`.

## Before you start

1. Resolve **feature slug** from `$ARGUMENTS` or ask: kebab-case, stable for the life of the feature.
2. Ensure `feature/<slug>/` exists. If empty, copy **[`product-spec-template.md`](../spec-management/templates/product-spec-template.md)** → `product-spec.md` (and optionally seed **`tech-spec-template.md`** → `tech-spec.md` so `/design` has a file to fill — or let `/design` create it; see [design skill](../design/SKILL.md)).
3. **Parent work item:** Read **`AGENTS.md` → Issue tracker (AIDLC)** if the repo documents it — that is the source of truth for which system (GitHub, Linear, Jira, …) holds the Feature. Create or link the **parent** item there; its body/description must link to `feature/<slug>/`. If **`AGENTS.md` has no tracker section**, ask which system to use or follow existing queue docs (e.g. `docs/github-queue.md`). For **GitHub Projects (classic)** automation, see [GITHUB-AIDLC-PROJECT.md](https://github.com/queen-of-code/AI-DLC/blob/main/docs/GITHUB-AIDLC-PROJECT.md). For choosing a tracker or filling `AGENTS.md`, see [ISSUE-TRACKER-PORTABILITY.md](https://github.com/queen-of-code/AI-DLC/blob/main/docs/ISSUE-TRACKER-PORTABILITY.md) and **`agent-issue-tracker-setup`**.

## Orchestration — Product Spec (`product-spec.md`)

1. Load **`spec-management`** ([skills/spec-management/SKILL.md](../spec-management/SKILL.md)).
2. Use **`agent-product-manager`** behavior ([skills/agents/agent-product-manager/SKILL.md](../agents/agent-product-manager/SKILL.md)) for a structured draft: problem, outcomes, success criteria, out-of-scope, constraints — per AIDLC Plan in `docs/AIDLC.md`.
3. **Conversation first (required):** **Ask in chat** before treating the spec as ready. Do **not** use a long “open questions” block in the doc instead of talking to the human. Record **resolved** decisions briefly (e.g. **Decisions** subsection) after they answer.
4. Run **`agent-grounding-reviewer`** on the **repo** — blocking vs advisory; don’t rewrite the whole spec silently ([skills/agents/agent-grounding-reviewer/SKILL.md](../agents/agent-grounding-reviewer/SKILL.md)).
5. **Stop for human approval** of the Product Spec.
6. **No** technical implementation, architecture, or API design here — that belongs in **`/design`**.

## Outputs

- `feature/<slug>/product-spec.md`

## Handoff to Design

- After approval, the **same or another** person runs **`/design`** for `tech-spec.md` and review passes. **Do not** block on Tech Spec in this run unless the user explicitly asked for both in one session (prefer splitting for separate owners).

## Rules

- Follow AIDLC **orchestration rhythm** in `docs/AIDLC.md` (*Development: Orchestration Model*). User input = **chat**, not only markdown edits.
- Don’t paste large chunks of AIDLC into the spec; **link** where useful.
