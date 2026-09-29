# Getting oriented to AI-DLC

Overview of the AI-DLC seed: what it contains, adoption depth, the development V-model, tracker phase flow (including bounces), feedback loops, and headless automation. For process rules in an application repo, copy [templates/AIDLC.md](templates/AIDLC.md) to `docs/AIDLC.md` and configure **`AGENTS.md`**.

See also [README](../README.md).

---

## What this repository is (and is not)

| | |
|---|---|
| **Is** | A **seed library** of AIDLC phase skills (`/plan` … `/learn`), domain skills, agent bundles, manifest validation, and **optional** GitHub / Linear playbooks |
| **Is not** | A hosted orchestrator, control plane, or “run AIDLC for me” SaaS — you wire skills into **your** LLM platform (Cursor, Claude Code, Cloud Agents, Actions, Jenkins, …) |
| **Goal** | Give you a **pattern** (V-model, human gates, orchestrator rhythm) and **copy-paste artifacts** so you adapt transport without re‑inventing process |

Think of three layers:

```mermaid
flowchart TB
  subgraph process [Process — copy to consumer repo]
    AIDLC["docs/AIDLC.md"]
    AGENTS["AGENTS.md — tracker + env"]
  end
  subgraph library [This repo — skills seed]
    SK["skills/ + plugins/"]
    VAL["agent-library-mcp validate"]
  end
  subgraph transport [Your choice — not one size fits all]
    GH["GitHub Projects v2 queue"]
    LIN["Linear workflow states"]
    MAN["Manual slash skills only"]
  end
  SK --> process
  process --> transport
```

---

## Who does what

| Role | Typical first step | Deep dive |
|------|-------------------|-----------|
| **Individual developer** | `curl` install or marketplace plugin; invoke `/plan` in chat | [INSTALL.md](INSTALL.md), [CLAUDE-MARKETPLACE.md](CLAUDE-MARKETPLACE.md) |
| **Team on an app repo** | Submodule + copy `docs/AIDLC.md`; declare tracker in `AGENTS.md` | [CONSUMER-SETUP.md](CONSUMER-SETUP.md) |
| **Headless / Cloud Agents** | Projects v2 or Linear states + workflow templates | [GITHUB-AIDLC-QUEUE.md](GITHUB-AIDLC-QUEUE.md), [LINEAR-AIDLC-PROJECT.md](LINEAR-AIDLC-PROJECT.md) |
| **Contributor to this repo** | [AGENTS.md](../AGENTS.md), [SKILLS.md](SKILLS.md) | Change skills → sync plugin, validate manifests |

---

## Adoption paths (pick your depth)

```mermaid
flowchart LR
  L1[Skills only<br/>slash commands in IDE]
  L2[Consumer repo<br/>specs + overrides]
  L3[Headless queue<br/>board/state drives agents]
  L1 --> L2 --> L3
```

| Depth | You get | You skip |
|-------|---------|----------|
| **1 — Skills** | Phase orchestrators + domain skills in Cursor / Claude | Tracker automation, mutex labels, deploy-gated Ship |
| **2 — Consumer** | Pinned submodule, `docs/AIDLC.md`, specialist overrides in `.cursor/skills` | Optional until you want unattended runs |
| **3 — Transport** | Phase on board/state launches Cloud Agent; PR events advance phase | Nothing — this is the full hands-off pattern (still human gates on transitions) |

Cross-cutting rules apply at every depth: [ARCHITECTURAL-SOUNDNESS.md](ARCHITECTURAL-SOUNDNESS.md), [INTENT-OVER-LITERAL.md](INTENT-OVER-LITERAL.md), [ASK-AND-HALT.md](ASK-AND-HALT.md).

---

## The V-model (verification correspondence)

The V-model describes **what each verify phase checks against**. It is not the same as tracker columns (see [Tracker phase flow](#tracker-phase-flow-state-machine)). Horizontal lines link definition on the left to verification on the right — read and compare, not re-run the left phase.

```text
Plan ─────────────────────────────────── Validate (+ Learn)
  │  Define the problem · Product Spec   Verify it matches · scorecard
  │                                                   │
Design ─────────────────────────────── Review
  │  Tech Spec                         vs Tech Spec
  │                                       │
 Build ─────────────────────── Test
        Do the work · agents implement    Prove it works
                  │         │
                  └── TDD ──┘
              (automated loop — no human gate)
```

**How to read it**

| Left (define) | Right (verify) | What the verify phase uses |
|---------------|----------------|----------------------------|
| **Plan** | **Validate** (+ **Learn** after PASS) | Approved **Product Spec** — success criteria, outcomes |
| **Design** | **Review** | **Tech Spec(s)** — architecture, acceptance criteria |
| **Build** | **Test** | Code + tests from Build; integration proof before Review |

**Time order:** Plan → Design → Build ↔ Test → Review → Validate → Done. **`/learn`** often runs as a separate step after Validate PASS.

> **Agents implement. Orchestrators coordinate. Humans decide.**

Full definition: [templates/AIDLC.md](templates/AIDLC.md) § The V-Model.

---

## Tracker phase flow (state machine)

How a Feature or slice **moves on a board**: Linear workflow states, GitHub Projects **`AIDLC phase`**, and similar. Work frequently **returns to an earlier column**; some loops stay in the same column (drafting a spec) and others move the ticket.

Example: [alexa-recipe-app — linear-workflow.md](https://github.com/queen-of-code/alexa-recipe-app/blob/master/docs/linear-workflow.md).

### Two kinds of “loop”

| Kind | Column changes? | Examples |
|------|-----------------|----------|
| **Within-phase draft** | No — stay on Plan or Design | Orchestrator surfaces a spec draft; human sends feedback until they say **Approve** ([templates/AIDLC.md](templates/AIDLC.md) § Orchestration Model) |
| **Board bounce** | Yes — human drag or automation | Review ↔ Build+Test; Review → Design for Tech Spec + ADR; Ship → Build after Validate FAIL |

### Forward path (human gates between columns)

Typical names; yours live in **`AGENTS.md`**.

```text
Triage? → Plan → Design → Build+Test → Review → [In Staging?] → Ship/Validate → Done
                ↑ learn (/learn) after Validate PASS, often before Done
```

GitHub queue **merge advance** (happy path): `Plan → Design → Build → Review → Ship` — see [`aidlc-pr-merged.yml`](templates/github-workflows/aidlc-pr-merged.yml) `PHASE_NEXT`. **PR opened** can bump **Build → Review** without waiting for CI ([`aidlc-pr-opened-review.yml`](templates/github-workflows/aidlc-pr-opened-review.yml)).

### Rework and bounces (normal operations)

```mermaid
flowchart LR
  Plan((Plan))
  Design((Design))
  Build((Build+Test))
  Review((Review))
  Ship((Ship))

  Plan -->|Product Spec approved| Design
  Design -->|Tech Spec approved| Build
  Build -->|PR + green CI| Review
  Review -->|sign-off / merge| Ship

  Plan -.->|draft until approve| Plan
  Design -.->|draft until approve| Design
  Build <-->|TDD inside column| Build

  Review <-->|review posts, build triages| Build
  Review -->|Tech Spec + ADR revision| Design
  Ship -->|scorecard FAIL usual| Build
  Ship -->|scorecard FAIL| Design
  Ship -->|criteria wrong rare| Plan
```

| Transition | What triggers it | Skill / automation |
|------------|------------------|-------------------|
| **Review ↔ Build+Test** | Review dimensions on PR; build fixes or replies + resolves; red CI | `/review` then **`/build`** ([build skill](../skills/build/SKILL.md) § Review feedback loop) — **counts toward bounce breaker** |
| **Build+Test → Review** | PR ready, human gate, or PR-open automation | `/review`; GitHub **PR opened** workflow |
| **Review → Design** | Architectural-root finding: update Tech Spec + ADR, not a guard | Often from **Architectural Soundness** dimension |
| **Design → Build+Test** | Re-gate after spec change | Human moves column; `/build` on updated spec |
| **Ship → Build / Design / Plan** | Validate FAIL — agent proposes target; **human moves board** | `/ship`; not an automatic workflow edge |
| **Plan / Design draft loop** | Feedback in chat or ticket | Same column; **`needs-a-human`** pauses without counting as bounce ([ASK-AND-HALT.md](ASK-AND-HALT.md)) |

| Board phase (example) | Slash skill | Primary artifact |
|-----------------------|-------------|------------------|
| Plan | `/plan` | Product Spec |
| Design | `/design` | Tech Spec per Unit |
| Build+Test | `/build` | Open PR, green CI |
| Review | `/review` | PR comments + review report |
| Ship / Validate | `/ship` | Scorecard **against** Product Spec |
| After PASS | `/learn` | ADRs, docs, retro (separate run) |

### Validate FAIL (human moves the column)

`/ship` produces the scorecard **in Ship/Validate**; it does not auto-drag the ticket. The human picks the rework column using the proposal ([templates/AIDLC.md](templates/AIDLC.md) § Iteration and Failure Model):

| Gap found | Typical board move |
|-----------|-------------------|
| Shipped behavior ≠ Product Spec | **Build+Test** |
| UX misses success criteria but implementation matches Tech Spec | **Design** |
| Success criteria themselves were wrong | **Plan** (explicit decision) |

---

## Feedback loops and circuit breakers

Not every loop is a bug — some are intentional (TDD). Others need **breakers** so agents do not spin forever.

```mermaid
flowchart TB
  subgraph intentional [Intentional loops]
    TDD["Build ↔ Test TDD<br/>(no human gate)"]
    ORCH["Orchestrator draft ↔ human feedback<br/>(until explicit approve)"]
  end

  subgraph failure [Board bounces]
    BOUNCE["Review ↔ Build+Test<br/>(/review → /build triage)"]
    SPEC["Review → Design<br/>(Tech Spec + ADR)"]
    VALRET["Ship FAIL → human moves board<br/>(usually Build)"]
  end

  subgraph breakers [Circuit breakers — stop the run]
    CB1["Bounce breaker: Nth re-entry to Build+Test<br/>→ reassign human, stop agent"]
    CB2["Ask & halt: needs-a-human<br/>→ pause; does NOT count as bounce"]
    CB3["Anti-babysit: 2nd same Review symptom<br/>→ updated Tech Spec + ADR required"]
    CB4["Architectural soundness: unjustified runtime guard<br/>→ blocking Review finding"]
  end

  BOUNCE --> CB1
  BOUNCE -.->|root fix| ARCH["Revise state machine / spec<br/>(ARCHITECTURAL-SOUNDNESS)"]
  ORCH --> CB2
  BOUNCE --> CB3
```

| Mechanism | What it stops | Doc |
|-----------|---------------|-----|
| **Bounce circuit breaker** | Endless Review ↔ Build churn | [LINEAR-AIDLC-PROJECT.md](LINEAR-AIDLC-PROJECT.md) § Iteration; GitHub queue uses same idea via phase discipline |
| **`needs-a-human`** | Agent guessing past ambiguity | [ASK-AND-HALT.md](ASK-AND-HALT.md) |
| **Anti-babysit** | Second guard at same symptom without spec change | [ARCHITECTURAL-SOUNDNESS.md](ARCHITECTURAL-SOUNDNESS.md) |
| **Guard test (Review)** | “Fix” that only catches bad state at one call site | [ARCHITECTURAL-SOUNDNESS.md](ARCHITECTURAL-SOUNDNESS.md) |

**Mutex (not a breaker, but prevents duplicate agents):** `aidlc_work:in_progress` (GitHub) or delegate + `bot-working` (Linear) — launch actions **skip** issues already in flight or labeled `needs-a-human`.

---

## Sequence: interactive orchestrator rhythm

Orchestrators **never self-complete** on “good enough.” They surface drafts until the human says approve — then the gate advances.

```mermaid
sequenceDiagram
  actor Human
  participant Orch as Phase orchestrator
  participant Sub as Specialist skills/agents

  Human->>Orch: direction (blurb, revise, approve intent)
  Orch->>Sub: autonomous sub-steps
  Sub-->>Orch: drafts, research, traces
  Orch->>Human: request_user_input — summary + open questions
  Note over Human,Orch: Human may send more messages anytime (compose box)
  Human->>Orch: feedback or "Approve"
  alt not approved
    Orch->>Sub: more sub-steps
    Orch->>Human: next draft
  else approved
    Orch->>Human: gate satisfied — publish spec / hand off
  end
```

Canonical prose: [templates/AIDLC.md](templates/AIDLC.md) § Orchestration Model.

---

## Sequence: headless GitHub queue (happy path)

When the consumer repo uses [GITHUB-AIDLC-QUEUE.md](GITHUB-AIDLC-QUEUE.md):

```mermaid
sequenceDiagram
  actor Human
  participant Board as Projects v2 AIDLC phase
  participant GH as GitHub PR / Actions
  participant Launch as aidlc-launch-from-board
  participant Agent as Cursor Cloud Agent

  Human->>Board: set phase e.g. Design
  Human->>GH: comment /aidlc-launch or workflow_dispatch
  GH->>Launch: dispatch
  Launch->>Launch: skip if in_progress or needs-a-human
  Launch->>Agent: start phase prompt + API key
  Agent->>GH: work on branch / PR / comments
  Human->>GH: merge PR
  GH->>Board: aidlc-pr-merged advances phase
  GH->>Launch: dispatch next phase
  Note over GH,Agent: Ship waits for deploy/smoke workflow
  Launch->>Agent: /ship after deploy CI
```

More triggers (PR opened → Review, reconcile): [GITHUB-AIDLC-QUEUE.md](GITHUB-AIDLC-QUEUE.md) § Architecture.

---

## Sequence: ask and halt (headless question)

Ambiguity in a headless run becomes a **ticket comment**, not a guess.

```mermaid
sequenceDiagram
  participant Agent as Cloud Agent
  participant Issue as Work item
  participant Launch as Launch / reconcile
  actor Human

  Agent->>Issue: one comment, numbered questions, @mention
  Agent->>Issue: add needs-a-human, clear in_progress
  Note over Issue: phase unchanged — not a bounce
  Agent-->>Agent: stop (no PR ready in Build)
  Launch->>Issue: skip while needs-a-human
  Human->>Issue: answer in thread
  Human->>Issue: /aidlc-launch or re-delegate
  Launch->>Agent: resume same phase
  Agent->>Issue: remove needs-a-human, continue
```

Details: [ASK-AND-HALT.md](ASK-AND-HALT.md).

---

## Sequence: Validate (reads specs; failure is a human board move)

```mermaid
sequenceDiagram
  participant PS as Product Spec from Plan
  participant Ship as /ship Validate
  participant Human
  participant Board as Tracker phase

  Ship->>PS: read success criteria
  Ship->>Ship: exercise Feature, produce scorecard
  Ship->>Human: scorecard + evidence on work item
  alt PASS
    Human->>Human: approve customer readiness
    Note over Human: separate run: /learn
  else FAIL
    Ship->>Human: which criteria failed + suggested rework target
    Human->>Board: move issue to Build or Design or Plan
    Note over Board: not an automatic Validate→Plan edge
  end
```

---

## Operational lifecycle (production issues)

AIDLC also defines a **second V-model** for incidents (Detect → Diagnose → Triage → Fix → Close + Learn). Same human-gate idea; orchestrators differ. Full spec: [templates/AIDLC.md](templates/AIDLC.md) Part 2.

```mermaid
stateDiagram-v2
  direction LR
  [*] --> Detect
  Detect --> Diagnose
  Diagnose --> Triage
  Triage --> Fix
  Fix --> Close
  Close --> [*]
```

Use **`report-bug`** skill for structured triage conversation.

---

## Documentation map

```mermaid
flowchart LR
  README[README]
  GO[GETTING-ORIENTED]
  AIDLC[templates/AIDLC.md]
  CS[CONSUMER-SETUP]
  SK[SKILLS.md]
  README --> GO
  GO --> AIDLC
  GO --> CS
  CS --> GH[GITHUB-AIDLC-QUEUE]
  CS --> LIN[LINEAR-AIDLC-PROJECT]
  CS --> ITP[ISSUE-TRACKER-PORTABILITY]
  SK --> README
```

---

## Related entry points

| If you are… | Read |
|-------------|------|
| Contributing to this repository | [AGENTS.md](../AGENTS.md), [SKILLS.md](SKILLS.md) |
| Vendoring skills into an app repo | [CONSUMER-SETUP.md](CONSUMER-SETUP.md), consumer `docs/AIDLC.md` + `AGENTS.md` |
| Running headless phase agents | [GITHUB-AIDLC-QUEUE.md](GITHUB-AIDLC-QUEUE.md) or [LINEAR-AIDLC-PROJECT.md](LINEAR-AIDLC-PROJECT.md), [ASK-AND-HALT.md](ASK-AND-HALT.md) |
