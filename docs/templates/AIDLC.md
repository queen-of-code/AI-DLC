# AIDLC: AI Development Lifecycle

**Consumer repo (`YOUR_ORG/YOUR_REPO`):** Copy this file to **`docs/AIDLC.md`**. For day-to-day engineering guardrails, read **`AGENTS.md` first** when your repo defines overrides. Headless automation: [CONSUMER-SETUP.md](CONSUMER-SETUP.md), [GITHUB-AIDLC-QUEUE.md](GITHUB-AIDLC-QUEUE.md).

**Status:** Living document -- update after each major process iteration  
**Owner:** Melissa Benua  
**Purpose:** Canonical definition of the AIDLC. All downstream documents (agent configurations, evaluation rubrics, blog content, process guides) should derive from this document, not define their own interpretations.

**Provenance:** In-repo copy aligned with the public tutorial (`alexa-recipe-app` `docs/AIDLC.md`). Process docs in this repository link here.

---

## What Is the AIDLC?

The AIDLC (AI Development Lifecycle) is a V-model process designed for AI-native teams. It covers two distinct lifecycles:

1. **Development Lifecycle** -- the full lifecycle of building a new Feature, from initial product definition through validated customer delivery
2. **Operational Lifecycle** -- the full lifecycle of responding to a production issue, from detection through verified resolution

Both lifecycles follow the same V-model pattern: the left side defines and understands the problem, the bottom is the active work, and the right side verifies the outcome mirrors the original signal. Each right-side phase has a direct correspondence to a left-side phase. Humans hold the gates. Agents do the work.

---

# Part 1: Development Lifecycle

## The V-Model

The left side of the V is about **defining what to build and how**. The bottom is **building and testing it**. The right side is **verifying what was built is correct**, mirroring each left-side phase in reverse:

```
Plan ─────────────────────────────────── Validate (+ Learn)
  │   "What are we building and why?"  "Does it do what we planned?"
  │                                                   │
Design ─────────────────────────────── Review
    │   "How will we build it?"      "Is it built to spec?"
    │                                       │
   Build ─────────────────────── Test
          "Build it."       "Prove it works."
                  │         │
                  └── TDD ──┘
                (automated cycle,
                 no human gate)
```

**Phase correspondences:**
- Validate ↔ Plan (does the shipped Feature meet the original Product Spec?)
- Review ↔ Design (does the implementation meet the Tech Specs?)
- Test ↔ Build (do the tests prove the built code works?)

---

## Nomenclature

The AIDLC uses tracker-agnostic terminology that maps to common equivalents in Jira, Linear, GitHub Issues, etc.

| AIDLC Term | Common Equivalents | Definition |
|---|---|---|
| **Feature** | Epic, Feature, Initiative | A top-level unit of product work with defined customer outcomes and success criteria. A Feature is the atomic unit of the AIDLC -- one Feature, one full V-cycle. |
| **Unit** | Story, Task, Sub-task | A discrete, independently implementable piece of a Feature. Each Unit has exactly one Tech Spec. A Feature has one or more Units; fewer is better. |
| **Product Spec** | PRD, Brief, Feature Spec | The output of Plan. Defines customer outcomes, success criteria, and scope. Written in product terms, not technical terms. |
| **Tech Spec** | Technical Spec, Design Doc | The output of Design for a single Unit. Defines architecture, interfaces, data model, and implementation approach. One Tech Spec per Unit. |
| **Scorecard** | Acceptance Report, Val Report | The output of Validate. An AI-generated assessment of whether the shipped Feature meets the original Product Spec, expressed as a percentage and structured pass/fail. |
| **ADR** | Architectural Decision Record | A short document capturing a significant technical decision, its context, the options considered, and the rationale for the choice made. |

### Validate phase vs UI validation (do not conflate)

| Term | Meaning |
|------|---------|
| **Validate phase** | AIDLC phase 6 — Feature-level gate orchestrated by **`/ship`**: scorecard vs Product Spec, deploy readiness, tracker closure. |
| **UI validation** | Technique for exercising UI acceptance criteria with **Chrome DevTools MCP** evidence — used in **Review** and inside **Validate phase** when specs include UI criteria. Not a separate phase. Procedure: consumer **`docs/INTERACTIVE-UI-VALIDATION.md`** (from AI-DLC seed) or linked copy. |

**Headless automation:** **`/ship`** (Validate) and **`/learn`** are **separate runs** — Learn after Validate PASS.

---

## Development Phases

### Phase 1 -- Plan

**Purpose:** Define what the Feature is, who it's for, what problem it solves, and how we will know if it succeeded.

**Who does the work:** Humans, with AI as a collaborator (drafting, refining, asking clarifying questions).

**Inputs:**
- Customer feedback, strategic priority, or product insight
- Existing Product Specs and ADRs (for context and consistency)

**Outputs:**
- **Product Spec** containing:
  - The problem being solved and for whom
  - Desired customer outcomes (not implementation details)
  - Success criteria (how Validate will score this Feature)
  - Explicit out-of-scope items
  - Any known constraints (technical, regulatory, timeline)

**Success criteria leaving this phase:** The Product Spec is unambiguous enough that two different engineers reading it would build the same thing.

**Human gate:** A human must approve the Product Spec before Design begins. This is the most important gate in the process -- ambiguity here propagates through every downstream phase.

**Orchestrator:** None required. Plan is primarily human-driven.

---

### Phase 2 -- Design

**Purpose:** Translate the Product Spec into one or more implementable Tech Specs. This is engineering design: software architecture, API contracts, data model, front-end structure, infrastructure decisions.

**Who does the work:** Design Orchestrator Agent, coordinating Specialist Agents (architecture, front-end design, infrastructure, API design) as needed. Humans review and refine.

**Inputs:**
- Approved Product Spec
- Existing Tech Specs, ADRs, and repo documentation (agents pull these before generating new specs -- do not redesign what already exists)

**Outputs:**
- One **Tech Spec per Unit**, each containing:
  - Scope and purpose of this Unit
  - Architecture and component design
  - API contracts and interface definitions
  - Data model changes
  - Dependencies and integration points
  - Acceptance criteria (what Review will validate against)
  - Testing approach (what the Test phase should cover)
  - Known risks and edge cases

**Guidance on Units:** Break the Feature into as few Units as possible while keeping each independently implementable and testable. A Unit should be completable in one Build/Test cycle without depending on another Unit being finished first. If two Units are tightly coupled, merge them.

**Success criteria leaving this phase:** Every Unit has a Tech Spec complete enough that a Build agent can implement it without making architectural decisions.

**Human gate:** A human must approve all Tech Specs before Build begins. The human is checking: are the specs complete, consistent, and implementable? Are the Units the right scope? Are there architectural decisions that need an ADR?

**Orchestrator:** **Design Orchestrator Agent** -- receives the approved Product Spec, decomposes into Units, and drives Specialist Agents to produce Tech Specs.

---

### Phase 3 -- Build

**Purpose:** Implement each Unit per its Tech Spec. Build agents write code, follow existing patterns in the codebase, and write unit tests alongside the implementation.

**Who does the work:** Build Orchestrator Agent, coordinating Specialist Agents by domain (front-end, back-end, infrastructure-as-code, etc.).

**Inputs:**
- Approved Tech Specs (all Units for the Feature)
- Codebase context (existing patterns, ADRs, repo documentation -- agents pull before implementing)

**Outputs:**
- Implemented code per Tech Spec
- Unit tests written alongside implementation (TDD preferred -- write the test first, implement to pass)
- **An open pull request** per Unit (or one PR per Feature if the team groups Units that way) — **not** “branch only.” The PR is the handoff surface for Test and Review.

**Key constraints for Build agents:**
- Implement to the spec. Do not scope-creep, redesign, or make architectural decisions not covered by the Tech Spec. If the spec is ambiguous, surface it -- do not assume.
- Follow existing patterns in the codebase. Prefer reuse over invention.
- A Unit is not complete until its unit tests pass locally.
- Agents should explicitly reference which Tech Spec section they are implementing, so Review can trace coverage.
- **Open the PR before Build is done:** work may start on a branch, but **Build completes only when the PR exists** and **CI is green** (required status checks passing on the latest commit). Fix or iterate until green.

**Success criteria leaving this phase:** Each Unit is implemented per its Tech Spec with unit tests; **an open PR** exists with **green CI**, and the work is ready for the Test phase to run against that PR.

**Human gate:** None between Build and Test. This is the one automated transition in the AIDLC.

**Orchestrator:** **Build Orchestrator Agent** -- receives the set of Tech Specs, assigns Units to Specialist Agents by domain, coordinates parallel work where Units are independent.

---

### Phase 4 -- Test

**Purpose:** Prove the implementation works through automated tests. Unit tests written in Build are refined here; integration tests are written and run for the first time.

**Who does the work:** Test Orchestrator Agent, coordinating Test Specialist Agents. The Build→Test transition is a TDD cycle -- agents iterate between writing/refining tests and fixing implementation until all tests pass.

**Inputs:**
- **Open PR(s) from Build** with **green CI**, containing the implemented code and unit tests
- Tech Specs (for integration test design -- what service boundaries and contracts need end-to-end validation?)
- Existing test suites (for context on patterns, existing coverage, and avoiding duplication)

**Outputs:**
- Passing unit tests (fast, reliable, specific)
- Passing integration tests (covering the API contracts and service boundaries defined in the Tech Spec)
- No flaky tests. A flaky test is fixed or removed before leaving this phase -- it does not get passed forward.

**Test design principles (non-negotiable):**
- **Fast:** Unit tests run in microseconds. Integration tests in milliseconds. Nothing that can be a unit test should be an integration test.
- **Reliable:** One result per commit SHA, every time. Flaky tests are quarantined immediately.
- **Specific:** One assertion per test. Clear names that describe the failure without reading the code body.

**Success criteria leaving this phase:** All tests pass, no flakiness, and the test suite visibly covers the acceptance criteria in each Tech Spec.

**Human gate:** A human must approve that the test suite is sufficient before Review begins. The question is not "what percentage is covered" but "are the right things tested?" This is a judgment call, not a metric check.

**Orchestrator:** **Test Orchestrator Agent** -- drives the TDD loop, coordinates test writing and fix cycles, flags flakiness, and produces a test summary for human review.

---

### Phase 5 -- Review

**Corresponds to:** Design
**Purpose:** Verify that the implementation meets the Tech Spec. This is the technical gate -- is the code correct, complete, and ready to deploy?

**Who does the work:** Review Orchestrator Agent first, then a human engineer.

**Inputs:**
- Implemented code and passing test suite
- Approved Tech Specs (the specs Review is validating against)
- CI results: build status, test results, lint, security scan, coverage gate

**What the Review Agent checks:**
- Do all CI checks pass? (Non-negotiable gate)
- Does the implementation match the Tech Spec? (Coverage of each spec section)
- Are API contracts honored?
- Are there regressions in adjacent areas?
- Are existing patterns followed? Are there obvious issues the Tech Spec didn't catch?
- Does the PR include clear context for the human reviewer: what was built, why, what to look at?

**Outputs:**
- Review Agent report: structured assessment against the Tech Spec, flagging gaps or concerns
- PR with passing CI, annotated with Review Agent findings
- Human sign-off (or an explicit list of required changes before sign-off)

**Success criteria leaving this phase:** CI is green, the Review Agent finds no unresolved gaps against the Tech Spec, and a human engineer has signed off.

**Human gate:** A human must approve before Validate begins. The human is asking: is this technically sound and complete? They are reviewing the Review Agent's report alongside the code, not starting from scratch.

**Orchestrator:** **Review Orchestrator Agent** -- runs CI checks, traces implementation against Tech Spec sections, generates the review report, and surfaces it for human approval.

---

### Phase 6 -- Validate (+ Learn)

**Corresponds to:** Plan
**Purpose:** Two responsibilities — historically one phase gate:

1. **Validate** — verify the shipped Feature meets the Product Spec (orchestrator: **`/ship`**)
2. **Learn** — capture learnings (**`/learn`** — may run as a **separate** headless step after Validate PASS)

**UI validation:** When success criteria include UI behavior, agents follow **interactive UI validation** (Chrome DevTools MCP) as part of Validate — see consumer **`INTERACTIVE-UI-VALIDATION.md`**. That technique is **not** the whole Validate phase.

**Who does the work:** Validate Orchestrator Agent (running both validation and learning tasks), then a human.

**Deployment model:** Validate can run in two modes:
- **Pre-merge with feature flag:** Code is deployed behind a flag, Validate runs against the live environment, flag is removed or promoted based on the result.
- **Post-merge:** Code is merged and deployed; Validate runs before the feature is exposed to customers.

**What the Validate Agent does:**
- Exercises the Feature against each success criterion in the Product Spec
- If the Feature has a UI: navigates the interface, takes screenshots, annotates them against expected behavior
- Produces a **Scorecard**: a structured pass/fail against each success criterion, with an overall percentage
- **90% is the default pass threshold.** Teams may configure this based on risk profile.

**On Validate failure:** The Validate Agent does not simply say "it failed." It must:
1. Identify which success criteria were not met and why, citing the original Product Spec
2. Propose the specific phase to return to (Plan, Design, Build, or Test) with a rationale
3. Attach screenshots, logs, or other evidence to the PR or Feature record

The human reviews the Scorecard and findings. Even at 90%+, the human makes the final call on customer readiness.

**What the Learn Agent does (on passing Validate):**
- Writes or updates **ADRs** for any significant architectural decisions made during the cycle
- Updates **repo documentation**: README sections, onboarding guides, context maps, anything that helps future agents understand the system without scanning all the code
- Adds a **retrospective note** to each Tech Spec capturing anything that differed from the plan and why
- Notes any AIDLC process friction for process improvement

**Why Learn is gated here and not separate:** Agents are context-dependent. Every undocumented decision is context an agent will reconstruct by scanning the codebase -- slowly and imperfectly. Attaching Learn to the final human gate ensures it cannot be deferred or skipped. The Feature record is not closed until learnings are captured.

**Success criteria leaving this phase:** Scorecard ≥ 90% (or team threshold), human has approved customer readiness, and all Learn outputs are committed to the repo.

**Human gate:** Human must approve both the Validate scorecard and the Learn outputs before the Feature is marked complete.

**Orchestrator:** **Validate Orchestrator Agent** -- reads the Product Spec, drives the validation exercise, produces the Scorecard, then drives the Learn tasks, and surfaces everything for human approval.

---

## Development: Agent Architecture

Each phase has an **Orchestrator Agent** that manages a pool of **Specialist Agents**. The Orchestrator is responsible for:
- Pulling relevant inputs (specs, code, existing docs) before starting work
- Selecting and sequencing Specialist Agents appropriate to the task
- Aggregating outputs into the phase deliverable
- Surfacing blockers or ambiguities to the human rather than guessing

Specialist Agents can be shared across phases. The Orchestrator decides which to invoke.

**Principle:** Agents implement. Orchestrators coordinate. Humans decide.

| Phase | Orchestrator | Typical Specialist Agents |
|---|---|---|
| Plan | Plan Orchestrator | Researcher, Product Manager, Product Marketer, Grounding Reviewer |
| Design | Design Orchestrator | Architecture, Front-End Design, API Design, Infrastructure Design |
| Build | Build Orchestrator | Front-End, Back-End, Infrastructure-as-Code, Database |
| Test | Test Orchestrator | Unit Test, Integration Test |
| Review | Review Orchestrator | CI Runner, Spec Tracer, Code Reviewer |
| Validate (+ Learn) | Validate Orchestrator | UI Navigator, API Exerciser, Screenshot Annotator, Scorecard Generator, ADR Writer, Docs Updater |

---

## Development: Orchestration Model (CRITICAL — read before building)

This section defines how orchestrators and humans interact. **Violating this model is the most common implementation error.**

### The Rhythm

An orchestrator's job is:
1. Receive a direction from the human (seed blurb, feedback, revision request)
2. Run as many autonomous sub-agent steps as needed to produce a high-quality draft
3. **Surface the draft to the human** via `request_user_input` with a clear summary of what was done and what review is needed
4. Wait for the human's response
5. Incorporate the feedback, run more sub-agent steps if needed, surface the next draft
6. Repeat until the human explicitly approves the output

**The orchestrator never self-completes.** `session_completed` is not a valid end state for an orchestrator in normal operation. The orchestrator's job ends when the human says "approve" — not when the orchestrator decides it's done.

### Why This Matters

An orchestrator that self-completes is not following the AIDLC. It has replaced the human gate with its own judgment. The whole point of the V-model is that humans hold the gates. The orchestrator produces inputs for the gate; the human holds the gate.

### What This Looks Like in Practice

```
Human:        "Plan the 'Request Money Flow' feature for Kids Can Ask for Money."
Orchestrator: [runs researcher, product manager, marketer, grounding reviewer internally]
              "Here's the draft spec: [spec content]. I've addressed X, Y, Z from the
               research. Does this look right? Anything to change?"
Human:        "The success criteria are too vague. Make them testable."
Orchestrator: [re-runs product manager with feedback]
              "Updated spec: [spec content]. I've made the success criteria measurable:
               [specific criteria]. Ready to approve?"
Human:        "Approve."
Orchestrator: [calls request_approval gate] → spec published to GitHub Issues
```

### The Compose Box

Every orchestrator-driven page must have an always-visible compose box. The human can send a message at any time:
- While the orchestrator is working → message queued, delivered when orchestrator next calls `request_user_input`
- When the orchestrator is waiting for input → message answers the pending question and resumes
- When the session has completed a draft → message starts a new continuation turn

### Observability

Because an orchestrator runs multiple sub-agent steps autonomously, the human needs visibility into what it's actually doing. This is provided at two levels:
1. **Static**: The orchestrator's manifest (system prompt, agent list, success criteria) shown in a sidebar — zero LLM cost
2. **Live**: Debug-level event stream (tool calls, agent dispatches, LLM timings) in a collapsible detail panel

The primary view is the **conversation** (what the human sent, what the orchestrator responded). The debug view is for developers and troubleshooting.

---

## Development: Human Gates

| Transition | Gate question | Who approves |
|---|---|---|
| Plan → Design | Is the Product Spec unambiguous and worth building? | Product / Feature owner |
| Design → Build | Are the Tech Specs implementable and architecturally sound? | Engineering lead |
| Build → Test | *(No gate -- automated TDD cycle)* | -- |
| Test → Review | Does the test suite cover the Tech Spec acceptance criteria? | Engineering lead |
| Review → Validate | Is the implementation technically complete and ready to deploy? | Engineering lead |
| Validate → Done | Does the Feature meet the Product Spec? Are learnings captured? | Product / Feature owner + Engineering lead |

---

## Development: Iteration and Failure Model

If a phase fails, the process returns to the appropriate phase rather than starting over. The Feature record captures each iteration -- the history of attempts is part of the Learn output.

**The Validate Agent proposes where to return to. A human confirms.**

| Validate failure type | Proposed return | Human override? |
|---|---|---|
| Implementation doesn't match behavior in Product Spec | Build | Only if root cause is in the design |
| Behavior is correct but UX doesn't meet success criteria | Design | Only if root cause is in the plan |
| Success criteria were wrong or incomplete | Plan | Always requires human decision |

Returning to Plan requires explicit human authorization -- the Validate Agent should not propose this without strong evidence, as it restarts the cycle.

---
---

# Part 2: Operational Lifecycle

## The V-Model

The Operational Lifecycle handles two types of signals that indicate something is wrong in production:

- **Reactive:** Customer-reported bug reports, support tickets, or user feedback
- **Proactive:** Monitoring alerts, log discrepancies, metric anomalies, or other system-generated signals

Both inputs trigger the same process. The V-model mirrors the Development Lifecycle in structure: the left side is about understanding the problem, the bottom is the immediate action, and the right side is resolution -- each right-side phase corresponding to a left-side phase.

```
Detect ─────────────────────────────────── Close (+ Learn)
  │   "Something is wrong."           "It won't happen again."
  │                                                    │
Diagnose ──────────────────────────── Fix
    │   "We know what's wrong."    "Root cause is resolved."
    │                                       │
         Triage ─────────────────
              "Bleeding is stopped."
```

**Phase correspondences:**
- Close ↔ Detect (the signal that triggered detection is gone; monitoring confirms)
- Fix ↔ Diagnose (the fix directly addresses what was diagnosed)
- Triage = bottom of the V (the most urgent, immediate action)

---

## Operational Phases

### Phase O1 -- Detect

**Purpose:** Receive and classify the incoming signal. Determine severity, scope, and whether immediate action is needed.

**Inputs:**
- Customer bug report, support ticket, or user-reported issue (reactive)
- Monitoring alert, log anomaly, or metric threshold breach (proactive)

**What the Detect Orchestrator does:**
- Parses the incoming signal and extracts structured information (affected surface area, reproduction steps if available, customer impact)
- Correlates with existing open incidents -- is this a known issue or a new one?
- Classifies severity (customer-facing vs. internal, data integrity vs. UX, scope of impact)
- Routes to Diagnose with a structured incident brief

**Success criteria leaving this phase:** The incident is classified, scoped, and documented well enough that the Diagnose Orchestrator can start investigating without re-reading the raw report.

**Human gate:** A human confirms the severity classification and authorizes investigation. For high-severity incidents, this gate should be near-instant (the on-call human approves the brief and Diagnose begins within minutes).

**Orchestrator:** **Detect Orchestrator** -- alert classifier, bug report parser, severity scorer, deduplication against open incidents.

---

### Phase O2 -- Diagnose

**Purpose:** Understand exactly what is happening and why. The output of Diagnose is a clear, human-readable explanation of the root cause and its blast radius -- not a hypothesis, a conclusion.

**Inputs:**
- Incident brief from Detect
- Logs, metrics, and distributed traces from the affected time window
- Recent deploy history (what changed recently?)
- Relevant ADRs and documentation

**What the Diagnose Orchestrator does:**
- Pulls logs and traces from the affected services and time window
- Correlates metric anomalies with deploys, dependency changes, or load patterns
- Attempts to reproduce the issue in a non-production environment if possible
- Identifies the specific code path, service, or data state causing the issue
- Documents the blast radius: what is affected, how many customers, what data

**Success criteria leaving this phase:** A human can read the Diagnose output and say "yes, I understand what is happening and why." The root cause is identified (or, for complex issues, the leading hypothesis is documented with supporting evidence).

**Human gate:** A human must confirm the diagnosis before Triage begins. Acting on the wrong diagnosis wastes time and can make things worse. This gate exists specifically to catch misdiagnoses before they drive triage actions.

**Orchestrator:** **Diagnose Orchestrator** -- log analysis agent, distributed trace reader, metric correlation agent, code archaeology agent, reproduction agent.

---

### Phase O3 -- Triage

**Purpose:** Stop the immediate customer bleeding. Triage is about mitigation, not resolution. The fix may come later; the impact must be contained now.

**Inputs:**
- Confirmed diagnosis from Diagnose
- Available mitigation options (rollback, feature flag, load shedding, config change, hotfix)

**What the Triage Orchestrator does:**
- Selects the fastest available mitigation path given the diagnosis
- Executes the mitigation: rolls back a deploy, toggles a feature flag, sheds load, or deploys a minimal hotfix
- Monitors the result in real time to confirm impact has stopped
- Drafts customer-facing communication and/or status page update if appropriate

**Triage is not the fix.** Triage stops the bleeding. The root cause is addressed in Fix. A triage action that resolves the symptom without addressing the cause is acceptable -- as long as Fix follows.

**Success criteria leaving this phase:** Customer impact has stopped or been reduced to an acceptable level. Monitoring confirms the mitigation is holding.

**Human gate:** A human must confirm triage is working before authorizing the transition to Fix. If triage is not holding, the team returns to Diagnose -- the original diagnosis may be wrong or incomplete.

**Orchestrator:** **Triage Orchestrator** -- feature flag toggle agent, rollback agent, load shedding agent, config change agent, communication agent (status page, customer notification).

---

### Phase O4 -- Fix

**Corresponds to:** Diagnose
**Purpose:** Resolve the root cause so the incident cannot recur. Fix produces a proper code change -- not a temporary patch -- with tests, peer review, and a deployment through the standard pipeline.

**Who does the work:** Fix Orchestrator Agent, using the same Specialist Agents as the Development Lifecycle Build phase.

**Inputs:**
- Confirmed root cause from Diagnose
- Triage mitigation already in place (Fix happens without time pressure, since bleeding is stopped)
- Relevant Tech Specs, ADRs, and codebase documentation

**What Fix produces:**
- A code change that addresses the root cause (not just the symptom)
- Unit and integration tests that would have caught this bug before it reached production (regression tests)
- A PR that goes through the standard Development Lifecycle Review phase before merging

**Key constraint:** Fix must add a regression test. If a bug made it to production, the test suite had a gap. That gap must be closed. The regression test is the proof that this class of bug is now covered.

**Success criteria leaving this phase:** The root cause is resolved in code, regression tests are written and passing, and the PR has passed Review.

**Human gate:** A human must confirm the fix addresses the root cause before Close begins. The question is not just "does CI pass" but "does this actually fix what Diagnose identified?"

**Orchestrator:** **Fix Orchestrator** -- uses Build and Test Specialist Agents from the Development Lifecycle, plus a Regression Test Agent specialized in writing tests for known production failure modes.

---

### Phase O5 -- Close (+ Learn)

**Corresponds to:** Detect
**Purpose:** Two responsibilities:
1. **Close** -- verify in production that the fix resolved the issue and the original trigger is gone
2. **Learn** -- capture what was learned so this class of incident does not recur and future agents can recognize the pattern faster

**What the Close Agent does:**
- Monitors the production system to confirm the triggering signal (alert, metric, or report pattern) is gone
- Confirms the regression test passes in CI and would have caught this before it reached production
- Removes any temporary triage mitigations if the fix makes them unnecessary (e.g., remove a feature flag kill switch)

**What the Learn Agent does:**
- Writes or updates an **ADR** if the fix involved an architectural decision or revealed an architectural gap
- Updates **monitoring and alerting** if the incident revealed a gap in detection (add the alert that would have caught this earlier)
- Updates **repo documentation or context maps** if the incident revealed undocumented system behavior
- Writes an **incident summary**: what happened, what the impact was, what was done, what was learned, and the link to the regression test

**Why monitoring updates are a first-class Learn output:** If this incident was detected by a customer rather than by your monitoring, your monitoring had a gap. Closing that gap is as important as fixing the code.

**Success criteria leaving this phase:** Production monitoring confirms the issue is resolved. The regression test is in the CI suite. At least one Learn output is committed. The incident record is closed.

**Human gate:** A human reviews and approves the Close confirmation and Learn outputs. The incident is not closed until both are done.

**Orchestrator:** **Close Orchestrator** -- production validation agent, regression test verifier, ADR writer, incident summary writer, monitoring gap analyzer.

---

## Operational: Agent Architecture

| Phase | Orchestrator | Typical Specialist Agents |
|---|---|---|
| Detect | Detect Orchestrator | Alert Classifier, Bug Report Parser, Severity Scorer, Deduplication Agent |
| Diagnose | Diagnose Orchestrator | Log Analysis, Trace Reader, Metric Correlation, Code Archaeology, Reproduction |
| Triage | Triage Orchestrator | Feature Flag Toggle, Rollback, Load Shedder, Config Change, Communication |
| Fix | Fix Orchestrator | Front-End, Back-End, Infrastructure-as-Code, Regression Test |
| Close (+ Learn) | Close Orchestrator | Production Validator, Regression Verifier, ADR Writer, Incident Summarizer, Monitoring Gap Analyzer |

---

## Operational: Human Gates

| Transition | Gate question | Who approves |
|---|---|---|
| Detect → Diagnose | Is the severity classification correct? Investigate? | On-call engineer |
| Diagnose → Triage | Do we understand the root cause well enough to act? | Engineering lead / On-call |
| Triage → Fix | Is the bleeding stopped? Safe to begin root cause work? | Engineering lead |
| Fix → Close | Does the fix address the root cause? Does CI pass? | Engineering lead |
| Close → Done | Is the issue gone in production? Are learnings captured? | Engineering lead |

---

## Operational: Iteration Model

If Triage is not working, return to Diagnose -- the diagnosis may be incomplete or wrong. Triage should never continue escalating interventions without reconfirming the diagnosis.

If Fix is deployed but Close monitoring shows the issue persists, return to Diagnose -- the fix addressed the wrong root cause.

The incident record captures each iteration. This is the raw material for the Learn output.

---
---

# Shared Principles

The following principles apply to both the Development and Operational Lifecycles.

**Agents implement. Orchestrators coordinate. Humans decide.**
No agent autonomously gates a phase transition. Orchestrators surface findings; humans approve movement.

**Context before action.**
Every agent reads relevant existing documentation (ADRs, specs, context maps) before generating new output. Agents that skip this step produce output inconsistent with the system they're working in.

**Learn is not optional.**
Both lifecycles close with a Learn step embedded in the final phase gate. The Feature or incident is not done until learnings are captured. An undocumented decision is a tax on every future agent that touches that code.

**Safety is speed.**
Guardrails -- human gates, CI checks, flaky test policies, blast radius controls -- are not friction. They are what allows agents to iterate at velocity without compounding errors. See: [The Boring Parts Matter](blog-posts/ai-engineering-fundamentals/).

---

## Relationship to Engineering Fundamentals

The AIDLC depends on -- and does not replace -- strong engineering fundamentals. The following practices are prerequisites, not optional enhancements:

- **Specs before code.** Agents implement to specs. Without a complete Tech Spec, Build agents fill gaps with assumptions. See: [Context Is the Spec](blog-posts/ai-engineering-fundamentals/02-2026-02-19-context-is-the-spec.md).
- **Reliable, fast, specific tests.** The Test phase only works if tests are trustworthy. Flaky tests corrupt the Build→Test cycle and make the Test→Review gate meaningless. See: [An Unreliable Test Is Worse Than No Test at All](blog-posts/ai-engineering-fundamentals/04-2026-02-19-unreliable-tests.md).
- **Agent-readable CI.** Review depends on CI feedback being clear, consolidated, and deterministic. See: [Your CI Pipeline Is Your Agent's Manager](blog-posts/ai-engineering-fundamentals/05-2026-02-19-ci-pipeline-as-manager.md).
- **Monitoring as backstop.** Validate catches what the specs defined. Monitoring catches what the specs missed -- and drives the Operational Lifecycle. See: [An Alert Is Just a Continuously Running Test Case in Production](blog-posts/ai-engineering-fundamentals/06-2026-02-19-alerts-as-test-cases.md).
- **Architecture designed for change.** Agents generate changes fast. Architecture that relies on implicit knowledge will break under AIDLC velocity. See: [Designing for Agents](blog-posts/ai-engineering-fundamentals/03-2026-02-19-architecture-for-agents.md).

---

## Advanced (optional): multi-Unit Features and validation levels

When one Feature spans **many Units** and **many PRs**:

- **Micro-validate** — each merged PR may run a scoped Validate (Tech Spec / Unit scope) after deploy.
- **Macro-validate** — when all Units join, run Feature-level Validate against the **Product Spec** (scorecard).

Tracking and join logic live in the consumer control plane (GitHub queue, Linear, or future in-app AIDLC module). This template does not mandate implementation — only vocabulary.

---

## Document History

| Date | Change | Author |
|---|---|---|
| 2026-02-19 | Initial draft | Melissa Benua |
| 2026-02-19 | Merged Learn into Validate; added Operational Lifecycle | Melissa Benua |
| 2026-06-09 | Validate/Learn split for headless; UI validation glossary; upstream template in AI-DLC | Melissa Benua |
