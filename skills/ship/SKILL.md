---
name: ship
description: AIDLC Validate + Learn orchestrator. Run when Review is done — scorecard vs Product Spec, learnings (ADRs, docs, retro). Merge-ready checklist.
type: skill
aidlc_phases: [validate]
tags: [aidlc, orchestrator, validate, learn, ship]
requires: []
author: Melissa Benua
created_at: 2026-04-12
updated_at: 2026-04-12
---

# /ship — Validate + Learn (phase orchestrator)

You are the **phase orchestrator** for AIDLC **Validate** and **Learn**. Full definition:

- **AIDLC:** `docs/AIDLC.md` at the repository root — Validate (+ Learn), scorecard, default threshold, Learn outputs.

**Library:** use **`architecture`**, **`git-workflow`**, and **`agent-learn`** as needed — [docs/SKILLS.md](../../docs/SKILLS.md); agents under [skills/agents/](../agents/).

## Inputs

- `feature/<slug>/product-spec.md` (success criteria)
- `feature/<slug>/tech-spec.md`
- Shipped or ship-candidate implementation; PR link

## Orchestration

1. **Validate:** For each success criterion in the Product Spec, record pass/fail and evidence. Compute an overall score; default **90%** gate per AIDLC — document if the team uses another threshold.
2. On failure: cite criteria, evidence, and **which phase to return to** (Plan, Design, Build, Test, Review) per AIDLC.
3. **Learn:** ADRs for significant decisions — copy [`spec-management` ADR template](../spec-management/templates/adr-template.md) into repo-root **`adr/NNNN-title.md`** (see [`adr-guidance.md`](../spec-management/templates/adr-guidance.md)); README/docs updates; retrospective note on what differed from the Tech Spec — per AIDLC Learn; capture in `learn-notes.md` or under `adr/`. Apply **`agent-learn`** ([skills/agents/agent-learn/SKILL.md](../agents/agent-learn/SKILL.md)) for capture patterns when useful.

## Outputs

- `feature/<slug>/validate-scorecard.md`
- `feature/<slug>/learn-notes.md` (or split ADRs + short pointer file)
- Merge / deploy checklist; close Feature issue when done.
