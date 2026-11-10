# Plan: AIDLC Fully Local — OpenCode + Self-Hosted LLMs

**Status:** Plan (agreed in design session, 2026-11-05). P1 templates shipped; P2 daemon + [`docs/OPENCODE-LOCAL.md`](../../docs/OPENCODE-LOCAL.md) shipped 2026-11-09 (findings under §10).
**Owner:** Melissa Benua
**On completion:** consumer-facing content ships as `docs/OPENCODE-LOCAL.md` + templates (see §8). This plan is the work artifact; the shipped guide is the deliverable.

---

## 1. Goal

Add a **transport option** to the AIDLC so the full lifecycle runs **locally**: OpenCode as the agent harness, **self-hosted LLMs** (no Cursor, no cloud agents). "Locally" scopes to **model traffic and orchestration** — the code already lives on GitHub, and the CI layer is a **per-repo choice** (Actions or hooks + daemon re-run; §11). Nothing existing is ripped out — per the [ISSUE-TRACKER-PORTABILITY.md](../../docs/ISSUE-TRACKER-PORTABILITY.md) contract, *how* status moves and work is dispatched is a pluggable transport; this is a new one, alongside the GitHub queue and the Cursor/Linear path.

### Canonical local stack (decided)

| Concern | Choice |
|---|---|
| Tickets, specs, gates | **Linear** — workflow state = phase; specs = **Documents** on the Feature issue |
| Code | **GitHub** — branches + PRs |
| Check evidence | **A per-repo choice** (§11): GitHub Actions on cloud runners, Actions on a self-hosted runner, or **pre-commit hooks + daemon re-run** — one result per SHA, per AIDLC Test, whichever source the repo picks. **Hooks always** give the agent fast inner-loop feedback in the lane |
| Harness | **OpenCode** (skills work unchanged via compatibility discovery; commands bind agent+model) |
| Models | **Self-hosted** (Ollama / vLLM / LM Studio / OpenAI-compatible), tiered by phase |
| Orchestration | **Local daemon** (poller) → `opencode run` headless — replaces Cursor Cloud dispatch; polling/claim/park machinery inherited from [SELF-HOSTED-AIDLC.md](../../docs/SELF-HOSTED-AIDLC.md) |

### What OpenCode already gives us (no skill changes)

- Skills are auto-discovered from `.claude/skills` / `~/.claude/skills` (project + global compatibility roots); skill ID = leaf directory name → `skills/plan/SKILL.md` → `plan`, exactly the names the orchestrators use. **The `skills/` corpus is untouched.**
- Consumer repos point OpenCode at the submodule via the existing `.claude/skills` symlink, or explicitly via `skills: ["./.claude/deps/ai-dlc/skills"]` in `opencode.jsonc`.
- The Claude/Cursor marketplaces remain the plugin vehicle for those vendors; OpenCode needs no package — config + skills + commands are the distribution.

---

## 2. Non-negotiable invariants

1. **Separation of privilege — an agent must never hold the power to satisfy its own gate.** Learned the hard way from the Linear/Cursor deployment: an agent holding a key that could update ticket contents also held state-change power, and eventually auto-advanced its own gate. The fix is structural, not prompt-level.
2. **Agents implement. Orchestrators coordinate. Humans decide.** Every human gate is a **state move made by the human, in the Linear UI**.
3. **Events are triggers, not evidence.** The daemon **re-verifies** machine evidence itself (queries the configured check source at the SHA — and re-runs the suite itself wherever that source shares a machine with the agent — and re-queries Linear/GitHub) before acting. An agent — or a webhook — can emit anything; only what the daemon independently observes advances the loop.
4. **Ceiling rule.** Machine events can at most **present** a human gate, never satisfy one. Even a fully faked scorecard cannot close a Feature; it can only ask the human the Validate question — a scorecard containing **human-pending evidence** (e.g. vision-less UI rows) likewise blocks the auto-Learn; the human's confirmation replaces the agent's judgment.
5. **No spec content in the repo.** Specs, review reports, scorecards, and retrospectives live in **Linear Documents**. The repo holds: code, ADRs, process docs, hooks, OpenCode config, daemon. (The repo's `feature/<slug>/` invariants apply to repos that use file-based specs; the local/Linear path follows the deliberate divergence already established in [LINEAR-AIDLC-PROJECT.md](../../docs/LINEAR-AIDLC-PROJECT.md).)
6. **Fully-local guarantee.** `opencode.jsonc` `policies` deny all cloud `provider.use` — model traffic has no egress.
7. **Checks cannot be redefined by the code under test.** An agent must not satisfy its own gate by *editing the gate*: PRs touching check definitions (`.github/workflows/**`, hook configs, self-hosted runner configs) get a daemon flag **and** a blocking DevOps-review finding, and checks are evaluated from the **base-branch** definition where possible. (Invariant 1, applied one level down.)

---

## 3. Identity & privilege architecture

One **bot member** (dedicated Linear seat, per the existing Linear doc) is the machine's only Linear identity. Three actors, three different powers:

| Identity | Linear | GitHub | Gate power |
|---|---|---|---|
| **Agent** (opencode run) | Bot member's **content-scoped key** (read, Documents, comments — **no issue writes**; verify Linear key scoping in §10.1) **via Linear MCP**; harness additionally **denies the state-update and delegate tools**. The **full key never enters the agent process** (daemon injects only the content key for the MCP server; the full key stays in the daemon's keychain). The agent's key is separate = a **kill switch** (revoke it on misbehavior; daemon keeps working). | **Dedicated GitHub bot account** (the machine's GitHub identity, mirroring the Linear bot seat): PAT = push + PR comment. `gh pr merge` denied in the harness **and** by branch protection (required **human** review + required checks) — self-merge is structurally impossible, not prompt-denied. | **None.** |
| **Daemon** | Same bot member, **full key** — the only place it exists. Makes only the §4 machine moves (all progressions/presentations — never a gate). **Reverts any bot-actor state move it did not authorize.** **Creates the slices** from the Tech Spec's `aidlc-slices` block on the Design→Build+Test gate (born inert by construction). **Owns the delegate** (set on dispatch, cleared on completion — the tracker-side "robot working here" signal). | Read-only `gh` (bot account; PR state, merge SHA, check conclusions = CI evidence). | Machine moves only — it's our code, trusted but audited. |
| **Human** (you, in the UI) | Full. | Merges PRs. | **Only human-actor moves create valid gates.** |

### Gate validation

- **Tier 1 — the agent (preferred: impossible).** If Linear keys can be scoped (§10.1): the agent's key is **content-only** — a raw API call with it *cannot move state, period*. Self-approval by the agent is structurally blocked regardless of tool-deny circumvention or env access.
- **Tier 2 — the agent (fallback if Linear can't scope keys):** full key + harness tool-deny + **temporal fence** — a state move observed while the run process is **alive** on that issue → daemon **gracefully stops the run, reverts, flags**, pauses until `aidlc gate confirm <issue>`. A move observed **after the run has exited** (daemon mid-teardown) is **accepted** — approving right after a run ends is the *common* case, not an edge case.
- **Tier 3 — the daemon (always on):** every move gets an **actor check** (a gate is valid iff the actor is the human; verify API/webhook actor exposure in P1) + any unauthorized bot-actor move is **reverted within one poll interval**. The daemon is trusted code; a compromised *daemon* key is what the signed-gate tier (HMAC, human-held key) is for.

### Consequence for Linear writes (the "how do specs get into Linear" answer)

- **Specs (Product/Tech/Review report/Scorecard):** the agent creates/updates **Linear Documents** on the Feature issue **directly, in-session, as the bot** — conversation-first rhythm works natively: draft → post to the thread → human replies in Linear or the TUI → agent revises the Document. Zero spec bytes in the repo.
- **Updates:** handoff summaries and live progress as **bot comments** (one status comment, **edited in place** — no comment spam).
- **PR links:** free — Linear auto-links via the `TEAM-123` title/body convention (already in the AGENTS.md block).
- **ADRs:** stay in-repo (`docs/adr/`) — code-adjacent records, consistent with the existing Linear path. *(Owner confirmed, 2026-11-09.)*
- **Slices:** the agent **does not create issues**. Design writes the slice plan as an `aidlc-slices` JSON block in the Tech Spec Document; after the human's Design→Build+Test move, the daemon (P2) or `aidlc-slices.sh` run by the human (P1) creates the sub-issues in the backlog state, chained with `blocks`. "Slices born inert" holds **by construction**: they don't exist before the gate. *(Owner, 2026-11-09 — Design→Build+Test is where self-approval was seen most.)*

---

## 4. Phase flow

States and artifact model are inherited from [LINEAR-AIDLC-PROJECT.md](../../docs/LINEAR-AIDLC-PROJECT.md) — which runs the machine at **two levels**, and so does this plan (the earlier draft collapsed both into one table; a 5-slice Feature would have tripped its own breaker and validated a half-feature):

- **Slice** (sub-issue, 1–9 per Feature; "a slice's *state* is its build trigger" — inherited rule): runs **Build+Test → Review → In Staging → Done**.
- **Feature (umbrella)**: runs **Plan → Design → Build+Test** (releases the slice chain; never builds) **→ In Staging** (feature-level validate) **→ Ship** (Learn) **→ Done**.

What the local path changes: **dispatch = the local daemon** (not delegate-triggered — the daemon owns the delegate lifecycle), **check evidence = the per-repo choice** (§11), **the agent's Linear access = content-scoped MCP** (§3). The daemon keys `transitions.json` on **(issue kind, state, event)** — slices and Features share the team's state *names*, not its behavior.

**Feature level**

| State entry | Trigger | Daemon does | Agent run does | Ends when |
|---|---|---|---|---|
| **Plan** | Human move (Triage→Plan, or direct) | dispatches `/plan` | Product Spec → Linear Document; conversation-first; run ends asking for approval | run exits (draft + `@you`) |
| **Design** | **Human gate** (Plan→Design) | dispatches `/design` | Tech Spec → Document, with the slice plan as an `aidlc-slices` block (no issues created) | run exits |
| **Build+Test** | **Human gate** (Design→Build+Test) | 1-slice: Feature **is the unit** — runs the slice loop below. Multi-slice: **creates the slices** from the Tech Spec block (backlog state, `blocks` chain, idempotent), then **releases slice 1** (→ Build+Test, delegate = bot); umbrella **waits** on the chain, never builds itself | (umbrella: none) | **last slice Done** |
| **In Staging** | **Machine:** last slice Done (1-slice: your merge) | moves state; verifies checks at merged main (configured source, §11); dispatches `/ship` in a lane **pinned to merged main** | **feature-level Validate** (below) → **Scorecard → Linear Document** + evidence + `@you` | scorecard filed |
| **Ship** | **Machine:** scorecard filed | moves state; **auto-launches `/learn` on ≥ threshold** (flag; **held while any evidence row is human-pending** — §11) | `/learn`: ADRs in repo, retro notes appended to Tech Spec Document, `@you: ready for Done` | run exits |
| **Done** | **Human gate** (Ship→Done) | closes feature; clears locks; tears down lanes | — | — |
| **(resume)** | **Human comment** on a thread whose run has **ended** (Plan/Design/Ship conversations) | **re-dispatches the same phase** — the Document *is* the state; the fresh run reads it + the new comment (dedupe by comment ID, human-actor only) | revises the Document in response | run exits |

**Slice level** — each sub-issue of a multi-slice Feature; a **1-slice Feature runs this loop as itself** (its In Staging does the full feature-level validate above; its Done is the human gate).

| State entry | Trigger | Daemon does | Agent run does | Ends when |
|---|---|---|---|---|
| **Build+Test** | first: Design gate releases it; next: prior sibling **Done** | dispatches `/build` in the lane **on the slice's branch** (fresh: base-branch head; **bounce**: the existing branch, review findings in the prompt) | TDD, hooks at each commit, **open PR** with `TEAM-123` | PR opened |
| **Review** | **Machine:** PR ready | moves state; **verifies check evidence at PR head** (configured source, §11) | six specialist **subagents** review **the PR** (Review detail below; concurrency configurable, default sequential on one machine — §11) → per-dimension **PR comments** + Linear summary | run exits; **human merges or bounces** |
| **In Staging** | **Machine:** PR merged *(merged from Build+Test = Review skipped → flag comment; the human's prerogative, the machine records it)* | moves state; verifies checks at merge SHA; **slice validation** = daemon **scripts** the boot + the slice's acceptance criteria (no LLM run) | — | green → **Done (machine)**; red → daemon presents failure + proposed return phase; **human bounces** (breaker counts, below) |
| **Done** | **Machine:** slice validation green | moves state; **releases next unblocked sibling** | — | — |

### Robot lanes (all phases)

Every run executes in a **robot lane** — a daemon-created worktree (OpenCode `worktree` config; the consumer sets the directory) pinned to the dispatch SHA, **or checked out to the slice's branch on a bounce**: base-branch head for Plan/Design/fresh Build, the **slice's branch tip** for a bounced Build, PR head for Review, merged main for Ship. The lane is isolated from the human's checkout; the app **builds and boots from the lane**, never from the human's working copy; the lane is torn down after the run (evidence is uploaded to Linear first). Lanes are per-Feature, so two Features can be in flight concurrently (Build of A while Validating B) without trampling — **the validation surface declares how concurrent lanes stay isolated** (per-lane port offset; an ephemeral simulator device per lane — §7). **Why a worktree, not a container** (SELF-HOSTED-AIDLC's platform-native boundary): the validation surface *is* the host toolchain — a Linux container cannot drive `xcodebuild`/`simctl`/Chrome. The compensating controls are the privilege architecture (§3) + branch protection, not container isolation.

### Review detail (against the PR, with specialist fan-out)

1. **PR is the object of review.** The run gets the PR number, base/head SHAs, the diff, and the check verdict at PR head — the **configured source's results** (Actions — cloud or self-hosted runner — or the daemon's local re-run) *are* the CI verdict the skill expects. PRs that touch check definitions are flagged (§2.7).
2. **Six specialist subagents** — Tech Spec compliance, Testing sufficiency, DevOps, Frontend/UX, Security, Architectural Soundness (§5): fresh narrow contexts, **read-only** (reviewers never edit code), per-dimension model tier, **concurrency configurable — default sequential on one machine** (six 27B-class instances don't fit; §11).
3. The orchestrator **aggregates** → one PR comment per dimension (`AIDLC Review — X` headers, blocking vs advisory) + summary Document/comment in Linear with `@you`.
4. Why *real* subagents matter more with self-hosted models: a 27B-class model reviews a bounded diff better in six narrow contexts than in one giant one — and parallel children cut wall-clock **when the hardware allows** (§11).
5. Ends: comments posted → **you merge or bounce**. Bounce = **you** move the slice to Build+Test (breaker counts, below); the daemon re-dispatches `/build` on the slice's branch with the findings.

### Validate detail (the "robot boots the app" flow)

This is the **feature-level** validate — the Feature issue's In Staging (its own, in the 1-slice case). The criteria are the Product Spec's **success criteria** — integration-level, which is why Validate waits for **all slices merged** (a multi-slice *slice's* In Staging is the lighter scripted analog: slice acceptance criteria, no LLM run).

1. The Feature reaches **In Staging** — a 1-slice Feature on **your merge** in GitHub; a multi-slice Feature on the **last slice reaching Done** → daemon moves the state and dispatches the validate run.
2. Daemon pre-check: **verifies check evidence at the merge SHA** from the configured source (Actions on a GitHub runner = independent machine; wherever the source shares a machine with the agent — self-hosted runner, hooks-only — the daemon **re-runs the suite itself**, since hooks are skippable via `--no-verify`).
3. Ship agent, in the lane at the merge SHA: **builds and boots via the declared validation surface** (§7) — web app in a docker stack or dev server → URL + Chrome DevTools MCP; macOS app → `xcodebuild` → simulator via `xcrun simctl`; CLI/library → command execution + output assertions. Waits for readiness, exercises each success criterion, captures **annotated evidence** (screenshots from the surface's own toolchain, or output) per criterion.
   - **Build or boot failure → immediate FAIL** with the diagnosis — never validate a broken build (local analog of the ship skill's `failed_deploy` handler).
4. **Scorecard** computed against the 90% default → filed as a **Linear Document**, evidence attached, `@you` comment.
   - **≥ 90%** → daemon auto-launches `/learn` (flag; **held while any evidence row is human-pending** — e.g. no vision model, §11 — the human's confirmation triggers Learn instead) → outputs filed → `@you: ready for Done`.
   - **< 90%** → daemon does **nothing** — the report + proposed return phase sits in Linear; *you* move the state to the true root-cause phase; daemon dispatches it. (A multi-slice Feature's root cause is usually a *slice* — you move that slice; the umbrella re-enters only for 1-slice Features or a true integration fix.)
5. You move **Ship→Done** (scorecard + Learn outputs approved in the final gate, per AIDLC). Bot-actor Done moves are reverted.

**Local Validate = post-merge model** (the AIDLC's feature-flag option assumes a real deployment target). "Staging" **is** "the app built from merged main, in the robot lane" — a docker stack, a simulator, or a CLI binary is equally valid; one less environment to keep alive. (Multi-slice: "post-merge" = post-**all**-slices — Validate only runs when the Feature is whole.)

### Bounce circuit breaker (inherited, disambiguated)

Count **bounces** — failure re-entries into Build+Test (from Review or In Staging) — **per slice**; on the Nth (default 5) → breaker comment in Linear, reassign the slice to a human lead, stop the chain. **Slice-chain progress does not count** (a Done slice releasing the next is normal, not a failure) — a 5-slice Feature is a normal day, not a breaker trip. A run loop is not a fix.

### Your part — at a glance

The machine does everything except the gates. One channel to watch: **Linear notifications** — the bot `@mentions` you when it needs you (routes to Slack if your workspace has it).

| When you're poked | You do (one action) |
|---|---|
| Plan draft ready | read the Product Spec in Linear → **move Plan→Design** — or comment to revise; the run resumes on your comment |
| Design ready | read Tech Spec + slice plan → **move Design→Build+Test** — *the gate that starts building* |
| Review comments on a PR | read the PR → **merge** (the Review gate) or **bounce** it to Build+Test (breaker counts) |
| Scorecard + Learn outputs filed | read both in the Feature thread → **move Ship→Done** (the final gate) |
| Rare flags | breaker tripped → your fix-or-cancel call; a fence flag on a move *you* made mid-run → `aidlc gate confirm <issue>` |

That's the whole job: **3 state gates per Feature** + **a merge-or-bounce per slice PR**. The machine runs the slice chain; you never touch individual slices unless a bounce lands on you.

---

## 5. Self-hosted LLM layer (`opencode.jsonc`)

Consumer template (`docs/templates/aidlc-local/opencode/opencode.jsonc`):

- **`providers`** — built-in local runtimes with auto-discovery: Ollama, vLLM, LM Studio; or a custom `@opencode/ai/providers/openai-compatible` entry for any gateway. `settings.baseURL` + `{env:…}` for secrets. Explicit `models` with `limit` (context/output) and `capabilities` — **vLLM discovery ships with tools disabled**, so tool-calling must be declared explicitly.
- **Model tiering** — per-agent/per-command `model`:
  - `plan` / `design` / `review` / `ship` → **strongest local model** (long context + judgment; e.g. the 27B-class model this plan was drafted with, or bigger)
  - `build` / test → **workhorse** (smaller/faster)
  - `aidlc doctor` gates the setup: endpoint reachable, models discovered, **tool-call smoke test** — before anyone trusts a phase to it.
- **`policies`** — `provider.use` deny `*`, allow only the local provider IDs → the §2.6 no-egress guarantee, machine-enforced.
- **`mcp`** — `linear` (bot key via `{env:LINEAR_BOT_KEY}`) + `chrome-devtools` (UI validation for **web surfaces**, per INTERACTIVE-UI-VALIDATION.md; non-web surfaces validate via shell tooling — `xcrun simctl` for macOS apps — see §7).
- **`instructions`** — `AGENTS.md`, `docs/AIDLC.md` (canonical process in every session).
- **`permissions` / agent profiles** — a hidden `aidlc-runner` profile for headless dispatch: allow repo edits + check commands + Linear MCP (read/docs/comments/create) + skill loading; **deny** the Linear state-update tool, `gh pr merge *`, destructive shell; scoped `ask` elsewhere. (Verify V2 permission resource syntax + headless `ask` behavior in P1.)

**Phase entry points:** six command files (`plan` … `learn`) binding agent + model + template; **six consumer-side skill overrides** (`.opencode/skills/<phase>/`) encoding the local deltas — specs are **Linear Documents via MCP** (never `feature/<slug>/` files), the Linear state names, and "never move state." This is the documented consumer-override pattern (same as `.cursor/skills` overrides today): OpenCode loads the override, Cursor/Claude users in the same repo keep the library versions. The library's generic skills stay the base and are **not** modified.

**Specialists as real OpenCode subagents.** The library's specialist bundles (`agent-reviewer`, `agent-devops-review`, `agent-security-review`, plus the horizontal skills) become **`mode: subagent` agent files** in the consumer template (`.opencode/agents/…`): fresh context, per-specialist model, **read-only permissions** (reviewers never edit; shell limited to check commands). **Review fans all six out** (§4) — **concurrency is configurable, default sequential on one machine**: six 27B-class instances won't fit in a laptop, but a 27B-class model reviews a bounded diff better in six *narrow* contexts — that is the quality lever; parallelism is a wall-clock optimization for hardware that can carry it. Build may route Tech Spec sections to domain specialists when files don't overlap (the library's existing "consumer specialist dispatch" pattern). Nesting stays at the default depth (specialists do not spawn their own); raise `experimental.subagent_depth` only with a bigger model.

---

## 6. The daemon (`aidlc-daemon`)

A small local process (default: your laptop; launchd/systemd/cron unit in the template). It is the **only** thing that moves state and the **only** verifier.

- **Sources (pluggable, all idempotent — dedupe by issue+SHA+event):**
  - **Poll (default, zero infra)** — machinery inherited from [SELF-HOSTED-AIDLC.md](../../docs/SELF-HOSTED-AIDLC.md) (a working deployment, already in the repo): **two cadences** (10m eligible work / 30s parked runs), **persisted cursor** (a reboot catches up, never re-processes the world), **manual kick on a private interface** (a phone shortcut; worst-case dispatch = one interval, the kick removes that). Queries: Linear (state + actor, **human comments → the resume transition** §4, `needs-a-human` parking, slices) + GitHub (`gh` PR state, merge SHA, **check-run conclusions**).
  - **Park/resume (inherited):** mid-run question → `needs-a-human` label ([ASK-AND-HALT.md](../../docs/ASK-AND-HALT.md)) + checkpoint; the 30s loop detects a **non-bot comment after the bot's question** → rehydrates in the same session. **Complements the §4 resume row** — park = *mid-run* (session preserved); the resume row = *post-end* (fresh run, the Document is the state).
  - **Webhook (optional fast path):** Linear webhooks → same handler. (A webhook to a laptop needs a tunnel = a cloud hop — the same two costs SELF-HOSTED-AIDLC details: a service-token exception you'll forget, and dropped events. Poll is the zero-infra default — §11.)
- **Local operational state** — `~/.config/aidlc/<owner>/<repo>/`: last-observed state, per-issue lock, retry counters, run logs. **Operational only — never spec content.**
- **`transitions.json`** — machine-readable encoding of the §4 table (the AIDLC gate table, mechanized): per (state, event) → action {dispatch run | move | comment | verify | none}, with guards. Single source of truth for the loop; human-readable.
- **Runner** — acquires the per-issue lock → **sets the delegate = bot — the claim is a compare-and-set** (re-read after the write; if the delegate isn't ours, another worker or a human took it; inherited from SELF-HOSTED-AIDLC; **owner-confirmed 2026-11-09: the claim is delegate-only** — state enters via the human gates + the §4 machine moves, never via the claim) → creates the **robot lane** (worktree at the pinned SHA, §4) → builds the phase prompt (hard stops per phase, PR/SHA context, review findings on a bounce, Linear MCP guidance, "you must not move state; if you believe the phase should advance, stop and say so") → `opencode run --agent <phase>` in the lane → tees to the run log → records result → **tears the lane down** (evidence uploaded first) → **clears the delegate** → releases lock.
- **Safety** — per-issue mutex; **per-run wall-clock cap** (per phase) → kill + log + retry ≤ N (backoff) → surface to human — a hung run must never hold the lock forever; `aidlc pause` / PAUSE file (kill switch); unauthorized bot-actor state move → **revert + flag + pause**; machine-off = loop paused (by design), `aidlc reconcile` on resume (mirrors the GitHub path's manual reconcile).
- **CLI** — `aidlc status <issue>` (V-model position + recent events), `aidlc tail` (follow events), `aidlc gate confirm <issue>`, `aidlc doctor`, `aidlc pause|resume`.

---

## 7. Consumer repo template

A repo adopting the local path gets (all from `docs/templates/aidlc-local/`):

1. `opencode/opencode.jsonc` — §5, parameterized (baseURL, model IDs, state names).
2. `opencode/skills/{plan,design,build,review,ship,learn}/SKILL.md` — local overrides (§5) **and `opencode/agents/*.md`** — specialist subagents (Review dimensions; optional Build dispatch): read-only, per-dimension model (§5).
3. `AGENTS.md` blocks —
   - **Issue tracker (AIDLC)** table with `System: linear` + a new **Privilege** row: *which credential the agent holds; the agent may not write phase state* (per the canonical invariant, §2.1).
   - **Validation target** block — a `surface:` declaration + per-surface toolchain:
     - `web` (SaaS): docker compose / dev-server launch, URL, readiness probe, test-credential env var **names** (values in the daemon's env/keychain, never in the repo), login-flow notes, **per-lane port offset** (concurrent lanes never collide on 3000) — validated via Chrome DevTools MCP.
     - `macos-app`: scheme/target, `xcodebuild` flags, simulator device — **an ephemeral device per lane** (`simctl create` at lane start, `delete` at teardown; two lanes never share a device) — launch + screenshot commands via `xcrun simctl`; the simulator **is** the staging environment.
     - `cli`: entrypoint + invocation.
     - Teardown for any surface.
4. **Checks** — the repo declares a **CI mode**: `actions-cloud` (`.github/workflows/` template + **required checks** on the default branch, so even a human can't merge red), `actions-self-hosted` (same workflows on your runner; daemon re-runs locally as backstop), or `hooks-only` (no Actions; the daemon's re-run **is** the evidence) — **plus** pre-commit config (fast inner loop, in every mode) + `pre-commit install` step. The mode lives in the daemon config and is noted in `AGENTS.md`.
5. Daemon + platform unit (launchd / systemd / crontab) + **a standalone `aidlc-doctor.sh`** (works without the daemon — the P1 conformance check: endpoint up, models discovered, tool-call smoke test, cloud policies verified) + `.env.example` (bot key, GH read token — **daemon-side secrets; never in the agent's env**).
6. `docs/AIDLC.md` (template copy) — process ground truth.

**"Fully local" conformance checklist** (in the shipped guide): Linear team with the 9 states; bot seat + key (**separate keys: agent = content-scoped, daemon = full**); GitHub repo + PAT (**bot account; branch protection with a required human review**); **CI mode declared** (Actions required checks, or hooks-only) + hooks installed; OpenCode + local runtime passing `aidlc doctor`; policies denying cloud; daemon installed; **one control plane per Linear team** (a local-path team is separate from any cloud-path team — two bots must never move the same states).

---

## 8. Repo changes (file map in AI-DLC)

**New**

| Path | Contents |
|---|---|
| `feature/opencode-local/plan.md` | this plan |
| `docs/OPENCODE-LOCAL.md` | **Shipped consumer guide** (P2): setup, identity/privilege model, phase flow, ops (pause/reconcile/doctor), troubleshooting, conformance checklist |
| `docs/templates/aidlc-local/opencode/opencode.jsonc` | provider/model/policy/MCP/permission template |
| `docs/templates/aidlc-local/opencode/skills/*/SKILL.md` | six local phase overrides |
| `docs/templates/aidlc-local/opencode/agents/*.md` | specialist subagents — six review dimensions (+ optional build dispatch): read-only, per-dimension model |
| `docs/templates/aidlc-local/daemon/` | `aidlc-daemon` (poll, verify, dispatch), `transitions.json.example`, `aidlc` CLI, prompt templates (local variants of `scripts/prompts/`), platform units, `.env.example` |

**Edited**

| Path | Change |
|---|---|
| `install.sh` | third symlink target `~/.config/opencode/skills` (cursor + claude untouched) |
| `docs/INSTALL.md` | OpenCode section |
| `docs/SKILLS.md` | discovery note: bundles work in OpenCode via `.claude/skills` compat / `skills:` config; no manifest changes |
| `docs/CONSUMER-SETUP.md` | OpenCode layout row |
| `docs/SELF-HOSTED-AIDLC.md` | **P2 only:** pin the claim wording (delegate CAS, no state move on dispatch); fully-local model-slot values (no frontier escalation); worktree-vs-container delta pointer |
| `docs/GETTING-ORIENTED.md` | one adoption-path line for the OpenCode local path (P2) |
| `docs/LINEAR-AIDLC-PROJECT.md` | **Local dispatch variant** section: daemon replaces delegate-dispatch (**daemon owns the delegate lifecycle; the agent never writes it**); the two-level flow made explicit (slices run the build loop; umbrella gates + feature-level validate); check evidence = per-repo choice (Actions or hooks + daemon re-run); agent key = content-scoped where Linear allows (else the fence tier); pointer to OPENCODE-LOCAL.md. State machine + artifact model unchanged (single source of truth stays here) |
| `docs/ISSUE-TRACKER-PORTABILITY.md` | **Privilege** row in the AGENTS.md tracker-table templates |
| `docs/templates/AIDLC.md` | canonical invariant paragraph (§2.1) + one line in *Advanced*: local daemon as a control-plane option |
| `README.md` / `AGENTS.md` | docs table / quick links |

**Retro-harden existing transports** (the Linear bug, closed where it actually bit)

- `aidlc-launch` composite prompt: add hard stop — *"You must not change AIDLC phase/workflow state. If you believe the phase should advance, stop and say so in a comment."*
- Docs: `AIDLC_GH_CALLBACK_TOKEN` scoped to comments/PRs/`aidlc_work:*` — **no** Projects v2 mutation; Linear cloud-path bot key documented as content-only intent with the actor-audit backstop.
- Optional (P3): small GitHub Action auditing **bot-actor** state moves on the cloud path (flag + revert).

**CI:** optional `bash -n` / shellcheck on template scripts (small addition to `skill-ci.yml` or a sibling workflow).

**Not changed:** `skills/` corpus, marketplaces, plugin sync, Cursor/Linear/GitHub transports.

---

## 9. Rollout

**P1 — Foundation (human-driven; no daemon).**
1. **Verify Linear (task one):** current API key scopes (content vs state); whether GraphQL/webhook expose the **actor** of state changes; `updateComment` (in-place status edits); Document image attachments.
2. **Verify OpenCode:** `opencode run` flags (CLI page was unreachable in the design session); MCP tool permission resource syntax; shell env redaction for `{env:}` secrets; headless `ask` behavior (must not hang).
3. `opencode.jsonc` template + six commands + six overrides + `install.sh` target + standalone `aidlc-doctor.sh`.
4. Doc edits incl. the AIDLC.md invariant, the Privilege row, and the LINEAR-AIDLC-PROJECT local-variant section.
*Outcome: you run AIDLC in OpenCode on local models, writing Linear Documents directly; every transition manual. Self-approval is blocked per §3 — the content-scoped agent key, or (if Linear can't scope keys) a **minimal guardian**: a tiny poller that reverts + flags bot-actor moves, the daemon's safety core shipped early. There is no "zero risk" claim — there is a defined failure mode.*
*DoD: one real feature through Plan → … → Done, human-driven, on local models — you do only the gates and the merge.*

**P2 — The event loop.** Daemon: poll, transitions (keyed on issue kind, state, event — §4), **slice-chain choreography** (release first / next on sibling Done / umbrella waits; breaker per-slice bounces), runner (robot lanes, SHA-pinned, delegate set/cleared, per-run wall-clock caps), gate validation (actor + fence, §3), the **resume transition** (human comment on an ended run re-dispatches), **check-evidence verification** (configured source, §11) at PR head and merge SHA, check-definition tamper flag, slice validation, validation-surface boot **with per-lane isolation** (ports, sim devices), review subagent fan-out, CLI (`status`/`tail`/`gate confirm`/`doctor`/`pause`), platform units. Ship `docs/OPENCODE-LOCAL.md`.
*Outcome: merge → auto Validate → auto Learn → your Done click. Everything else auto-after-gate. DoD: the same feature, on the daemon — you do nothing but the gates and the merge/bounce.*

**P3 — Hardening + dogfood.** Screenshot attachments, Learn-auto flag, webhooks fast path, circuit-breaker polish, retro edits (§8), shellcheck CI, conformance checklist — and **dogfood: run one real small feature end-to-end on a local model** in a scratch repo, measuring what a self-hosted model can and cannot carry per phase.

---

## 10. Verification items (block the phases they gate)

| # | Question | Gates |
|---|---|---|
| 1 | Linear: **can API keys be scoped to content-only (state mutation excluded)?** Multiple keys per member + per-key revocation? Actor of state changes in API/webhook? `updateComment`? Document image upload? **Document update semantics (agent edit vs human in-UI edit — overwrite or patch)?** | P1 — **decides which §3 tier ships: agent self-approval = impossible vs detected+reverted** |
| 2 | OpenCode: exact `opencode run` flags; MCP tool-deny syntax; env redaction; headless `ask`; **skill ID precedence: project `.opencode/skills` vs `.claude/skills` compat root vs global install — the override design depends on it** | P1 |
| 3 | Default **check suite** for the template (Actions workflow + hook suite: tests/lint/typecheck); private-repo Actions minutes budget for repos that use Actions | P2 |
| 4 | Linear polling rate limits at our intervals **and agent write volume** (Document edit cadence per run) (or webhook availability) | P2 |
| 5 | OpenCode: parallel subagent fan-out, per-subagent model, `subagent_depth` defaults | P1 |
| 6 | Vision capability of the chosen local model (UI evidence interpretation) | P2 |

### P1 findings (2026-11-09, OpenCode v2.2.5, LM Studio, qwen3.8-27b)

Item 2 is answered; items 1 and 5 are partly answered. Each "tested" row below was run against the template in a scratch consumer repo.

| Finding | Effect on the design |
|---|---|
| `opencode run` takes `--agent`, `--model`, `--session`, `--format json`, `--auto` (approve anything not denied). It has **no `--command`** | The daemon passes `--agent` + `--model` + the prompt; the `/aidlc/<phase>` commands are for humans in the TUI |
| An unmatched permission defaults to `ask`. A denied tool returns `permission.rejected` immediately (**tested**) | Runner agents start with `{ * * deny }` and allow explicitly, so a headless run never reaches `ask`. No `--auto` |
| Skill precedence, low → high: `.claude/skills` → `~/.config/opencode/skills` → project `.opencode/skills` → explicit `skills` config. The override beats the library `build` (**tested**) | §1's `skills: ["./.claude/deps/ai-dlc/skills"]` option is **dropped** because it would shadow the overrides. **No `~/.config/opencode/skills` target in `install.sh`**: that root also outranks a pinned submodule, and `~/.claude/skills` is already discovered |
| `policies` `provider.use` deny `*` + allow `local` refuses every other provider; the control run without the policy succeeds (**tested**) | §2.6 no-egress is machine-enforced |
| The Linear MCP has **one `save_issue` tool for create and update** (state, delegate, assignee) | Tool-deny cannot allow "create slice" while blocking "move state". **No agent gets `save_issue`**: slices move into the Tech Spec (`aidlc-slices` block) and are created after the gate by `aidlc-slices.sh` / the daemon. That closes Design's self-approval path through the harness even if Linear keys can't be scoped; §10.1 still governs raw-API misuse of the key |
| Built-in agents are named `plan` and `build` | Commands are namespaced `/aidlc/<phase>`; one runner agent, `aidlc-runner`, for every phase |
| A `read * allow` rule overrides OpenCode's default `ask` on `*.env` | The runners and reviewers re-deny `*.env` / `*.env.*` |
| Review subagents (`mode: subagent`, YAML `permissions`) load with per-agent model (**tested**). Parallel fan-out and `subagent_depth` are not yet exercised | Item 5 stays open until the P1 DoD run |

Still open for P1: item 1 (Linear key scoping, actor exposure, Document update semantics), whether `{env:}` secrets are redacted from shell output, and parallel subagent fan-out.

### P2 findings (2026-11-09, daemon in `docs/templates/aidlc-local/daemon/`)

Tested against an in-memory Linear mock and a fake GitHub (`daemon/test/`, 45 tests), the daemon's GraphQL validated against Linear's published schema, and one dispatch through real OpenCode v2.2.5 + a local model.

| Finding | Effect on the design |
|---|---|
| `opencode run --session` **requires an ID starting with `ses`**; a bad ID errors and the process then hangs (**tested**). A new `ses_…` ID creates the session, and a second run with the same ID continues the conversation (**tested**) | The daemon names every session `ses_aidlc-<issue>-<run>`; park/resume re-runs `--session <same id>` in the kept lane. The wall-clock cap is what catches a hang |
| Linear's schema has `IssueHistory.actor` / `botActor` / `fromStateId` / `toStateId` and `Issue.delegate` / `IssueUpdateInput.delegateId` (**schema-validated**) | The actor check reads history; the claim is a `delegateId` CAS. Whether a member seat may be a delegate, and that an API-key move reports the key's user as `actor`, still need a real workspace (item 1) |
| With agents running as the human's OS user, the agent's **shell can read the daemon's key file** (env allowlisting keeps it out of the process env, not off the disk) | `runner.runAs` runs agents as a separate OS user; `aidlc doctor` warns while it is unset. In the same-user mode a stolen key is still caught by the actor check (bot move the daemon did not make → reverted), which is detection, not prevention |
| The daemon cannot tell a question from a handoff without a marker | The question comment's first line is `**AIDLC question**` (prompt + `aidlc-local` skill); only a question posted during the run parks it |
| The Ship → Learn decision needs machine-readable counts | The scorecard Document ends with an `aidlc-scorecard` block (`passed` / `failed` / `humanPending` / `total`); the daemon computes the score against its own threshold |
| A sub-issue carrying a slice marker is not proof the daemon created it | Only slices the daemon created (or a human adopted with `aidlc slices --adopt`) are dispatched; unknown marker issues are flagged |
| The daemon config is itself a check definition | Config + transitions live in `~/.config/aidlc/<owner>/<repo>/`, outside any lane; the ceiling rule (no machine move into a Feature gate) is enforced in code, not in `transitions.json` |

---

## 11. Honest limits

- **Self-approval: the agent = impossible, if Linear keys can be scoped** (content-only key — the API refuses state moves no matter what the agent reads; §3 tier 1). If Linear can't scope: **detected + reverted within one poll** (tier 2). The **daemon** is trusted code with the fence + revert backstop (tier 3) — the signed-gate tier (HMAC, human-held key) is the upgrade path for shared machines / a compromised daemon, not in this plan.
- **Self-hosted model quality is the real risk.** Tiering + `doctor` set expectations: a 27B-class model is plausible for build/test and risky for plan/review; the shipped guide includes a per-phase "minimum model bar" table to be filled in by the P3 dogfood.
- **UI evidence needs a vision-capable model.** Without one, screenshots are still captured and attached — *you* eyeball them at the gate. Acceptable degraded mode (gates are human anyway), but the scorecard's UI rows then read "evidence attached — human-verified" rather than agent-judged — **and auto-Learn is held** until you confirm those rows (ceiling rule, §2.4).
- **One laptop does the computing, the checking, and the serving.** The model, the app build, the simulator/docker, and Chrome share one machine — so defaults are sized for that: sequential review specialists, one validate at a time per surface, generous per-run wall-clock caps. The shipped guide lists per-phase memory/time budgets so a small laptop knows what it can carry.
- **Single-laptop daemon:** machine off = loop paused. That's a feature (no surprise agent activity); `aidlc reconcile` covers the resume.
- **GitHub remains in the loop** (PRs, PAT; runners only in Actions modes). "Fully local" means *model traffic and orchestration* are local; the code remote is your choice — a Gitea/Forgejo variant of the GitHub section is a documented swap, not a redesign (the daemon's GitHub source is one adapter). **CI mode is a choice, and all three are viable**: Actions on GitHub runners (independent machine — strongest evidence), Actions on a self-hosted runner (same semantics, your machine — but the agent can touch the runner, so the daemon re-runs the suite itself as backstop), or hooks-only (air-gapped; the daemon's re-run **is** the evidence). The invariants (§2.3, §2.7) bind the *verification behavior*, not which product runs the checks. The strength order is honest, and the guide says so: cloud runner > self-hosted runner > hooks-only — a drift-prone laptop env is the weakest evidence (fine for air-gapped/low-stakes, not for anything you'd want a second opinion on).

---

## 12. Decisions log

| Decision | Rationale |
|---|---|
| Specs/reports/scorecards in **Linear Documents**, never in-repo | Owner directive; inherits the proven LINEAR-AIDLC-PROJECT artifact model |
| **Check evidence = pluggable per repo**: Actions (cloud runner, self-hosted runner) or hooks + daemon re-run; hooks always the fast inner loop | Owner: Actions is *one* viable option, not the one. The daemon's contract — query the configured source, re-run itself where that source shares a trust domain with the agent, tamper flag, base-branch definitions — makes all three viable; a GitHub-hosted runner is the strongest evidence, not a requirement |
| **CI definitions are not agent-editable** (tamper flag + base-branch checks) | The invariant, one level down: an agent must not redefine the checks that gate it |
| One **bot identity**; agent via MCP tool-restricted; daemon via direct API | Makes self-approval detectable (actor) without depending on Linear key granularity |
| Gates = **human-actor** state moves (UI) | The invariant, mechanized |
| **Post-merge** Validate; "staging" = local app at merged main | No deployment target exists locally |
| **Learn auto** after scorecard ≥ threshold (flag to manual; **held while any evidence row is human-pending** — §2.4) | Owner preference for the robot to do it |
| **ADRs stay in-repo** | Existing Linear path; code-adjacent records — owner confirmed 2026-11-09 |
| **No OpenCode plugin package** | Config + skills + commands suffice; Claude/Cursor marketplaces stay the plugin vehicle |
| Library `skills/` **unchanged** | Vendor-neutral markdown; OpenCode discovers via compatibility roots; consumer overrides carry local deltas |
| **Review runs against the PR** with six specialist **subagents** (parallel, read-only, tiered models) | PR is the review object; narrow contexts suit smaller local models; reviewers must never edit |
| **Robot lanes** — every run in a daemon worktree pinned to the dispatch SHA (PR head for Review, merge SHA for Ship) | Isolation from the human checkout; per-Feature parallelism; the app boots from the lane |
| **Claim = delegate-CAS only** (no state move on dispatch) | Owner confirmed 2026-11-09 — resolves SELF-HOSTED-AIDLC's "claim: set delegate, move state" ambiguity: state moves are the human gates + the §4 machine moves |
| **Inherits SELF-HOSTED-AIDLC.md's polling/claim/park machinery** (two cadences, persisted cursor, CAS claim, `needs-a-human` park); deltas: no-egress model slots, **worktree-not-container** (the validation surface is the host toolchain), claim = delegate-only | That doc is a working deployment — inherit what's proven; change only what the local path requires |
| **Validation target = surface abstraction** (`web`/docker, `macos-app`/Xcode+simulator, `cli`) declared in `AGENTS.md` | SaaS stacks and local apps are equally first-class; the evidence contract is surface-agnostic |
| **Two-level flow made explicit** — slices run the build loop (Done-machine + next release); the umbrella gates + feature-level validate/learn | Inherited from LINEAR-AIDLC-PROJECT ("a slice's state is its build trigger"); the plan had collapsed the two levels — stated so `transitions.json` keys on (issue kind, state, event) |
| **Breaker counts bounces per slice, not slice-chain releases** | A 5-slice Feature is a normal day, not a breaker trip |
| **Agent key = content-scoped where Linear allows; separate keys per principal; full key never in the agent process** | Restores "never possible" for agent self-approval (owner hard requirement); separate agent key = a kill switch; the fence stays for the daemon tier |
| **GitHub bot account + branch protection (required human review + required checks)** | One named machine identity per platform, mirroring the Linear bot seat → self-merge structurally impossible, not prompt-denied |
| **Review fan-out: concurrency configurable, default sequential on one machine** | Six 27B-class instances don't fit in a laptop; the narrow context is the quality lever, parallelism a wall-clock luxury |
| **Conversation resume: a human comment on an ended run re-dispatches the phase (the Document is the state)** | Conversation-first specs work across runs, not just inside one |
| **Slices live in the Tech Spec until the gate; no agent can write issues** (`aidlc-slices` block → created by `aidlc-slices.sh` / the daemon after Design→Build+Test) | Owner, 2026-11-09: Design→Build+Test is the gate seen self-approved most. Linear's `save_issue` both creates and moves issues, so any agent allowed to create slices can advance itself; removing the tool removes the path, and slices are inert by construction |
