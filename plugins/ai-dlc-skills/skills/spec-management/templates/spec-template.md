# Feature Specification Template

Copy this template when creating a new feature spec.

---

## Overview

| Field | Value |
|-------|-------|
| **Feature Name** | [Name of the feature] |
| **Type** | [Frontend / Backend / Full-stack] |
| **Status** | [Draft / Review / Approved / In Progress / Implemented] |
| **Author** | [Your name] |
| **Created** | [YYYY-MM-DD] |
| **Last Updated** | [YYYY-MM-DD] |

## Related Specs

- Frontend: [path/to/frontend-spec.md] - [Brief description]
- Backend: [path/to/backend-spec.md] - [Brief description]
- Related: [path/to/related-spec.md] - [Brief description]

## Business Context

### Problem Statement

[Describe the problem this feature solves. Why is this important? What pain point does it address?]

### Goals

- [Primary goal 1]
- [Primary goal 2]
- [Primary goal 3]

### Non-Goals

Things explicitly out of scope for this feature:

- [Non-goal 1]
- [Non-goal 2]

### Success Metrics

How will we measure success?

| Metric | Target | Current |
|--------|--------|---------|
| [Metric 1] | [Target value] | [Current value or N/A] |
| [Metric 2] | [Target value] | [Current value or N/A] |

## Requirements

### Functional Requirements

1. **[Requirement Name]**
   - Description: [What the system should do]
   - Priority: [Must have / Should have / Nice to have]

2. **[Requirement Name]**
   - Description: [What the system should do]
   - Priority: [Must have / Should have / Nice to have]

### Non-Functional Requirements

| Category | Requirement |
|----------|-------------|
| Performance | [e.g., Page load < 2 seconds] |
| Scalability | [e.g., Support 10,000 concurrent users] |
| Security | [e.g., All data encrypted in transit] |
| Accessibility | [e.g., WCAG 2.1 AA compliance] |

## User Stories

### Story 1: [Title]

**As a** [type of user]
**I want** [some goal]
**So that** [some reason]

**Acceptance Criteria:**
- [ ] [Criterion 1]
- [ ] [Criterion 2]

### Story 2: [Title]

**As a** [type of user]
**I want** [some goal]
**So that** [some reason]

**Acceptance Criteria:**
- [ ] [Criterion 1]
- [ ] [Criterion 2]

## Technical Approach

### Architecture

[High-level description of the technical approach. Include diagrams if helpful.]

```
[ASCII diagram or description of component interactions]
```

### Data Model

[Describe any new data models or changes to existing ones.]

```sql
-- Example schema changes
CREATE TABLE example (
    id UUID PRIMARY KEY,
    ...
);
```

### API Design (Backend Specs)

#### Endpoint: [Method] [Path]

**Request:**
```json
{
  "field": "value"
}
```

**Response:**
```json
{
  "data": { ... }
}
```

**Status Codes:**
- 200: Success
- 400: Validation error
- 404: Not found

### UI/UX Design (Frontend Specs)

[Link to mockups or include inline images]

**Key interactions:**
- [Interaction 1]
- [Interaction 2]

## Dependencies

### Internal Dependencies

- [Service/Component name] - [How it's used]

### External Dependencies

- [External service] - [How it's used]

### New Dependencies

- [Library/Service to add] - [Reason for adding]

## Testing Strategy

### Unit Tests

- [Component/Function to test]
- [Component/Function to test]

### Integration Tests

- [Integration scenario to test]

### E2E Tests

- [User flow to test]

## Rollout Plan

### Phases

1. **Phase 1: [Name]**
   - [What's included]
   - Target: [Date or milestone]

2. **Phase 2: [Name]**
   - [What's included]
   - Target: [Date or milestone]

### Feature Flags

- `feature_flag_name` - [What it controls]

## Rollback Plan

If issues arise:

1. [Step 1 to rollback]
2. [Step 2 to rollback]
3. [How to verify rollback successful]

## Open Questions

- [ ] [Question 1]
- [ ] [Question 2]

## Change History

| Date | Author | Changes |
|------|--------|---------|
| YYYY-MM-DD | [Name] | Initial draft |
