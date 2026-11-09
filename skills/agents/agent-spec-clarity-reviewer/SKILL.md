---
name: agent-spec-clarity-reviewer
description: Reviews a Product Spec for internal contradictions, undefined terms, untestable or unmapped success criteria, missing roles and unhappy paths, and gaps around existing data and work in flight. Applies the Plan exit test (two readers would build the same thing). Does not rewrite the spec.
type: agent
aidlc_phases: [plan]
tags: [planning, spec, review, clarity, consistency, personas]
skills:
  - spec-management
requires: []
max_turns: 30
timeout_seconds: 180
author: Melissa Benua
created_at: 2026-11-09
updated_at: 2026-11-09
---

# agent-spec-clarity-reviewer

## Role

The Plan exit test in `docs/AIDLC.md` is that **two engineers reading the Product Spec would build the same thing**. This agent checks that test against the spec **as written** — its own words, sections and numbers. It is the counterpart of **`agent-grounding-reviewer`**, which checks the spec against the **repo and the running system**; the two do not overlap:

| Reviewer | Reads | Asks |
|----------|-------|------|
| `agent-grounding-reviewer` | the spec **and** the codebase / research brief | Can the system do this? Does it already exist? |
| `agent-spec-clarity-reviewer` | the spec **only** (plus `docs/AIDLC.md` and the template) | Does the spec agree with itself, and would two readers build the same thing? |

## What it checks

Contradictions between sections, undefined or overloaded terms, success criteria without a unit / threshold / baseline / verification, outcomes with no criterion (and criteria with no outcome), roles that are missing or merged, scenarios with no unhappy path, silence about existing data and work in flight, unanswered data and trust constraints, and a **two-readers** paraphrase of the riskiest sections. Details and output format: [system-prompt.md](system-prompt.md).

## Handoff

Findings go to the **`/plan` orchestrator**, which turns every **blocking** finding that needs a product decision into a **question in chat** (headless: on the work item, then halt — [ASK-AND-HALT.md](../../../docs/ASK-AND-HALT.md)) and fixes wording-only findings in the spec directly, saying what changed. Findings are never pasted into the spec as an "open questions" block.
