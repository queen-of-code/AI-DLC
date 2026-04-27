---
name: report-bug
description: Bug triage and structured report orchestrator — collects environment, reproduction steps, exact errors, observability evidence; conversation-first; never assumes.
type: skill
aidlc_phases: [plan, design, build, test, review]
tags: [bugs, triage, incidents, observability, quality]
requires: []
author: Melissa Benua
created_at: 2026-04-20
updated_at: 2026-04-20
---

# report-bug — Structured bug report / triage

## When to use

- User reports something “broken” without enough detail to act
- You need a **reproducible** picture before opening an issue or pulling in `testing` / `architecture`
- Incidents where **observability** (logs, traces, metrics) matters

## Principles

1. **Conversation first** — Ask in chat; do not fill a giant “open questions” template instead of talking to the human.
2. **Never assume** — If you don’t know version, environment, or what “expected” means, **ask**; don’t invent product behavior.
3. **Exact signals** — Prefer paste of **full** error text, exit codes, HTTP status + body snippets, trace IDs, and **one** minimal repro path over vague summaries.

## What to collect (checklist)

Work through these in order; skip only when clearly N/A.

| Area | Capture |
|------|--------|
| **Scope** | What feature, route, command, or job? What did the user expect vs see? |
| **Environment** | OS, runtime version, region, feature flags, browser (if UI), deployment (local/stage/prod). |
| **Reproduction** | Numbered steps; smallest data set; whether it’s flaky or always. |
| **Errors** | Full message, stack top frames, correlation / request / trace IDs. |
| **Observability** | Relevant log lines, metric names, dashboards, time window. |
| **Recency** | Last known good, first failure, recent deploys or config changes. |
| **Security** | Redact secrets in outputs; never ask the user to paste tokens. |

## Output

Produce a short, **structured** draft the user can paste into GitHub (or attach to a parent feature). Suggested sections:

1. Summary (one paragraph)
2. Expected vs actual
3. Environment
4. Steps to reproduce
5. Evidence (errors, logs, links to traces)
6. Hypothesis (optional — label as guess)
7. Open questions (only what’s still unresolved after the chat)

Pull in **`testing`** ([skills/testing/SKILL.md](../testing/SKILL.md)) when designing a **minimal repro** or deciding what automated check would catch this class of bug next time.

## Rules

- Do not draft a “final” issue until the user confirms accuracy of repro and environment.
- If the report belongs under an existing feature folder, point to `feature/<slug>/` and the relevant issue numbers.
