# ADR folder (in your repo)

**Shipped with the spec-management skill:** copy [`adr-template.md`](adr-template.md) into your project’s **`adr/`** directory when you record a decision. This file explains naming and when to write an ADR.

In each **consumer** repository, create a top-level **`adr/`** folder (if it does not exist) and store numbered ADRs there. They are **not** placed under `skills/` — they are **git** artifacts (Product/Tech specs default to the issue tracker; see [ISSUE-TRACKER-PORTABILITY.md](../../../docs/ISSUE-TRACKER-PORTABILITY.md)).

## Naming

Use sequential numbering and a kebab-case slug:

```text
adr/0001-thin-client-and-api-boundary.md
adr/0002-authentication-strategy.md
```

Do **not** commit `adr-template.md` as a numbered ADR; copy it to the next free number when you add a decision.

## When to add an ADR

- The choice affects **how systems are structured** or **how multiple teams or services interact**
- You would regret **not** writing it down the next time someone asks “why did we do it this way?”
- The decision is **stable** for months or years (not “we picked a library for this ticket” unless it sets precedent)

Skip an ADR for trivial or purely local implementation details already obvious from the code.

## Relationship to other artifacts

| Artifact | Role |
|----------|------|
| **Product Spec** (Feature work item) | Outcomes, users, success criteria — **no** architecture |
| **Tech Spec** (Feature work item) | Implementation plan for a **Unit**; **links** to relevant ADRs |
| **ADR** (`adr/NNNN-*.md`) | A **single** decision with context, options, and consequences |

If a Tech Spec introduces a new architectural commitment, add or update an ADR in the same change set when appropriate.

## How to start

Copy [`adr-template.md`](adr-template.md) to `adr/NNNN-your-title.md` and fill in every section.
