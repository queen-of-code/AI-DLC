---
name: plan
description: AIDLC Plan phase — Product Spec on the Feature work item (default), conversation-first, human approval. Different owner may run /design for Tech Spec next. Not for quick bugfixes.
type: skill
aidlc_phases: [plan]
tags: [aidlc, orchestrator, plan, product-spec, specs]
requires: []
author: Melissa Benua
created_at: 2026-04-12
updated_at: 2026-09-28
---

# /plan — Plan (Product Spec)

You are the **phase orchestrator** for AIDLC **Plan** (Product Spec). Ground truth is **`docs/AIDLC.md`** in the **consumer workspace** (e.g. [alexa-recipe-app](https://github.com/queen-of-code/alexa-recipe-app) `docs/AIDLC.md`).

**Design (Tech Spec)** is a **separate** skill: **`/design`** ([skills/design/SKILL.md](../design/SKILL.md)) so a different person can own it after Product approval.

**Library skills and agents** — [docs/SKILLS.md](../../docs/SKILLS.md); resolve from your install or `.claude/skills/<bundle>/`.

## Before you start

1. Read **`AGENTS.md` → Issue tracker (AIDLC)** — [ISSUE-TRACKER-PORTABILITY.md](../../docs/ISSUE-TRACKER-PORTABILITY.md). Default **Spec storage** is **`issue-tracker`** (specs on the Feature work item, not in git).
2. Resolve **feature slug** from `$ARGUMENTS` or ask: kebab-case, stable for the life of the feature (branches, optional repo mirror).
3. **Parent Feature work item:** create or open it in the declared tracker. The issue is the **system of record** for the Product Spec unless **Spec storage** is `repo-feature-folder`.
4. **Only if `repo-feature-folder`:** ensure `feature/<slug>/` exists and copy **[`product-spec-template.md`](../spec-management/templates/product-spec-template.md)** → `product-spec.md` (optional seed of `tech-spec.md` for `/design`). Do **not** create `feature/<slug>/` when **Spec storage** is `issue-tracker`.
5. If **`AGENTS.md` has no tracker section**, ask which system holds Features, or follow repo docs (e.g. `docs/github-queue.md`). GitHub automation: [GITHUB-AIDLC-PROJECT.md](https://github.com/queen-of-code/AI-DLC/blob/main/docs/GITHUB-AIDLC-PROJECT.md). Setup: [ISSUE-TRACKER-PORTABILITY.md](https://github.com/queen-of-code/AI-DLC/blob/main/docs/ISSUE-TRACKER-PORTABILITY.md) and **`agent-issue-tracker-setup`**.

## Orchestration — Product Spec

1. Load **`spec-management`** ([skills/spec-management/SKILL.md](../spec-management/SKILL.md)) — § Spec storage.
2. Use **`agent-product-manager`** behavior ([skills/agents/agent-product-manager/SKILL.md](../agents/agent-product-manager/SKILL.md)) for a structured draft: problem, outcomes, success criteria, out-of-scope, constraints — per AIDLC Plan in `docs/AIDLC.md`.
3. **Write the Product Spec on the Feature work item** (Linear Document, GitHub issue section, etc.). Seed from **`product-spec-template.md`** when empty.
4. **Conversation first (required):** **Ask in chat** before treating the spec as ready. Do **not** use a long “open questions” block in the doc instead of talking to the human. Record **resolved** decisions briefly (e.g. **Decisions** subsection) after they answer. **Headless runs:** "ask in chat" means ask on the work item — one numbered comment @mentioning the owner — then **halt** until they answer ([docs/ASK-AND-HALT.md](../../docs/ASK-AND-HALT.md)). Never skip the question or proceed on a guess.
5. Run **`agent-grounding-reviewer`** on the **repo** — blocking vs advisory; don’t rewrite the whole spec silently ([skills/agents/agent-grounding-reviewer/SKILL.md](../agents/agent-grounding-reviewer/SKILL.md)).
6. **Stop for human approval** of the Product Spec.
7. **No** technical implementation, architecture, or API design here — that belongs in **`/design`**.
8. If **`repo-feature-folder`**, keep the tracker copy and repo `product-spec.md` in sync.

## Outputs

- **Product Spec** on the parent Feature work item (required).
- Optional `feature/<slug>/product-spec.md` only when **Spec storage** is `repo-feature-folder`.

## Handoff to Design

- After approval, the **same or another** person runs **`/design`** for the Tech Spec and review passes. **Do not** block on Tech Spec in this run unless the user explicitly asked for both in one session (prefer splitting for separate owners).

## Rules

- Follow AIDLC **orchestration rhythm** in `docs/AIDLC.md` (*Development: Orchestration Model*). User input = **chat** (or, headless, a comment thread on the work item), not only markdown edits.
- If an example in the spec must be reproduced exactly, **say so explicitly**; otherwise write the rule and let examples illustrate it ([INTENT-OVER-LITERAL.md](../../docs/INTENT-OVER-LITERAL.md)).
- Don’t paste large chunks of AIDLC into the spec; **link** where useful.
