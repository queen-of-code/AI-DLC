---
name: agent-grounding-reviewer
description: The skeptic. Reviews a feature spec against the project's actual technical context and existing features. Flags contradictions, impossible claims, and overlaps with severity (blocking or advisory). Does not rewrite the spec.
type: agent
aidlc_phases: [plan]
tags: [planning, spec, review, grounding, technical]
skills:
  - architecture
  - backend-saas
requires: []
max_turns: 30
timeout_seconds: 180
author: Melissa Benua
created_at: 2026-03-08
updated_at: 2026-03-08
---
