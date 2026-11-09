# Product Spec — [Feature title]

**AIDLC phase:** Plan  
**Audience:** Product, engineering leads, stakeholders — **product language only** (no implementation or stack). Unresolved product questions should be **asked in chat** first; this file records **decisions** after they are made.

**Exit test (from `docs/AIDLC.md`):** two engineers reading this spec would build the same thing. Every section below exists to make that true; a section that does not apply says so in one line rather than being deleted.

---

## Overview

| Field | Value |
|-------|-------|
| **Feature** | [Name aligned with tracker / issue] |
| **Status** | Draft / Awaiting approval / Approved |
| **Author** | [Name] |
| **Created** | YYYY-MM-DD |
| **Last updated** | YYYY-MM-DD |
| **Related Tech Spec** | [Link to Tech Spec on the Feature work item (or repo mirror if `repo-feature-folder`)] |

## Problem & audience

### Problem statement

[What user or business problem are we solving? Why now?]

### Current experience (baseline)

[What happens today without this feature? Pain points in plain language. Where a success criterion below measures a change, give today's number here or in its Baseline column — "unknown, measured in the first slice" is honest; leaving it out is not.]

### Users and roles

Name **every role that touches the feature** — the people who use it, the people it asks things of, the people who approve, operate or support it, and anyone whose data it handles. One role per row; split a role when two people in it know or decide different things (the owner of a process is often not the person who does it).

| Role | What they want from this | What only they know | What they decide | How the feature reaches them |
|------|--------------------------|---------------------|------------------|------------------------------|
| [e.g. Workflow owner] | … | … | … | [in-app, notification, email, a colleague forwards it…] |
| … | … | … | … | … |

For each role, ask: **who answers the questions this feature asks, and are they the person we assumed?** If the feature works on behalf of someone else's customers or clients, they are a role too.

## Outcomes & business impact

### Desired outcomes

Number them; every outcome must have at least one success criterion below.

1. [Outcome — observable in product or business terms]
2. …

### Success criteria (for Validate)

These tie directly to the **scorecard** in `/ship`. Each should be **testable** or **evidence-based** without reading code. Every criterion names its **unit** (cases, lines, runs, minutes…), its **threshold**, and **today's baseline**, and says which outcome it proves.

| # | Criterion | Outcome | Unit and threshold | Baseline today | How we'll verify |
|---|-----------|---------|--------------------|----------------|------------------|
| 1 | … | 1 | … | … | … |
| 2 | … | 2 | … | … | … |

### Business impact

[Revenue, cost, risk reduction, compliance, strategic alignment — as applicable. Include what the feature **costs to run** if it consumes paid capacity (compute, model calls, people's review time), and any ceiling on it. "None beyond baseline" is fine if honest.]

## User experience & scenarios

### Key scenarios

Describe **critical paths** from each role's perspective (not API calls). Cover at least one scenario per role in the table above, and for each happy path the ways it goes wrong: the person doesn't answer, the input is missing or bad, the work fails, someone changes something mid-way, the person leaves and comes back.

1. **[Scenario name]** (role) — [Short narrative: given / when / then]
2. **[Scenario name — when it goes wrong]** (role) — …

### Experience principles

[Accessibility, performance expectations *as users feel them*, tone, how people are told about work that finishes while they are away — anything that must "feel" a certain way, still without naming frameworks or services.]

## Scope

### In scope

- …

### Out of scope

- …

### Existing users, data and work in flight

[What happens to things that already exist when this ships: records created before it, work half-way through, people mid-task, settings or habits that change meaning. For each: migrated, left as-is (and how it looks), or out of scope (say so). "Nothing exists yet" is a valid answer.]

### Dependencies on other teams or features

- …

## Constraints (non-technical where possible)

[Regulatory, contractual, brand, timeline, "must work offline," etc. If a constraint is inherently technical, state the *requirement* ("must integrate with existing identity provider") not the *solution*.]

Always answer, even if only to say "none":

- **Data:** whose data does this handle, who can see it (including our own staff), where may it live, how long is it kept?
- **Trust:** what must the feature never do on its own (send, delete, approve, spend)?

## Terms

Define every word in this spec that a reader could take two ways, or that the product uses with a specific meaning ("case", "piece", "run", "approved"). A term used in a success criterion must be defined here or in the criterion.

| Term | Means |
|------|-------|
| … | … |

## Decisions (optional)

Short log of **resolved** product questions from conversation (not a substitute for asking in chat).

| Date | Decision | Why |
|------|----------|-----|
| … | … | … |

## Related documents

- Tech Spec: [link when available]
- Issues: [links]
- ADRs (for awareness only — do not restate architecture here): [links]
