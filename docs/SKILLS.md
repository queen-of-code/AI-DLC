# Skills & Agents

This document describes the bundle format for skills and agents in this library, along with the schema rules enforced by CI.

---

## Bundle Directory Structure

All skills and agents live under `skills/`. Each bundle is a directory named after the skill or agent:

```
skills/
  <bundle-name>/
    SKILL.md            # required: YAML frontmatter + prompt instructions
    tool.ts             # optional: typed execute()
    tool.test.ts        # required if tool.ts exists (CI hard failure otherwise)
    system-prompt.md    # optional: agents only; separate system prompt for the agent loop
```

### File Rules

| File | Skill | Agent | Notes |
|---|---|---|---|
| `SKILL.md` | required | required | Frontmatter + prompt instructions |
| `tool.ts` | optional | optional | Must export `InputSchema`, `OutputSchema`, `execute()` |
| `tool.test.ts` | required if `tool.ts` exists | required if `tool.ts` exists | CI enforces this; no exceptions |
| `system-prompt.md` | not used | optional | Separate system prompt for the agent loop |

---

## `SKILL.md` Frontmatter Schema

Every `SKILL.md` starts with YAML frontmatter. The schema is enforced by the Zod schema in `agent-library-mcp/src/manifest.ts` — CI uses this same file.

### Skill Frontmatter

```yaml
---
name: blog-writing                         # required: unique ID, matches directory name
description: Write blog posts in ...       # required: one sentence for discovery
type: skill                                # required: "skill" | "agent"
aidlc_phases: [plan]                       # required: one or more phases (see manifest.ts)
tags: [writing, content, blog]             # optional: for filtering and search
tool_file: tool.ts                         # optional: present only if execute() is exported
requires: []                               # optional: skill IDs injected as context (transitively resolved)
---
```

Skills **cannot** declare a `skills:` field. That is an agent-only field. CI will reject it.

### Agent Frontmatter

Agents extend the skill schema with a `skills` list and optional loop control:

```yaml
---
name: researcher                           # required
description: Explores codebases and ...   # required
type: agent                                # required: must be "agent"
aidlc_phases: [design, build, review]     # required
tags: [research, exploration]             # optional
skills:                                    # required for agents: at least one skill ID
  - typescript-analysis
  - api-design
requires: []                               # optional
max_turns: 40                              # optional: loop iteration limit
timeout_seconds: 180                       # optional: wall-clock timeout
---
```

### AIDLC Phases

Valid values are defined in `agent-library-mcp/src/manifest.ts` (`AidlcPhase`). The table in older docs may list synonyms; **the Zod enum is authoritative**.

---

## `tool.ts` Contract

If a bundle exports deterministic logic, it must follow this contract exactly:

```typescript
import { z } from "zod";

export const InputSchema = z.object({ ... });
export const OutputSchema = z.object({ ... });
export type Input = z.infer<typeof InputSchema>;
export type Output = z.infer<typeof OutputSchema>;

export async function execute(input: Input): Promise<Output> { ... }
```

Rules:
- `InputSchema` and `OutputSchema` are required named exports
- `execute` is a required named export
- `tool.test.ts` is **mandatory** when `tool.ts` exists — CI blocks merge otherwise

---

## Available Skills

<!-- Keep this table updated when adding or removing skills. -->

| Name | Type | AIDLC Phases | Description |
|---|---|---|---|
| `plan` | skill | plan, design | AIDLC Plan + Design orchestrator (`/plan`) — Product Spec (chat Q&A before doc-only questions), Tech Spec, human gates |
| `build` | skill | build, test | AIDLC Build + Test (`/build`) — open PR + green CI; TDD; PR triage after `/review` |
| `review` | skill | review, test | AIDLC Test gate + Review orchestrator (`/review`) — five PR comment dimensions |
| `ship` | skill | validate | AIDLC Validate + Learn orchestrator (`/ship`) — scorecard, learnings, merge checklist |
| `architecture` | skill | build, review | Apply software architecture best practices and design patterns |
| `backend-saas` | skill | design, build | SaaS backend development patterns including API design and multi-tenancy |
| `blog-writing` | skill | plan | Write blog posts in Melissa Benua's voice and style |
| `frontend-web` | skill | build | Modern web development patterns for React, Vue, and vanilla JS |
| `gdoc-to-markdown` | skill | build | Download Google Docs as markdown files to external-brain folder |
| `git-workflow` | skill | build, test, review | Git workflow standards including commit messages and branch management |
| `greeting` | skill | plan | Personal greeting preference |
| `mobile-apple` | skill | build | iOS and macOS development patterns using Swift and SwiftUI |
| `spec-management` | skill | plan, design | Product Spec, Tech Spec, and ADR templates; conversation-first Product Spec; link ADRs from Tech Specs |
| `testing` | skill | build, review | Apply comprehensive testing best practices |
| `work-tracking` | skill | plan | Structure work using parent-feature and child-work-item hierarchy |

### Agents (selected)

| Name | Type | AIDLC Phases | Description |
|---|---|---|---|
| `agent-devops-review` | agent | review | DevOps dimension for `/review` — CI/CD, containers, rollout, monitoring vs Tech Spec |
| `agent-security-review` | agent | review | Security dimension for `/review` — secrets, auth, deps, obvious web/data issues |

See `skills/agents/` for the full agent library.

---

## AIDLC phase orchestrators (Cursor / Agent Skills)

These bundles live under `skills/` with `type: skill` and are invoked as **`/plan`**, **`/build`**, **`/review`**, **`/ship`** when installed (e.g. Claude Code skills, Cursor `.claude/skills/`). They reference **`docs/AIDLC.md` in the consumer workspace** — each repo vendors or links that document.

**Note:** A separate private stack may define **runtime** orchestrators (`type: orchestrator`, control plane, sessions). This repo contains **only** the Cursor/Claude markdown skill bundles above.

---

## Adding a New Skill

1. Create `skills/<your-skill-name>/SKILL.md` with valid frontmatter (see schema above)
2. If you add `tool.ts`, also add `tool.test.ts` — CI will block your PR if you don't
3. Update the Available Skills table in this document
4. Open a PR; CI will lint your manifest, typecheck, and run tests automatically

## Adding a New Agent

Same as a skill, plus:
- Set `type: agent` in frontmatter
- Declare at least one skill ID in the `skills` list
- Optionally add `system-prompt.md` for a separate agent loop system prompt
