# AIDLC fully local: OpenCode + self-hosted models + the local daemon

**Using Cursor or cloud agents?** Stop here: [LINEAR-AIDLC-PROJECT.md](LINEAR-AIDLC-PROJECT.md) and [GITHUB-AIDLC-QUEUE.md](GITHUB-AIDLC-QUEUE.md) cover you. This guide is for running the whole lifecycle **locally**: OpenCode as the harness, models on your own hardware, a small daemon on your machine as the orchestrator, Linear as the board, and GitHub for PRs.

"Locally" means **model traffic and orchestration**. Your code still lives on GitHub, and which machine runs your checks is a per-repo choice (see [Check evidence](#check-evidence)).

The design and its reasoning are in [feature/opencode-local/plan.md](../feature/opencode-local/plan.md). The templates are in [templates/aidlc-local/](templates/aidlc-local/), and the daemon is in [templates/aidlc-local/daemon/](templates/aidlc-local/daemon/).

## The one rule everything serves

**An agent must never be able to satisfy its own gate.** In a working Linear/Cursor deployment, an agent whose key could edit tickets could also move them, and it eventually advanced its own gate. The fix is structural, not a better prompt:

| Principal | Linear | GitHub | Can open a gate? |
|---|---|---|---|
| **Agent** (`opencode run`) | the **AIDLC Agent** app user, through the Linear MCP, with a token the daemon mints for that one run and revokes when it ends. **Read + comments only**: it cannot move state and cannot write Documents — it writes the Documents it produces as files in the lane, and the daemon publishes them | bot account PAT: push and PR comments. `gh pr merge` is denied, and branch protection requires a human review | **No** — structurally |
| **Daemon** | the **AIDLC Daemon** app user (OAuth client credentials): the delegate, and the only identity that moves state. It makes only machine moves, never a gate | read-only token: PR state, merge SHA, checks | **No**, only machine moves |
| **You** | full access, in the Linear UI | you merge | **Yes**: every gate is a state move you make |

How the daemon enforces it:

1. **Linear itself refuses the agent's moves** (Decision B, 2026-11-09). Linear has no scope that can write Documents without also moving issues, so the agent app is **read + comments only**: a state move or a Document write made by an agent run is refused at the API, and there is nothing left for the daemon to undo. The rule above now holds literally — an agent run cannot approve its own gate. The **actor check** remains as the backstop for the credentials that do carry `write` (a leaked daemon credential, a legacy personal-key setup, integrations): any such move is **reverted within one poll and flagged**, and the issue is paused until you run `aidlc gate confirm`.
2. **Temporal fence** (tier 2 in the plan). A move observed while a run covering that issue is still alive stops the run and is reverted. If you made it, `aidlc gate confirm ISSUE` re-applies it as your gate. Moves observed after the run has exited are accepted, and approving right after a run ends is the normal case. Keep `gates.fence: true`: a move of any kind while a run is live must stop that run — and in a legacy personal-key setup the agent's key is full-access, so the fence and the actor check are its only stops.
3. **Ceiling rule, in code.** The daemon cannot move a Feature into Plan, Design, Build+Test or Done, whatever `transitions.json` says. A machine event (even a faked scorecard) can at most present a gate to you.
4. **Slices are born inert.** Design writes the slice plan as an `aidlc-slices` block in the Tech Spec. The sub-issues are created **by the daemon after your Design→Build+Test move**, so nothing can build before the gate. A sub-issue that carries a slice marker the daemon did not create is ignored and flagged.
5. **Checks cannot be redefined by the code under test.** If a PR touches `.github/workflows/**` or hook configs, the daemon flags it and Review gets a blocking DevOps finding. In the re-run modes, the daemon runs the suite with the **base branch's** check definitions.

### Same OS user vs a separate OS user

By default, agent runs execute **as you**. Their environment is built from an allowlist and never contains the daemon key, but their shell can still read any file you can read, including `~/.config/aidlc/daemon.env`. In that setup, a determined agent could find the key. If it then used the key, the actor check would still catch the move (it is a bot move the daemon never made) and revert it. That is detection, not prevention.

For a hard boundary, run agents as a **separate OS user** (`runner.runAs` in the daemon config). The daemon calls `sudo -n -u <user> --preserve-env=<names> -- opencode run …`, so the agent user cannot read your key file, the daemon's state, or the daemon's code. You need to set this up once:

- Create a user, e.g. `aidlc-agent`, and give it group write on the lanes directory and the repo's `.git`. Each lane is a worktree of your checkout.
- Add a sudoers rule like this (adjust the binary paths): `you ALL=(aidlc-agent) NOPASSWD:SETENV: /opt/homebrew/bin/opencode, /bin/sh`
- Give that user its own `gh` auth for the bot PAT, or pass `GH_TOKEN` through `agent.env`.

`aidlc doctor` warns while `runAs` is empty. The `runAs` path is **not yet verified** on a real machine (see [Not yet verified](#not-yet-verified)).

## Linear apps

Linear only accepts an **app user** as an issue's delegate. A regular member seat is refused ("delegateId must correspond to an app user", verified in a real workspace). The daemon's claim is the delegate, so the daemon must be an OAuth app. The agent gets its own app, so that its moves show up in history as the agent's.

Create both as a workspace admin, under **Linear → Settings → API → OAuth applications**:

| | **AIDLC Daemon** | **AIDLC Agent** |
|---|---|---|
| Purpose | the delegate (claim); the only identity that moves state and writes Documents | what agent runs act as: **read + comments only** — it cannot move state or write Documents |
| Settings | enable **Client credentials**; developer URL and callback can be placeholders | enable **Client credentials** |
| Scopes the daemon requests | `read,write,issues:create,comments:create,app:assignable` (`linear.daemonScopes`) | `read,comments:create` (`linear.agentScopes`) |
| Where its secret goes | `daemon.env`: `AIDLC_LINEAR_DAEMON_CLIENT_ID`, `_SECRET` | also `daemon.env`: `AIDLC_LINEAR_AGENT_CLIENT_ID`, `_SECRET` |

Both secrets live only with the daemon. For each run, the daemon mints a token for the agent app (client-credentials tokens are valid for 30 days). It passes that token to the run as `AIDLC_LINEAR_AGENT_KEY`, which the Linear MCP sends as `Bearer`, and **revokes it when the run ends**. A token an agent leaks is dead after that run. Client-credentials tokens can reach every public team in the workspace.

**The Documents travel with the daemon, not the agent.** Because no Linear scope can write Documents without also moving issues, the agent app is not given one: the run writes the Documents it produces as markdown files in the lane (`.aidlc/docs/` — `product-spec.md`, `tech-spec.md`, `validate-scorecard.md`), and after the run ends the daemon publishes them to the issue: created if new, updated in place if the content changed. If you edited a Document in the UI while the run was live, the daemon does **not** overwrite your edit — it keeps yours, attaches the run's copy to the issue, and asks you to merge and comment.

## What you do

You get **three state gates per Feature, plus a merge-or-bounce on each slice PR**. The bot `@mentions` you in Linear when it needs you.

| When you're poked | You do (one action) |
|---|---|
| Plan draft ready | read the Product Spec Document → move **Plan → Design**, or comment to revise (the daemon re-runs Plan with your comment) |
| Design ready | read the Tech Spec + slice plan → move **Design → Build+Test**. This is the gate that starts building |
| Review comments on a PR | **merge** it (that is the Review gate), or **bounce** the slice to Build+Test (the breaker counts bounces) |
| Scorecard + Learn filed | move **Ship → Done** |
| `AIDLC question` | answer in the thread; the parked run resumes in the same session |
| A daemon flag | read it; usually `aidlc gate confirm ISSUE`, or a fix-or-cancel call when the breaker trips |

## What the daemon does

States and artifacts are the ones in [LINEAR-AIDLC-PROJECT.md](LINEAR-AIDLC-PROJECT.md). The daemon runs them at **two levels**, keyed in `transitions.json` on (issue kind, state, event):

| Kind | State entered | Trigger | Daemon |
|---|---|---|---|
| Feature | Plan / Design | your move | dispatches `/plan` / `/design` in a lane at the base branch head |
| Feature | Build+Test | **your move** | creates the slices from the Tech Spec (backlog state, `blocks` chain, idempotent) and releases the first one. The umbrella then waits and never builds. A plan with no slices (`"slices": []`) makes the Feature a **unit** that runs the slice loop itself. An issue with **no Product Spec and no Tech Spec** (a bug, a fit-and-finish fix) becomes a **reactive** item: it builds as one piece and ends at Done after In Staging, never Ship |
| Slice / unit / reactive | Build+Test | release, or your move or bounce | dispatches `/build` on the slice branch. A fresh build branches from the base head; a bounce reuses the existing branch with the review findings in the prompt |
| Slice / unit / reactive | Review | PR opened and ready | verifies checks at the PR head, moves the state, then dispatches `/review` at the PR head (six read-only specialist subagents) |
| Slice / reactive | In Staging | **your merge** | verifies checks at the merge SHA, then dispatches `/ship` on the deployed copy at that SHA with the slice prompt: the issue's own acceptance criteria as numbered checks, browser checks with screenshots, observability, in Validate mode (`validate-deployed`'s contract). Every check passes → Done; a failed check flags the failure with Build+Test proposed; a human-pending row waits for you to move the issue. To validate by script instead (no LLM), swap the dispatch for `validateSlice` in `transitions.json` |
| Slice | Done | validation green | releases the next unblocked sibling, one slice in flight at a time |
| Reactive | Done | validation green, or your move | cleans up: lanes removed, claims cleared |
| Feature | In Staging | last slice Done (a unit: your merge) | verifies checks at merged main, then dispatches `/ship` pinned to merged main (a unit validates at its merge SHA) |
| Feature | Ship | scorecard ≥ threshold | auto-launches `/learn`. Learn is **held** while any evidence row is human-pending; your comment confirms those rows and starts Learn |
| Feature | Done | **your move** | cleans up: lanes removed, claims cleared |

Every run follows the same steps:

1. **Claim:** a compare-and-set on the delegate. It moves no state.
2. **Robot lane:** a git worktree pinned to a SHA, or the slice branch.
3. **Run:** `opencode run --standalone --agent aidlc-runner --model local/<tier> --session ses_aidlc-… "<phase prompt>"`, with a per-phase wall-clock cap.
4. **Evidence:** files in `.aidlc/evidence/` are uploaded to Linear.
5. **Documents:** files in `.aidlc/docs/` are published as the issue's Documents (created, or updated in place; a Document you edited in the UI meanwhile is left as-is, with the run's copy attached).
6. **Teardown:** the lane is removed.
7. **Release:** the delegate is cleared.

A hung run is killed at the cap and retried with backoff (default 2 retries, 5 minutes). If it still fails, it is handed to you.

**Park and resume.** If a run needs to ask, it posts one comment whose first line is `**AIDLC question**` and then stops. The daemon adds `needs-a-human` and keeps the lane and the OpenCode session. Your reply resumes **the same session** within 30s. If you move the issue instead, the label clears and the parked lane is removed.

**Resume after a run has ended.** In Plan, Design, In Staging and Ship, a human comment that arrives after a run has ended re-dispatches that phase. The Document is the state, and the fresh run reads it along with your comment. Comments are deduplicated by comment ID, and bot comments never trigger a resume.

**Bounce breaker.** The daemon counts failure re-entries into Build+Test **per slice**, from Linear's own history. Releasing the next slice in the chain is not a bounce. On the Nth bounce (default 5), the daemon builds nothing, posts a breaker comment, reassigns the slice to the lead (`owner.leadUserId`) and stops the chain. `aidlc breaker reset ISSUE` re-arms it.

## Setup

Complete steps 1–3 first; together they are the P1 setup.

1. **Linear.** Set up the team states, bot seat and Documents as in [LINEAR-AIDLC-PROJECT.md](LINEAR-AIDLC-PROJECT.md), then:
   - Create the two OAuth apps in [Linear apps](#linear-apps). A member seat with personal API keys does not work, because Linear refuses a member as delegate.
   - Create the label **`needs-a-human`**, and **`no-robots`** for issues a person owns (the daemon stands off them; `labels.handsOff`).
   - If the team's first backlog-type state is **Triage**, set `states.backlog` to the state slices should wait in (e.g. `Parked`). Otherwise the daemon refuses to start.
   - **Turn off Linear's GitHub PR → state automation for this team.** The daemon makes those moves itself after verifying them, and it reverts integration moves.
   - Use **one control plane per Linear team.** Never point a cloud-path bot and this daemon at the same team.
2. **GitHub.** Create a dedicated **bot account**. Protect the integration branch with **required human review** and, in Actions modes, **required checks**. Give the agent the bot's push PAT (`GH_TOKEN`) and give the daemon a read-only token (`AIDLC_GH_READ_TOKEN`).
3. **Consumer repo + OpenCode.** Lay out the templates as in [CONSUMER-SETUP.md → OpenCode local transport](CONSUMER-SETUP.md#opencode-local-transport). Then run `aidlc-doctor.sh --e2e` in the agent shell. It checks the endpoint, the models, a tool-call smoke test, the no-egress policies, and that no agent can call `save_issue`.
4. **Install the daemon.** It needs Node.js ≥ 20 and has no npm dependencies. Copy or keep `templates/aidlc-local/daemon/` somewhere **outside** the consumer checkout, so an agent's PR cannot change the daemon's code.

   ```bash
   cp -R .claude/deps/ai-dlc/docs/templates/aidlc-local/daemon ~/.local/share/aidlc-daemon
   ```

   ```bash
   ~/.local/share/aidlc-daemon/bin/aidlc init --repo "$PWD" --nwo owner/repo --team ENG
   ```

   `init` creates `~/.config/aidlc/<owner>/<repo>/` (mode 0700) containing `config.jsonc` and `transitions.json`. It also creates `~/.config/aidlc/daemon.env` and `agent.env` (mode 0600).
5. **Secrets.**
   - Fill `daemon.env` with both apps' client IDs and secrets and the read token. On macOS, prefer the keychain for secrets: `AIDLC_LINEAR_DAEMON_CLIENT_SECRET_CMD=security find-generic-password -s aidlc-daemon-secret -w`.
   - Fill `agent.env` with `AIDLC_LLM_BASE_URL` and `GH_TOKEN` only. The daemon mints the agent's Linear token itself.
   - The daemon refuses to start if a daemon secret appears in `agent.env`, if both apps are the same app, or if either file is readable by other users.
6. **Configure** `config.jsonc`: state names, `owner.mention`, `owner.leadUserId`, `github.botLogin`, `ci.mode` (below), `surface.type`, `models`, `caps`, and, ideally, `runner.runAs`.
7. **Check:** `aidlc doctor`.
8. **Run it.** Start with `aidlc daemon` in a terminal, or install the platform unit in [`daemon/units/`](templates/aidlc-local/daemon/units/): a launchd LaunchAgent on macOS, a systemd user unit on Linux, or a cron one-shot (`--once`). The units carry no secrets; the daemon reads its own env file.

**Manual kick (optional).** Set `kick.bind` to a **private** address, such as your mesh-VPN IP or `127.0.0.1`, plus `AIDLC_KICK_TOKEN` in `daemon.env`. A phone shortcut can then `POST http://<bind>:8787/kick` with `Authorization: Bearer <token>`. The daemon refuses to start on `0.0.0.0` or a public address. `aidlc kick` does the same thing from a shell.

## Check evidence

`ci.mode` is a per-repo choice. In every mode the daemon checks the evidence at the PR head before Review and at the merge SHA (or merged main) before validating. The modes, strongest first:

| `ci.mode` | Evidence | Notes |
|---|---|---|
| `actions-cloud` | GitHub check runs at the SHA (`ci.requiredChecks`, or every reported check) | Runs on an independent machine: the strongest evidence. Set required checks on the branch so even a human cannot merge red |
| `actions-self-hosted` | check runs **and** a local re-run of `ci.command` | The runner shares a machine with the agent, so the daemon re-runs the suite itself as a backstop |
| `hooks-only` | the daemon's local re-run of `ci.command` **is** the evidence | Fine for air-gapped or low-stakes repos. Hooks can be skipped with `--no-verify`, which is why the daemon re-runs them |

The re-run happens in a throwaway lane at the SHA, with no secrets in its environment. When `ci.useBaseDefinitions` is on (the default), the daemon first restores the base branch's copies of `ci.definitionPaths`, so an agent that rewrote `check.sh` to `exit 0` still gets judged by the original. Pre-commit hooks stay the fast inner loop in every mode; install them with `pre-commit install`.

## Operations

| Command | What it does |
|---|---|
| `aidlc status [ISSUE]` | Each issue's kind, state, run, park or pause status, last checks, and (for one issue) its recent events plus the run log path |
| `aidlc tail [-f] [ISSUE]` | Follow the event log |
| `aidlc gate confirm ISSUE` | Clear a fence or revert pause. A fenced **human** move is re-applied as a confirmed gate; a bot or integration move is never re-applied |
| `aidlc pause [--stop-runs]` / `aidlc resume` | Kill switch: no new dispatches or machine moves while paused (deferred work waits, it is not lost). Reverting unauthorized moves keeps running |
| `aidlc reconcile [--since ISO]` | After the machine was off: clear stale claims (bot delegates with no live run), stale run records and orphan lanes, then re-scan every issue in an AIDLC state. Every event has an ID, so nothing already handled runs twice |
| `aidlc breaker reset ISSUE` | Re-arm a tripped breaker and restart the chain |
| `aidlc slices FEATURE [--dry-run] [--adopt]` | The human-run slice creator (P1's `aidlc-slices.sh`, made daemon-aware). `--adopt` takes over backlog slices that `aidlc-slices.sh` created |
| `aidlc doctor` | Checks the config, the transitions, the key split, Linear, git, OpenCode and isolation |

Local state lives in `~/.config/aidlc/<owner>/<repo>/`. It is operational data only, never spec content:

- `state.json`: the cursor, per-issue records, the daemon's own move log, and per-SHA check results
- `events.log`
- `runs/<ISSUE>/<run>.log`
- `evidence/`
- `docs/`: audit copies of the Documents the daemon published, per run (the Document in Linear is the state; this is the record)
- `PAUSE`

If the machine is off or you are logged out, the loop is paused, by design. When the daemon starts again it recovers from crashes automatically: stale runs, delegates and lanes. After a long gap, run `aidlc reconcile`.

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| Every machine move is flagged as an "integration" move | Linear's GitHub automation is still on for the team. Turn it off |
| Flag: "Linear refused the claim … delegateId must correspond to an app user" | The daemon is using a member seat's API key. Set up the [Linear apps](#linear-apps) |
| Flag: "app is not assignable", or the claim is refused on an app | The daemon app's token lacks `app:assignable`. Check `linear.daemonScopes` and the app settings |
| Gate moved, nothing dispatched | The issue is paused (`aidlc status`), the `PAUSE` file exists, the runner is at capacity, or someone else holds the delegate (a claim is never overwritten) |
| "Temporal fence" on a move you made | You moved it while a run was live. Run `aidlc gate confirm ISSUE` |
| Run `failed` at once, log shows `Expected a string starting with "ses"` | The session ID format: OpenCode v2.2.5 requires `ses…` IDs. The daemon generates them; check any custom `runner.args` |
| Runs time out | The model is too slow for the cap. Raise `caps.<phase>`, or use a smaller workhorse for `build` |
| Review starts before CI finishes | It doesn't: Review waits for completed checks (up to `ci.pendingTimeout`, then red) |
| Run ended but a Document shows "not published (a human edit was protected)" | You edited that Document in the UI while the run was live. The daemon attached the run's copy to the issue; merge it into the Document, then comment to continue |
| Slices not created | No Tech Spec Document, or zero or several `aidlc-slices` blocks, or the block is invalid. The flag quotes the exact error; `aidlc slices FEATURE --dry-run` lints it |
| A sub-issue is ignored | It carries a slice marker the daemon did not create. If you made it with `aidlc-slices.sh`, run `aidlc slices FEATURE --adopt` |

## Conformance checklist

- [ ] The Linear team has the 9 states and the `needs-a-human` label; its GitHub state automation is off
- [ ] Two OAuth apps exist (**AIDLC Daemon**, **AIDLC Agent**) with client credentials enabled, the agent app is **read + comments only**, and their secrets exist only in `daemon.env` or the keychain
- [ ] There is a GitHub bot account; the protected branch requires a **human review** (and checks, in Actions modes)
- [ ] `ci.mode` is declared in the daemon config and noted in `AGENTS.md`; hooks are installed
- [ ] OpenCode + the local runtime pass `aidlc-doctor.sh --e2e`; the policies deny cloud providers
- [ ] The daemon's code and config are outside the consumer checkout; `aidlc doctor` shows no FAIL
- [ ] `runner.runAs` is set, or you accept the [same-user](#same-os-user-vs-a-separate-os-user) caveat
- [ ] There is **one control plane per Linear team**

## Honest limits

- **Model quality is the real risk.** A 27B-class model is plausible for Build and risky for Plan or Review. The per-phase "minimum model bar" table is filled in by the P3 dogfood run.
- **UI evidence needs a vision-capable model.** Without one, screenshots are still captured and attached, those rows read "human-verified", and auto-Learn waits for you.
- **One laptop does everything.** Defaults are sized for that: one run at a time, sequential reviewers, generous caps.
- **The daemon is trusted code.** It is audited by its own event log, but a compromised daemon key is the threat the signed-gate tier (an HMAC key you hold) addresses. That tier is not built yet.

### Not yet verified

**Verified in a real workspace (2026-11-09)** with `daemon/test/live-linear.mjs`:

- A move made with an API key records `actor` = the key's user, with no `botActor`.
- A GitHub-integration move records no actor and `botActor` = integration/GitHub. The daemon reverts it, so turn that automation off.
- A member seat is refused as delegate.
- History comes back newest-first; the daemon sorts it.
- A comment does **not** bump the issue's `updatedAt`, so the daemon's separate comment query is needed.
- `commentUpdate` edits in place.
- Documents:
  - a content-only edit keeps the same ID and does **not** change `Document.updatedAt`, so the daemon judges "scorecard filed" by comparing content hashes against a snapshot taken at dispatch;
  - `documentCreate` (with `issueId`) and `documentUpdate` work on a client-credentials token with `write`, and an update is in place — same ID;
  - a fenced `aidlc-slices` block keeps its exact bytes through a read, while Linear rewrites Markdown outside fences;
  - the `aidlc-slice:` marker survives Linear's description rewriting.
- `fileUpload` + PUT works, and the asset needs a logged-in viewer.
- The `gh` adapter parsed a real open PR, a merged PR (merge SHA, `mergedBy`) and check runs.

**Still to verify** (the probe covers the app items once the apps exist):

- That the AIDLC Daemon app accepts being the delegate with `app:assignable` on a client-credentials token.
- Decision B: that the agent token (read + comments) is refused on state moves and `documentCreate`, while the daemon token publishes Documents.
- How app-user moves are attributed (an app user as `actor`, or `botActor` only). The daemon handles both.
- That a revoked agent token is rejected right away.
- Whether `@name` in a comment body notifies (`owner.mention`).
- Rate limits at the two cadences, and history beyond 100 entries.
- The `runAs` sudo path, and the launchd and systemd units as installed.

The GraphQL operations themselves **are** validated against Linear's published schema (`daemon/test/check-schema.mjs`). The OpenCode flags and session resume **were** verified against real OpenCode v2.2.5 with a local model (`daemon/test/real-opencode.mjs`).

## Links

- [feature/opencode-local/plan.md](../feature/opencode-local/plan.md): the design, invariants, and verification items
- [templates/aidlc-local/](templates/aidlc-local/): the OpenCode config, phase overrides, review subagents, `aidlc-doctor.sh`, `aidlc-slices.sh`, and `daemon/`
- [SELF-HOSTED-AIDLC.md](SELF-HOSTED-AIDLC.md): the polling, claim and park machinery this daemon inherits
- [LINEAR-AIDLC-PROJECT.md](LINEAR-AIDLC-PROJECT.md): states, Documents, inert slices
- [ASK-AND-HALT.md](ASK-AND-HALT.md): questions on the ticket, then halt
