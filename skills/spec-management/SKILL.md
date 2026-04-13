---
name: spec-management
description: Create, organize, and maintain feature specifications following standardized templates. Use when creating specs, updating documentation, planning features, or organizing project documentation.
type: skill
aidlc_phases: [plan, design]
tags: [specs, documentation, planning, features]
requires: []
author: Melissa Benua
created_at: 2026-03-07
updated_at: 2026-04-13
---

# Spec Management

## When to Use

- Creating new feature specifications
- Organizing existing documentation
- Planning complex features
- Reviewing spec completeness
- Archiving implemented specs

## When to Create a Spec

Create a spec when:
- Feature takes more than 2-3 days to implement
- Multiple people will work on the feature
- Feature spans frontend and backend
- Significant architectural decisions needed
- External dependencies or integrations involved
- Feature requires stakeholder sign-off

Skip a spec when:
- Simple bug fix or minor enhancement
- Well-understood change with clear scope
- Task completable in a few hours
- No cross-team coordination needed

## Spec & ADR layout (AIDLC)

Use **three** artifacts; do not fold them into one mega-doc:

| Artifact | Typical path | Purpose |
|----------|--------------|---------|
| **Product Spec** | `feature/<slug>/product-spec.md` | Outcomes, users, scenarios, success criteria, scope — **product language** |
| **Tech Spec** | `feature/<slug>/tech-spec.md` | Implementation per **Unit**; links **ADRs**; testing, rollout, monitoring |
| **ADR** | `adr/NNNN-short-title.md` | Durable **architectural** decisions (stack shape, auth model, service boundaries, …) |

**All templates** (including ADR) live under [`templates/`](templates/) so the Claude Code plugin packages them with **`spec-management`**.

- [`templates/product-spec-template.md`](templates/product-spec-template.md)
- [`templates/tech-spec-template.md`](templates/tech-spec-template.md)
- [`templates/adr-template.md`](templates/adr-template.md) — copy into your project’s **`adr/NNNN-title.md`**
- [`templates/adr-guidance.md`](templates/adr-guidance.md) — naming, when to write, how ADRs relate to Product/Tech specs

### Naming conventions

- **Feature folder:** `feature/<kebab-slug>/` stable for the life of the feature
- **ADRs (in the consumer repo):** `adr/0001-example-title.md` (sequential numbering; use `adr-template.md` as the source to copy, not as a numbered file)

### Legacy `specs/` trees

Older repos may still use `specs/frontend/`, `specs/backend/`. Prefer **`feature/<slug>/`** + **`adr/`** for new work so `/plan` and Learn stay aligned.

## Plan phase (Product Spec): conversation vs. document

During **Plan** (the Product Spec), **unresolved product questions belong in the conversation first** — ask the human in-thread (chat) when they are available. The **spec is the record of what was decided**, not a substitute for that dialogue. Do not treat a long “Open questions” section in the markdown as the primary way to discover requirements when interactive Q&A is possible.

After decisions are made, reflect them in the Product Spec (including a short **Decisions** subsection if helpful). This aligns with the **`/plan`** orchestrator’s conversation-first gate ([skills/plan/SKILL.md](../plan/SKILL.md)).

## Related Specs

When specs have dependencies, link them bidirectionally:

```markdown
## Related Specs
- Frontend: frontend/user-profile-page.md
  - Implements the UI for this service
- Backend: backend/user-service.md
  - Provides the API endpoints for this feature
- Related: backend/media-service.md
  - Handles image processing for user profiles
```

**Rules:**
- Use relative paths from specs root
- Include brief description of the relationship
- Update both specs when creating links
- Update links when moving or renaming specs

## Writing Good Acceptance Criteria

### SMART Criteria

| Property | Description |
|----------|-------------|
| **Specific** | Clearly defined, no ambiguity |
| **Measurable** | Can verify completion |
| **Achievable** | Technically feasible |
| **Relevant** | Tied to feature goals |
| **Testable** | Can write tests for it |

### Examples

**Good criteria:**
```markdown
- [ ] User can upload profile image up to 5MB
- [ ] Image is resized to 200x200 for thumbnail
- [ ] Profile updates reflect within 5 seconds
- [ ] Error message shown if image upload fails
- [ ] Profile image persists across sessions
```

**Bad criteria:**
```markdown
- [ ] Profile should work well
- [ ] Good user experience
- [ ] Fast performance
- [ ] Handle all edge cases
```

## Spec Lifecycle

```
┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐
│  Draft   │──▶│ Review   │──▶│ Approved │──▶│ In Prog  │
└──────────┘   └──────────┘   └──────────┘   └──────────┘
                    │                              │
                    ▼                              ▼
              ┌──────────┐                   ┌──────────┐
              │ Rejected │                   │Implemented│
              └──────────┘                   └──────────┘
                                                  │
                                                  ▼
                                            ┌──────────┐
                                            │ Archived │
                                            └──────────┘
```

### Status Definitions

| Status | Meaning |
|--------|---------|
| **Draft** | Initial version, still being written |
| **Review** | Ready for stakeholder review |
| **Approved** | Approved for implementation |
| **In Progress** | Implementation started |
| **Implemented** | Feature shipped, spec complete |
| **Archived** | Moved to archive after 30 days |
| **Rejected** | Not approved, will not implement |

### Archive Policy

1. Mark spec as "Implemented" with date when feature ships
2. After 30 days, move to `specs/archive/`
3. Keep archived specs for historical reference
4. Delete archived specs after 1 year (optional)

## Spec Review Process

### Before Review

- [ ] All required sections complete
- [ ] Acceptance criteria are testable
- [ ] Related specs are linked
- [ ] Technical approach reviewed with team
- [ ] No open questions or TODOs

### Review Checklist

| Area | Questions |
|------|-----------|
| **Scope** | Is scope clearly defined? Any ambiguity? |
| **Feasibility** | Is this technically achievable? |
| **Dependencies** | Are all dependencies identified? |
| **Edge Cases** | Are edge cases documented? |
| **Testing** | Can we write tests for this? |
| **Rollback** | How do we revert if needed? |

## Templates

Copy from [templates/](templates/):

| File | Use |
|------|-----|
| [product-spec-template.md](templates/product-spec-template.md) | Plan → `feature/<slug>/product-spec.md` |
| [tech-spec-template.md](templates/tech-spec-template.md) | Design → `feature/<slug>/tech-spec.md` |
| [adr-template.md](templates/adr-template.md) | Learn / Design → project `adr/NNNN-title.md` |
| [adr-guidance.md](templates/adr-guidance.md) | Convention for the **`adr/`** folder in each repo |

## Scripts

Available automation:

```bash
# Validate spec completeness
python scripts/validate-spec.py specs/frontend/my-feature.md

# Archive old implemented specs
./scripts/archive-old-specs.sh

# List specs by status
./scripts/list-specs.sh --status=draft
```

## Best Practices

### Do

- Start with the problem, not the solution
- Include concrete examples
- Get early feedback on drafts
- Update specs as requirements change
- Link related specs bidirectionally
- Include non-goals to limit scope

### Don't

- Mix frontend and backend in one spec
- Leave vague acceptance criteria
- Skip the rollback plan
- Forget to update status
- Let specs go stale
- Over-engineer simple features

## Additional Resources

- [Product Spec template](templates/product-spec-template.md)
- [Tech Spec template](templates/tech-spec-template.md)
- [ADR template](templates/adr-template.md) · [ADR folder guidance](templates/adr-guidance.md)
- [Validation Script](scripts/validate-spec.py) (legacy section checks — may not match split specs)
- [Archive Script](scripts/archive-old-specs.sh)
