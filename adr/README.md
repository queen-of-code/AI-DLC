# Architectural Decision Records (ADRs)

This folder holds **ADRs** for the repository: short, durable records of **significant architectural choices** (stack, topology, auth model, deployment shape, data ownership, etc.). They are inputs to **Design** and **Learn** in AIDLC and should be **linked from Tech Specs**, not duplicated.

## Naming

Use sequential numbering and a kebab-case slug:

```text
adr/0001-thin-client-and-api-boundary.md
adr/0002-authentication-strategy.md
```

Reserve **`template.md`** as the skeleton; do not use it as a numbered ADR.

## When to add an ADR

- The choice affects **how systems are structured** or **how multiple teams or services interact**
- You would regret **not** writing it down the next time someone asks “why did we do it this way?”
- The decision is **stable** for months or years (not “we picked a library for this ticket” unless it sets precedent)

Skip an ADR for trivial or purely local implementation details already obvious from the code.

## Relationship to other artifacts

| Artifact | Role |
|----------|------|
| **Product Spec** (`feature/<slug>/product-spec.md`) | Outcomes, users, success criteria — **no** architecture |
| **Tech Spec** (`feature/<slug>/tech-spec.md`) | Implementation plan for a **Unit**; **links** to relevant ADRs |
| **ADR** (`adr/NNNN-*.md`) | A **single** decision with context, options, and consequences |

If a Tech Spec introduces a new architectural commitment, add or update an ADR in the same change set when appropriate.

## Template

Copy [`template.md`](template.md) to `adr/NNNN-your-title.md` and fill in every section.
