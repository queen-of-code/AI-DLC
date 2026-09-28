# Linear for AIDLC

**Not using Linear?** See **[ISSUE-TRACKER-PORTABILITY.md](ISSUE-TRACKER-PORTABILITY.md)** and declare your system in the app repo's **`AGENTS.md`**. This file is the **Linear-specific** transport path; the GitHub counterpart is [GITHUB-AIDLC-PROJECT.md](GITHUB-AIDLC-PROJECT.md).

This is a **rough, opinionated starting point** — a SEED, like the rest of the repo. It describes a Linear-native AIDLC where **Linear is the system of record**: the state machine, the human gates, the specs, and agent dispatch all live in Linear, with GitHub used only for PRs and CI. It is derived from a working production deployment; adapt the names to your workspace.

## Why Linear differs from the GitHub path

The GitHub playbook leans on a **Projects board + `aidlc_work:*` labels + `project_card` webhooks** because GitHub has no first-class "phase" concept. Linear already has **workflow states**, **native issue↔PR linking**, and **agent delegation** — so most of that scaffolding disappears:

| GitHub path | Linear path |
|---|---|
| Project board **column** = phase | **Workflow state** = phase (native) |
| `aidlc_work:unstarted` / `in_progress` labels | **State + assignee/delegate** — no phase labels at all |
| `project_card` webhook resets labels | Native **state change** is the event |
| `feature/<slug>/` spec files | **Linear Documents** attached to the Feature issue |
| Cron/`launchd` polling for eligible issues | **Delegate = agent** — setting a delegate dispatches the run |
| Human gate = column move + label | Human gate = **moving the issue to the next state** |

## Workflow states (the phases)

Create these states on your team, in order. Names are suggestions; keep them stable if automations key off them by name.

| State | AIDLC phase | Who works it |
|---|---|---|
| **Triage** | intake | human / triage intelligence |
| **Plan** | Plan — Product Spec | `/plan` |
| **Design** | Design — Tech Spec + slice plan | `/design` |
| **Build+Test** | Build + Test (TDD) | `/build` |
| **Review** | Review gate | `/review` |
| **In Staging** | deployed-validation | CI + slice validation |
| **Ship** | Validate + Learn (Feature-level) | `/ship` |
| **Done** | accepted | — |
| **Canceled** | dropped | — |

Keep Build and Test as **one** state. `In Staging` / `Ship` are optional refinements — collapse them into `Done` if your delivery model is simpler.

## Labels: a small operational set, not a taxonomy

The GitHub path needs `aidlc_work:*` labels to signal "ready for an agent." **Linear does not** — state + delegate carry that. Resist per-phase labels; they drift. Let the **state** be the phase signal; there is no `aidlc_work:*` and no `Re-Work` state — a bounce is just moving the issue back to `Build+Test`.

Two **run-status** labels are worth having, because state can't express them:

| Label | Means | Set by | Cleared by |
|---|---|---|---|
| `bot-working` | an agent run is live on this issue | the run, on start | the run, on finish or halt |
| `needs-a-human` | the run is **paused on a question** it posted on this issue | the run, when it asks and halts | the resumed run (after a human answered), or a human changing the state |

`needs-a-human` is **only** for a bot paused on a question — normal human gates (Plan/Design/Review/Ship sign-off) are already visible from state + no delegate and don't get the label. Add operational labels your compliance needs (e.g. `production-incident`) on top.

## Asking questions: ask on the issue, then halt

Headless runs keep every "ask in chat" step — the question goes on the Linear issue instead of a chat. Full rule: **[ASK-AND-HALT.md](ASK-AND-HALT.md)**. On Linear:

1. Post **one** comment as the bot, @mentioning the assignee (or lead), with numbered questions, options, and a recommended default.
2. Remove `bot-working`, add `needs-a-human`, **leave the state unchanged**, clear the delegate, stop. In Build+Test, push WIP to the branch but don't open or ready a PR.
3. **Dispatch skips `needs-a-human`** — the daily audit and any delegate-on-state rule must never launch an issue carrying it.
4. **Resume:** the human answers and re-delegates. The run sees a human comment newer than its question, swaps `needs-a-human` → `bot-working`, and continues in the same state.
5. Add `OR label = needs-a-human` to the human "waiting on me" view — a paused Build+Test issue is otherwise invisible to a state-only view.

## Specs are Linear Documents

Replace the `feature/<slug>/` tree with **Linear Documents on the Feature issue**:

- **`Product Spec — <name>`** — written in Plan.
- **`Tech Spec — <name>`** — written in Design; includes the slice plan.
- **ADRs stay as repo files** under `docs/adr/` — they are durable architectural records, not tracker artifacts.

No `product-spec.md`, `tech-spec.md`, `review-report.md`, or `feature/<slug>/` folder. Agents read specs via the Linear API (`get_document` / `list_documents` on the Feature issue). This is a deliberate divergence from the framework's `feature/<slug>/` invariant — the Document *is* the artifact.

## Human gates = a state move

Every gate is a human **moving the issue to the next state**. No approval labels, no "approved" comments:

- **Plan → Design** — human accepts the Product Spec.
- **Design → Build+Test** — human accepts the Tech Spec + slice plan. **This is the gate that starts building.**
- **Review → In Staging** — human merges the PR (a native automation moves the state, below).
- **Ship → Done** — human accepts the outcome.

## The slice plan — slices are born inert

Design decomposes a Feature into vertical slices as **sub-issues**. The one rule that keeps decomposition from becoming a runaway build:

> **A slice's *state* is its build trigger.** Create every slice in the team's **backlog state (e.g. `Not Started`)** — **never `Build+Test`.** A slice created in Build+Test is dispatched to `/build` immediately, before any human gate. Slices are born **inert**: backlog state, un-delegated, chained serially with `blockedBy`.

- **1 slice** → no sub-issue; the Feature itself is the unit. Design leaves it in **Design**; the human moving it to Build+Test starts the build.
- **2–9 slices** → N sub-issues in the backlog state, chained `blockedBy`.
- **10+** → split the Feature into two, linked by `related to`.

**Releasing the first slice:** when the human gates the parent Feature into **Build+Test**, the build orchestrator (which never builds an umbrella parent) **releases the first unblocked backlog slice** into Build+Test — its own build run picks it up. When that slice reaches a terminal state, the next unblocked sibling is released the same way. Only the state move by a human — not decomposition — starts real work.

## Agent dispatch = delegate

Setting an issue's **delegate to your coding agent** is what launches a run (e.g. Cursor Cloud Agents dispatch on delegation). So:

- Design creates slices **un-delegated** — they wait.
- The human gate + first-slice release sets the delegate on the released slice (or your release automation does).
- Each phase run **clears its own delegate** when it finishes (it does not auto-clear).

## Automating state on PR events

Two transitions are worth automating off GitHub PR events so Linear stays in sync:

| PR event | Move |
|---|---|
| review requested / marked ready | `Build+Test` → `Review` |
| PR merged to main | `Review` \| `Build+Test` → `In Staging` |

Prefer **Linear's native GitHub "Pull request automation"** if it can express these. If it only offers a single "started/completed" target, a tiny GitHub Action can do the precise moves via the Linear GraphQL API — resolve the issue by team + PR identifier and the target state **by name** (survives state-id changes). Keep it **best-effort** (never fail the PR; a daily audit backstops a missed move).

## Bot identity for @mentions (important)

Phase agents post an `@mention` comment to the accountable human at each handoff — that's the notification (no Slack MCP needed if Linear→Slack is connected). **Authenticate automations as a dedicated bot member**, not as a human:

- A comment posted under a human's own token that `@mentions` that human is a **self-mention** and **fires no notification**.
- Give the bot its own Linear seat and API key (e.g. `LINEAR_ROBOT_KEY`). All automation reads/writes use it via the Linear GraphQL API (`Authorization: <key>`).
- Interactive human use of the Linear MCP stays as the human — the bot key is for the headless automations only.

## Iteration & the bounce circuit breaker

Failure returns the issue to the right state rather than starting over. The common case — Review feedback or red CI — is the **bounce**: the slice goes back to **Build+Test**, where `/build` triages the Review comments (fix, or reply + resolve). Count re-entries into Build+Test; on the Nth (e.g. 5th), post a breaker comment, reassign to a human lead, and **stop** — a run loop is not a fix. See [ARCHITECTURAL-SOUNDNESS.md](ARCHITECTURAL-SOUNDNESS.md) for the deeper "don't guard, fix the machine" rule that keeps bounces from happening in the first place.

## Record your choice in `AGENTS.md`

Per [ISSUE-TRACKER-PORTABILITY.md](ISSUE-TRACKER-PORTABILITY.md), declare Linear in the consumer repo's `AGENTS.md`:

```markdown
## Issue tracker (AIDLC)

| Field | Value |
|--------|--------|
| **System** | `linear` |
| **Work item for a Feature** | Linear team `<TEAM>`, ticket pattern `<TEAM>-123` |
| **Phase signal** | Linear **workflow state** (Plan / Design / Build+Test / Review / In Staging / Ship / Done) |
| **Specs** | Linear **Documents** on the Feature issue (`Product Spec — …`, `Tech Spec — …`); ADRs in `docs/adr/` |
| **Ticket key on every PR** | `<TEAM>-123` in title and body (CI may enforce) |
| **Agent dispatch** | issue **delegate** = coding agent; automations auth as the bot (`LINEAR_ROBOT_KEY`) |
| **Automation entry points** | native Linear GitHub PR automation, or a best-effort state-sync Action |
```

## Checklist

1. Create the **workflow states** above on your team (enable **Triage** if you want intake).
2. Keep labels minimal — **no** `aidlc_work:*`, ideally one operational label at most.
3. Give the automation bot a **Linear seat + API key**; store it as a secret (`LINEAR_ROBOT_KEY`).
4. Decide specs live as **Linear Documents** on the Feature; keep ADRs in `docs/adr/`.
5. Wire the **PR → state** automation (native, or a small GraphQL Action).
6. Point the phase skills at your consumer `.cursor/skills/<phase>/` overrides that encode "slices born inert," "specs are Documents," and the state names — the generic skills defer to `AGENTS.md` + `docs/AIDLC.md`.

## Links

- [ISSUE-TRACKER-PORTABILITY.md](ISSUE-TRACKER-PORTABILITY.md) — declare your tracker in `AGENTS.md`
- [GITHUB-AIDLC-PROJECT.md](GITHUB-AIDLC-PROJECT.md) — the GitHub transport path
- [ARCHITECTURAL-SOUNDNESS.md](ARCHITECTURAL-SOUNDNESS.md) — prevent-by-construction (tracker-neutral)
- [work-tracking skill](../skills/work-tracking/SKILL.md) — hierarchy; GitHub + Linear mapping
