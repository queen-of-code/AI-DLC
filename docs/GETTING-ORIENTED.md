# Getting oriented to AI-DLC

This page is the **picture book** for the repository: what the seed is, how adoption paths differ, how a Feature moves through phases, where feedback loops and **circuit breakers** live, and how headless automation fits. Humans start here; agents should read consumer **`docs/AIDLC.md`** (from [templates/AIDLC.md](templates/AIDLC.md)) plus **`AGENTS.md`** in the app repo.

**Shorter entry point:** [README](../README.md).

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

## Development lifecycle — phase state machine

Phases follow a **V-model**: left side defines, bottom builds/tests, right side verifies. **Humans hold gates** between major transitions; **Build ↔ Test** is the one automated TDD loop inside `/build`.

Tracker boards often **collapse** Test into Build (e.g. `Build+Test` on Linear) or map Validate to a `Ship` column — the logic below is canonical; rename states in `AGENTS.md`.

```mermaid
stateDiagram-v2
  direction LR

  [*] --> Idea: optional intake
  Idea --> Plan
  Plan --> Design: gate Product Spec
  Design --> Build: gate Tech Specs
  Build --> Test: TDD loop
  Test --> Build: fix until green
  Test --> Review: gate test sufficiency
  Review --> Validate: gate technical sign-off
  Validate --> Done: gate scorecard + Learn

  Review --> Build: bounce review or CI
  Validate --> Plan: failure human confirms
  Validate --> Design: failure human confirms
  Validate --> Build: failure human confirms
  Validate --> Test: failure human confirms

  Done --> [*]
```

**Slash skills (orchestrators in this library):**

| Phase | Skill | Primary artifact |
|-------|--------|------------------|
| Plan | `/plan` | Product Spec |
| Design | `/design` | Tech Spec(s) per Unit |
| Build + Test | `/build` | Open PR, green CI |
| Review | `/review` | Spec trace + human sign-off |
| Validate | `/ship` | Scorecard vs Product Spec |
| Learn | `/learn` | ADRs, docs, retro (after Validate PASS) |

Validate **failure routing** (agent proposes, human confirms): see [templates/AIDLC.md](templates/AIDLC.md) § Iteration and Failure Model.

---

## Feedback loops and circuit breakers

Not every loop is a bug — some are intentional (TDD). Others need **breakers** so agents do not spin forever.

```mermaid
flowchart TB
  subgraph intentional [Intentional loops]
    TDD["Build ↔ Test TDD<br/>(no human gate)"]
    ORCH["Orchestrator draft ↔ human feedback<br/>(until explicit approve)"]
  end

  subgraph failure [Failure return loops]
    BOUNCE["Review / red CI → Build+Test<br/>(bounce)"]
    VALRET["Validate miss → Plan / Design / Build / Test<br/>(human confirms target)"]
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

## Sequence: Validate failure return

```mermaid
sequenceDiagram
  participant Ship as /ship Validate
  participant Human
  participant Phase as Target phase skill

  Ship->>Ship: scorecard vs Product Spec
  alt below threshold
    Ship->>Human: criteria missed + proposed return phase + evidence
    Human->>Phase: confirm or override target
    Phase->>Phase: new cycle on same Feature record
  else pass
    Ship->>Human: scorecard for customer readiness
    Note over Human: separate run: /learn
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

## For agents reading this repo

1. **Contributing here:** follow [AGENTS.md](../AGENTS.md); skill changes → [SKILLS.md](SKILLS.md) + `./scripts/sync-plugin-skills.sh`.
2. **Working in a consumer app:** consumer `AGENTS.md` and `docs/AIDLC.md` override generic skills; phase names and tracker wiring live there.
3. **Headless:** never skip [ASK-AND-HALT.md](ASK-AND-HALT.md); respect mutex and `needs-a-human` at the launch chokepoint.
4. **Review/Build findings:** apply [ARCHITECTURAL-SOUNDNESS.md](ARCHITECTURAL-SOUNDNESS.md) before adding guards.
