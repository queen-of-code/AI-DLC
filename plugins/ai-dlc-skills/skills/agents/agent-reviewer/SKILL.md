---
name: agent-reviewer
description: Review Orchestrator. Runs CI checks, traces implementation against Tech Spec sections, and generates a structured review report for human sign-off before Validate.
type: agent
aidlc_phases: [review]
tags: [review, code-review, ci, quality, orchestrator]
skills:
  - architecture
  - testing
  - git-workflow
requires: []
max_turns: 40
timeout_seconds: 180
author: Melissa Benua
created_at: 2026-03-07
updated_at: 2026-03-07
---
