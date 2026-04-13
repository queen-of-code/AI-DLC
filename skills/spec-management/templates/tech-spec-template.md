# Tech Spec — [Unit title]

**AIDLC phase:** Design (one **Unit** per Tech Spec; split only if independently implementable)  
**Grounding:** This document implements the approved **Product Spec** and must **link** to existing **ADRs** instead of re-deriving org-wide architecture.

---

## Overview

| Field | Value |
|-------|-------|
| **Unit / scope** | [What this spec covers — one deployable slice] |
| **Feature** | [Link to `feature/<slug>/` and parent issue] |
| **Product Spec** | [Link to `product-spec.md` — must be approved] |
| **Status** | Draft / In review / Approved for build |
| **Author** | [Name] |
| **Created** | YYYY-MM-DD |
| **Last updated** | YYYY-MM-DD |

## Context

### Summary

[What we are building in this Unit in engineering terms — one short paragraph.]

### Existing system & documentation

- **Repo layout / services:** [Where this work lives; link to README or architecture overview]
- **Relevant ADRs:** [List `adr/NNNN-*.md` files this Unit **must** align with; add a new ADR if this work changes an org-wide decision]
- **Prior art in repo:** [Similar features, patterns to follow]

### Out of scope for this Unit

- …

## Architecture

### High-level design

[Components, boundaries, data flow. Diagrams welcome (ASCII, Mermaid, or links).]

### Integration points

| System | Contract | Notes |
|--------|----------|-------|
| … | … | … |

## Data

[Entities, schema changes, migrations, retention, PII — as applicable.]

## APIs & contracts

[REST/GraphQL/events/cli — request/response shapes, error model, versioning.]

## UI / client (if applicable)

[Components, routing, state, accessibility targets — aligned with Product Spec scenarios.]

## Security & privacy

[AuthN/Z model, secrets handling, threat notes — consistent with ADRs and org standards.]

## Acceptance criteria (for Review)

Testable conditions that **Review** will check against implementation (often mirrored in PR checklist).

- [ ] …
- [ ] …

## Testing approach

| Layer | What we prove | Notes |
|-------|----------------|-------|
| Unit | … | … |
| Integration | … | … |
| E2E / manual | … | … |

## Rollout & operations

### Rollout plan

[Phases, feature flags, backwards compatibility, database rollout order. Omit sections that do not apply.]

### Monitoring & observability

[Metrics, logs, traces, SLOs, alerts — what we need to **see** in production for this Unit.]

### Rollback

[How we revert or disable safely if this Unit misbehaves.]

## Risks & open technical questions

| Risk / question | Mitigation or owner |
|-----------------|---------------------|
| … | … |

## Change history

| Date | Author | Changes |
|------|--------|---------|
| YYYY-MM-DD | … | Initial draft |
