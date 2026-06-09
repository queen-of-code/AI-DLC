---
name: ship
description: AIDLC Validate phase orchestrator (/ship). Scorecard vs Product Spec, deploy gates, UI validation when applicable. Learn is separate — run /learn after PASS.
type: skill
aidlc_phases: [validate]
tags: [aidlc, orchestrator, validate, ship]
requires: []
author: Melissa Benua
created_at: 2026-04-12
updated_at: 2026-06-09
---

# /ship — Validate phase orchestrator

You are the **Validate phase** orchestrator (`/ship`). You verify the Feature against the **Product Spec** and declare PASS or FAIL.

**Do not conflate with UI validation.** Interactive UI checks use **[docs/INTERACTIVE-UI-VALIDATION.md](../../docs/INTERACTIVE-UI-VALIDATION.md)** (Chrome DevTools MCP) — a **technique inside** this phase when UI success criteria exist, not a separate AIDLC phase.

**Learn is not in this run.** After Validate PASS, run **`/learn`** ([skills/learn/SKILL.md](../learn/SKILL.md)) or the consumer’s Learn subagent.

Canonical definition: **`docs/AIDLC.md`** in the consumer workspace — Validate section.

**Library:** **`architecture`**, **`git-workflow`** — [docs/SKILLS.md](../../docs/SKILLS.md).

## Inputs

- `feature/<slug>/product-spec.md` (success criteria)
- `feature/<slug>/tech-spec.md`
- Shipped or ship-candidate implementation; merged PR link(s)
- Deploy/CI status (consumer declares workflow names in `AGENTS.md` or launch prompt)

## Orchestration

1. **Deploy / CI gate (when consumer requires post-merge validation):** Confirm required deploy and smoke workflows succeeded before exercising the app. On failure → Validate FAIL; do not browser-test a broken deploy.
2. **UI validation (when Product Spec or Tech Spec has UI criteria):** Follow **[docs/INTERACTIVE-UI-VALIDATION.md](../../docs/INTERACTIVE-UI-VALIDATION.md)** against the consumer’s staging or local URL from **`AGENTS.md`**. Screenshot evidence for blocking mismatches.
3. **Scorecard:** For each success criterion in the Product Spec, record pass/fail and evidence. Default **90%** gate per AIDLC — document if the team uses another threshold.
4. **On failure:** Cite criteria, evidence, and **which phase to return to** (Plan, Design, Build, Test, Review) per AIDLC.
5. **On PASS:** Close or update trackers per consumer **`AGENTS.md`**. **Do not** write ADRs or run Learn here — hand off to **`/learn`**.

## Outputs

- `feature/<slug>/validate-scorecard.md`
- Optional `feature/<slug>/ship-report.md` (evidence bundle)
- Tracker updates on PASS or rework labels on FAIL (consumer-defined)

## Handoff to Learn

When scorecard meets threshold and human/consumer policy allows closure:

> Validate phase complete. Run **`/learn`** to capture ADRs, docs, and retrospective notes before marking the Feature done.
