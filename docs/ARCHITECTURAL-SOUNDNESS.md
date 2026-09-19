# Architectural soundness: prevent invalid states by construction

**Tracker-neutral.** This principle applies whether you track work in GitHub, Linear, Jira, or anything else. It is wired into three phase skills — [`/design`](../skills/design/SKILL.md), [`/review`](../skills/review/SKILL.md), and [`/build`](../skills/build/SKILL.md).

## The failure mode this prevents

Under AI velocity, the default reflex is to **guard a symptom at run time** instead of **making the invalid state unreachable**. It ships green and looks like a fix; it is not:

- **Run-time guard instead of construction-time prevention** — a `disabled=` prop, a null-check, a retry, an empty-state catch, or a "don't-regress" patch added at the site where the bad state was *observed*, leaving every other path to the same bad state unguarded.
- **A new state added without updating every consumer** — a status/enum/flag gains a value, but only the loudest reader learns about it; the rest fall through to a default, and *a missing transition becomes a permanent state* (latch-forever bugs).
- **A defensive check masking a missing invariant** — the check papers over a contract that was never written down or enforced at one chokepoint, so the contract is re-broken elsewhere.
- **A dead state machine** — a correct model is authored but nothing calls it, so real behavior is still the scattered logic it was meant to replace.

These accumulate into systems where invalid states are *reachable* and only *sometimes* caught. The symptom the loop produces is **spinning**: a human repeatedly redirecting an agent from a tactical guard to a root fix.

## The rule

**Invalid states are made unreachable by construction, not caught at run time.** For any defect that is *an invalid state being reached*, make that state unreachable at the earliest boundary. Prefer, in order:

1. **Make it unrepresentable** — type / schema / closed enum at the boundary.
2. **Enforce it at one chokepoint** — a single transition function or validation point every path routes through.
3. **Only then**, if 1–2 are genuinely impossible, add a run-time guard — **with a written justification** naming why the state cannot be prevented and where the single enforcement point is.

A guard at a true trust boundary (untrusted input, external API, defense in depth) is legitimate — with that justification. A guard that stands in for a missing invariant is a finding, not a fix.

## Where each phase enforces it

**Design.** For any **architecturally-relevant** change — one that touches a **state/status field, an enum, an async handoff, a gated or terminal action, a multi-step pipeline, or a publish/compile step** (trivial copy/CSS/config is exempt) — the Tech Spec must contain, before the Design gate:

- a **state machine**: states, a **single transition function** every path routes through, and an argument that the illegal states are **unreachable by construction** (not merely unobserved);
- **sequence diagram(s)** for every cross-component or async handoff the change introduces or touches;
- the **invariants** and their **single enforcement chokepoint** (one place, not N call sites);
- the **validity boundary**: *where* invalid states are made unreachable (schema / type / compile / publish preferred over run time).

No state machine + sequence diagram + validity boundary for an architecturally-relevant change → **not ready for the Design gate.**

**Review.** An **Architectural Soundness** review dimension whose blocking tests are:

- **Guard test** — every new guard (`disabled=` / null-check / retry / "don't-regress" patch / empty-state catch) must **prevent** the invalid state, not catch it after the fact. An unjustified guard is **blocking**, and the finding **names the root** (the boundary where the state should have been made unreachable).
- **State-completeness** — a newly added state/enum value updates **every** consumer/guard site, not just the observed one.
- **Dead-machine** — a new state machine is **wired** onto the actual path, not authored and orphaned.
- **Validity-boundary** — the invalid state is unreachable at the boundary the Tech Spec claimed.

**Build.** When triaging a Review finding (or its own failure), Build first asks: **is this an invalid state being reached?** If so, fix it at the earliest boundary — **not** with a run-time guard at the observation site. Two rules:

- **You may not close an architectural-root finding with a guard.** The resolution is: **revise the Tech Spec + record the decision (an ADR or your repo's equivalent) + implement to it.**
- **Anti-babysit rule:** the **second** attempt at the **same symptom** is **not allowed without an updated Tech Spec + recorded decision.** Two guards at one class of failure means the machine, not the call site, is wrong.

## Recording the decision

When a change establishes or corrects an invariant/boundary, record it where your repo keeps durable architectural decisions — the [`spec-management`](../skills/spec-management/SKILL.md) ADR template (`docs/adr/NNNN-title.md`) is the default. The recorded decision is what turns the institutional memory an agent lacks into a repo artifact.
