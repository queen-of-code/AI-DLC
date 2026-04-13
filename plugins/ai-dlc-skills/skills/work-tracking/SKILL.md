---
name: work-tracking
description: Structure work using parent-feature and child-work-item hierarchy compatible with Linear and GitHub. Use when planning features, breaking down work, creating issues, or organizing tasks.
type: skill
aidlc_phases: [plan, design]
tags: [project-management, work-tracking, linear, github, issues]
requires: []
author: Melissa Benua
created_at: 2026-03-07
updated_at: 2026-03-07
---

# Work Tracking

## When to Use

- Planning new features or epics
- Breaking down large tasks into smaller pieces
- Creating issues in Linear or GitHub
- Organizing work for a sprint or milestone
- Estimating effort for a feature

## Core Concepts

### Hierarchy

```
┌─────────────────────────────────────────────┐
│  Parent Feature (Epic/Initiative)           │
│  "User Authentication System"               │
├─────────────────────────────────────────────┤
│  ├─ Child Work Item                         │
│  │  "Design auth database schema"           │
│  ├─ Child Work Item                         │
│  │  "Implement JWT token generation"        │
│  ├─ Child Work Item                         │
│  │  "Create login API endpoint"             │
│  └─ Child Work Item                         │
│     "Write authentication tests"            │
└─────────────────────────────────────────────┘
```

### Parent Feature

A high-level deliverable that provides user value. Contains multiple child work items.

**Characteristics:**
- Describes the "what" and "why"
- Takes multiple days/weeks to complete
- Has clear acceptance criteria
- Can be demonstrated to stakeholders

**Examples:**
- "User Authentication System"
- "Payment Processing Integration"
- "Mobile App Notifications"
- "Admin Dashboard"

### Child Work Item

A specific, actionable task that contributes to the parent feature.

**Characteristics:**
- Describes the "how"
- Completable in 1-3 days
- Has a single assignee
- Can be independently reviewed/tested

**Examples:**
- "Design database schema for users table"
- "Implement password hashing utility"
- "Create login form component"
- "Write unit tests for auth service"

## Naming Conventions

### Parent Features

```
[Feature] <Brief description of the capability>

Examples:
[Feature] User Authentication System
[Feature] Payment Processing
[Feature] Email Notification Service
[Feature] Admin User Management
```

### Child Work Items

```
<Action verb> <specific deliverable>

Examples:
Design authentication database schema
Implement JWT token generation
Create login API endpoint
Add password reset flow
Write authentication tests
Configure OAuth2 providers
```

### Labels

| Label | Use For |
|-------|---------|
| `feature` | Parent features |
| `task` | Regular child work items |
| `bug` | Defects to fix |
| `tech-debt` | Refactoring, cleanup |
| `spike` | Research, investigation |
| `blocked` | Work that can't proceed |

## Breaking Down Work

### When to Create a Parent Feature

Create a parent feature when:
- Work spans multiple components/systems
- Multiple people will contribute
- Takes more than 3-5 days
- Has distinct phases or milestones
- Requires coordination across teams

### When to Use Standalone Items

Use standalone items when:
- Single, isolated change
- Completable in 1-2 days
- No dependencies on other work
- Simple bug fix or minor enhancement

### Effective Breakdown

**Good breakdown** - each item is:
- Independent: Can be worked on separately
- Testable: Has clear verification criteria
- Small: Fits in a day or two of work
- Complete: Delivers something useful

```markdown
# Parent: [Feature] User Profile Management

## Child Items:
1. Create user profile database schema
   - Migration for profiles table
   - Add indexes for common queries
   
2. Build profile API endpoints
   - GET /api/profile/:id
   - PUT /api/profile/:id
   - Include validation
   
3. Create profile edit form
   - Form component with validation
   - Image upload for avatar
   
4. Add profile view page
   - Display user information
   - Show activity history
   
5. Write tests for profile feature
   - Unit tests for API
   - Integration tests for database
   - E2E test for profile flow
```

**Bad breakdown** - too vague or too large:
```markdown
# Bad Examples:
- "Work on profiles" (too vague)
- "Implement entire profile feature" (too large)
- "Do backend stuff" (not specific)
- "Fix things" (not actionable)
```

## Platform Mapping

### GitHub

| Concept | GitHub Implementation |
|---------|----------------------|
| Parent Feature | Issue with task list or Parent Issue (beta) |
| Child Work Item | Issue or task list item |
| Relationship | Task lists, mentions, or sub-issues |

**Using Task Lists:**
```markdown
## Tasks
- [ ] #123 Design database schema
- [ ] #124 Implement API endpoints
- [ ] #125 Create frontend components
- [ ] #126 Write tests
```

**Using Labels:**
- Add `epic` or `feature` label to parent
- Add `task` label to children
- Reference parent in child: "Part of #100"

### Linear

| Concept | Linear Implementation |
|---------|----------------------|
| Parent Feature | Issue with sub-issues or Project |
| Child Work Item | Sub-issue or Issue |
| Relationship | Built-in parent/child or Project membership |

**Best Practices:**
- Use Projects for large initiatives
- Use parent/sub-issue for features
- Set estimates on child items
- Use cycles for time-boxing

## Issue Templates

### Parent Feature Template

```markdown
## Overview
Brief description of the feature and its value.

## User Story
As a [user type], I want [capability] so that [benefit].

## Acceptance Criteria
- [ ] Criterion 1
- [ ] Criterion 2
- [ ] Criterion 3

## Technical Approach
High-level technical strategy (optional for non-technical stakeholders).

## Work Items
- [ ] Item 1
- [ ] Item 2
- [ ] Item 3

## Dependencies
- Depends on: #XX (if any)
- Blocks: #YY (if any)

## Notes
Any additional context or decisions made.
```

### Child Work Item Template

```markdown
## Description
What needs to be done and why.

## Acceptance Criteria
- [ ] Specific, testable criterion
- [ ] Another criterion

## Technical Notes
Implementation hints or constraints (optional).

## Parent Feature
Part of #XX - [Feature Name]
```

## Estimation

### T-Shirt Sizing

| Size | Effort | Description |
|------|--------|-------------|
| XS | < 2 hours | Trivial change |
| S | 2-4 hours | Simple task |
| M | 1-2 days | Standard task |
| L | 3-5 days | Complex task |
| XL | 1-2 weeks | Should be broken down |

### Story Points (Fibonacci)

| Points | Meaning |
|--------|---------|
| 1 | Trivial, well-understood |
| 2 | Small, low complexity |
| 3 | Medium, some unknowns |
| 5 | Larger, moderate complexity |
| 8 | Complex, needs breakdown |
| 13 | Very complex, definitely split |

## Workflow

### Lifecycle

```
┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
│ Backlog  │───▶│ In Prog  │───▶│ Review   │───▶│   Done   │
└──────────┘    └──────────┘    └──────────┘    └──────────┘
                     │                │
                     │   ┌────────┐   │
                     └──▶│ Blocked│◀──┘
                         └────────┘
```

### Status Meanings

| Status | When to Use |
|--------|-------------|
| Backlog | Defined but not started |
| In Progress | Actively being worked on |
| In Review | PR open, awaiting review |
| Blocked | Can't proceed, needs help |
| Done | Complete, verified, merged |

## Best Practices

1. **One assignee per item**: Clear ownership
2. **Update status regularly**: Keep it current
3. **Link related items**: Show dependencies
4. **Add context in comments**: Decisions, blockers
5. **Close items promptly**: Don't leave stale items
6. **Review parent when children complete**: Update progress
