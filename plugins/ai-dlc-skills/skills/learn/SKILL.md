---
name: learn
description: AIDLC Learn orchestrator. Run after Validate phase PASS — ADRs, docs, retrospective notes. Not combined with /ship in headless automation.
type: skill
aidlc_phases: [validate]
tags: [aidlc, orchestrator, learn, documentation, adr]
requires: []
author: Melissa Benua
created_at: 2026-06-09
updated_at: 2026-06-09
---

# /learn — Learn (phase orchestrator)

You are the **Learn orchestrator**. You run **after** the **Validate phase** (`/ship`) passes — not in the same headless run as Validate.

**Validate phase** (`/ship`): scorecard vs Product Spec, deploy/CI gates, UI validation when applicable, tracker closure on PASS.

**Learn** (this skill): capture what the cycle discovered so future agents do not rediscover it.

Canonical process: **`docs/AIDLC.md`** in the consumer workspace — Learn section.

**Library:** apply **`agent-learn`** ([skills/agents/agent-learn/SKILL.md](../agents/agent-learn/SKILL.md)), **`spec-management`**, **`architecture`**, **`git-workflow`** as needed — [docs/SKILLS.md](../../docs/SKILLS.md).

## Inputs

- Validate phase **PASS** (scorecard path, e.g. `feature/<slug>/validate-scorecard.md`)
- Merged PR link and changed files
- Parent work item (per **`AGENTS.md` → Issue tracker (AIDLC)**)
- `feature/<slug>/tech-spec.md` and `product-spec.md`

## Orchestration

1. **ADRs** — significant architectural decisions → `adr/NNNN-title.md` per [adr-template](../spec-management/templates/adr-template.md).
2. **Repo documentation** — README, `docs/`, context maps affected by the change.
3. **Retrospective notes** — append to Tech Spec(s): what differed from plan and why.
4. **Process friction** — brief note if AIDLC gates were painful (feeds process improvement).

Adapt **`agent-learn`** output paths to the consumer repo (`AGENTS.md` may override generic `PROJECT.md` expectations).

## Outputs

- `feature/<slug>/learn-notes.md` (or ADRs + short pointer)
- Documentation PR or commit
- Close or update parent work item per consumer **`AGENTS.md`**

## Do not

- Run Learn inside **`/ship`** in headless automation — Validate PASS first, then **`/learn`** or Learn subagent.
- Skip Learn because Validate passed — undocumented decisions tax every future agent.
