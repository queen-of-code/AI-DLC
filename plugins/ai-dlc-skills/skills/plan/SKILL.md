---
name: plan
description: AIDLC Plan phase — Product Spec on the Feature work item (default), conversation-first, human approval. Different owner may run /design for Tech Spec next. Not for quick bugfixes.
type: skill
aidlc_phases: [plan]
tags: [aidlc, orchestrator, plan, product-spec, specs]
requires: []
author: Melissa Benua
created_at: 2026-04-12
updated_at: 2026-11-09
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

The steps run in this order. Each specialist reads and revises **one** current draft (`spec_draft`); none works from a stale copy. Run the specialists as real subagents where the harness supports it, or apply each one's instructions yourself in turn — either way, **every step runs**, and the run says which ran.

1. Load **`spec-management`** ([skills/spec-management/SKILL.md](../spec-management/SKILL.md)) — § Spec storage — and seed the draft from **[`product-spec-template.md`](../spec-management/templates/product-spec-template.md)**. Every template section is filled or says in one line why it does not apply; none is silently dropped.
2. **Research** with **`agent-researcher`** in planning mode ([skills/agents/agent-researcher/SKILL.md](../agents/agent-researcher/SKILL.md)): does anything like this already exist, what do we know about the people affected, which decisions (ADRs, earlier specs) bind it. This brief is what the Grounding Reviewer checks against later.
3. **Roles first, in conversation.** Before drafting outcomes, fill the template's **Users and roles** table with the human: every role the feature uses, asks, notifies, acts for, or whose data it handles — split roles where two people know or decide different things (owner vs the person who does the work; a business vs its own clients; a reviewer vs whoever fixes what the reviewer rejects). For each role ask: who actually answers this feature's questions? Outcomes and scenarios are then written per role.
4. **Draft** with **`agent-product-manager`** ([skills/agents/agent-product-manager/SKILL.md](../agents/agent-product-manager/SKILL.md)): problem, baseline, outcomes, success criteria (unit, threshold, baseline, verification, outcome), scenarios with their unhappy paths, scope, existing data and work in flight, constraints (always Data and Trust), terms — per AIDLC Plan in `docs/AIDLC.md`.
5. **Customer pass** with **`agent-product-marketer`** ([skills/agents/agent-product-marketer/SKILL.md](../agents/agent-product-marketer/SKILL.md)): each role's experience in concrete terms — what changes in their day, how they are told about work that finishes while they are away — without changing scope.
6. **Write the Product Spec on the Feature work item** (Linear Document, GitHub issue section, etc.).
7. **Conversation first (required):** **Ask in chat** before treating the spec as ready — every `pm_questions` item and every review finding that needs a product decision. Do **not** use a long “open questions” block in the doc instead of talking to the human. Record **resolved** decisions briefly (the template's **Decisions** table) after they answer. **Headless runs:** "ask in chat" means ask on the work item — one numbered comment @mentioning the owner — then **halt** until they answer ([docs/ASK-AND-HALT.md](../../docs/ASK-AND-HALT.md)). Never skip the question or proceed on a guess.
8. **Two review passes**, independent of each other (run them in parallel where possible):
   - **`agent-grounding-reviewer`** against the **repo** and the research brief — can the system do this, does it already exist ([skills/agents/agent-grounding-reviewer/SKILL.md](../agents/agent-grounding-reviewer/SKILL.md));
   - **`agent-spec-clarity-reviewer`** against the **spec itself** — contradictions, undefined terms, criteria without unit/threshold/baseline/outcome, missing roles and unhappy paths, existing data and work in flight, and the two-readers test ([skills/agents/agent-spec-clarity-reviewer/SKILL.md](../agents/agent-spec-clarity-reviewer/SKILL.md)).

   Fix **wording-only** findings in the spec and say what changed; turn findings that **need a decision** into questions (step 7). Don’t rewrite the whole spec silently. After answers land, **re-run the clarity pass**; repeat until it reports no **blocking** finding.
9. **Stop for human approval** of the Product Spec. Before asking, state in one line each: the roles covered, that every outcome has a criterion, and the clarity verdict.
10. **No** technical implementation, architecture, or API design here — that belongs in **`/design`**.
11. If **`repo-feature-folder`**, keep the tracker copy and repo `product-spec.md` in sync.

## Outputs

- **Product Spec** on the parent Feature work item (required).
- Optional `feature/<slug>/product-spec.md` only when **Spec storage** is `repo-feature-folder`.

## Handoff to Design

- After approval, the **same or another** person runs **`/design`** for the Tech Spec and review passes. **Do not** block on Tech Spec in this run unless the user explicitly asked for both in one session (prefer splitting for separate owners).

## Rules

- Follow AIDLC **orchestration rhythm** in `docs/AIDLC.md` (*Development: Orchestration Model*). User input = **chat** (or, headless, a comment thread on the work item), not only markdown edits.
- If an example in the spec must be reproduced exactly, **say so explicitly**; otherwise write the rule and let examples illustrate it ([INTENT-OVER-LITERAL.md](../../docs/INTENT-OVER-LITERAL.md)).
- Don’t paste large chunks of AIDLC into the spec; **link** where useful.
