# GitHub Issues + Projects (v2) for AIDLC

This guide is for teams that want a **GitHub Project** board whose **Status** field tracks AIDLC phases, plus **labels** that express whether automated or scheduled **Claude Code** runs should pick up an issue. It complements [INSTALL.md](INSTALL.md) and assumes each consumer repo vendors [AIDLC.md](https://github.com/queen-of-code/external-brain/blob/main/AIDLC.md) (or your fork) at `docs/AIDLC.md`.

**Scope:** [GitHub Projects (new) / v2](https://docs.github.com/en/issues/planning-and-tracking-with-projects) — a **Status** field on project items. **Classic** Project boards use different APIs; treat label reset and queries as **manual or custom** until you port them.

---

## Concepts

| Mechanism | Role |
|-----------|------|
| **Project Status** | Single source of truth for **which AIDLC phase** the work is in (column). |
| **Labels `aidlc_work:*`** | Whether the **current phase** still needs an agent run: `unstarted` = eligible for cron; `in_progress` = a run is active or finishing; do not start another. |
| **GitHub Actions** | Recommended for **resetting** `aidlc_work:*` to `unstarted` when Status **changes** (not Mac cron — cron cannot subscribe to board moves). |
| **Mac `launchd`** | Poll GitHub periodically; find **Status = X** and **aidlc_work:unstarted**; invoke **Claude Code** with the right slash command for that phase. |

**Why two layers:** Moving a card between columns does not run on your laptop. **Actions** react in the cloud. **launchd** only **scans** and **starts Claude** when you want unattended kicks.

---

## Status values (Project field)

Create one **Status** field (single select) with these options **in order**. Names are suggestions — keep them stable for automation.

| Status | Meaning | Slash command when `aidlc_work:unstarted` | Cron? |
|--------|---------|-----------------------------------------------|--------|
| **Idea** | Backlog / intake. Not in AIDLC yet. | — | **No** |
| **Plan** | Plan phase — Product Spec (`/plan` orchestrator, Product Spec part). | `/plan` | Yes |
| **Design** | Design phase — Tech Spec (`/plan` orchestrator, Tech Spec + reviews). | `/plan` | Yes |
| **Build** | Build + Test (TDD); exit = open PR + green CI per AIDLC. | `/build` | Yes |
| **Review** | Review gate. | `/review` | Yes |
| **Ship** | Validate + Learn. | `/ship` | Yes |
| **Done** | Shipped / accepted. | — | **No** |
| **Won't do** | Closed without delivery. | — | **No** |

- **Build** and **Test** are **one** stage on the board (no separate Test column).
- **Ship** maps to **Validate + Learn** in AIDLC (`/ship` orchestrator).
- **Idea**, **Done**, and **Won't do** must be **excluded** from cron queries (and typically have no `aidlc_work:*` automation).

---

## Labels

Create these **repository** labels (prefix avoids collisions):

| Label | Meaning |
|-------|---------|
| `aidlc_work:unstarted` | Ready for the next **automated** Claude run for the **current** Status. |
| `aidlc_work:in_progress` | A run has started; cron should **skip** this issue until finished or reset. |

**Optional:** `aidlc_work:done` for “phase output satisfied” — not required if **Status** alone advances; most teams use Status moves only.

### Rule when Status changes

When an issue’s **Project Status** changes to a **non-terminal** value (anything except **Done** and **Won't do**), set its **`aidlc_work:*`** label to **`aidlc_work:unstarted`**, replacing `in_progress` or any prior value. **Done** and **Won't do** do not get auto-reset (and cron does not target them).

Implement this with **[GitHub Actions](https://docs.github.com/en/actions)** (see [`.github/workflows/aidlc-project-label-sync.yml`](../.github/workflows/aidlc-project-label-sync.yml)) or run the [manual reset workflow](#manual-workflow-dispatch) after moves if Actions are not enabled.

---

## Issue body convention

Each Feature issue should include:

```markdown
AIDLC feature folder: `feature/<kebab-slug>/`
Parent issue: #NNN (if sub-issue)
```

Match `<kebab-slug>` to the directory your agents use locally.

---

## GitHub setup (checklist)

1. **Enable Projects** on the org/repo; create a **Project (v2)** linked to the repository.
2. Add the **Status** field with the values in the table above.
3. Create labels `aidlc_work:unstarted` and `aidlc_work:in_progress`.
4. Add new work as **draft issues** or issues, set **Idea** or **Plan**, and add **`aidlc_work:unstarted`** when you want automation to pick it up.
5. Copy [`.github/workflows/aidlc-project-label-sync.yml`](../.github/workflows/aidlc-project-label-sync.yml) into **your app repo** (not necessarily AI-DLC) and configure secrets — see workflow comments.
6. Configure **Mac** `launchd` using [scripts/launchd/com.aidlc.cron.example.plist](../scripts/launchd/com.aidlc.cron.example.plist) and [scripts/aidlc-cron.sh](../scripts/aidlc-cron.sh).

### Finding IDs for GraphQL (placeholders)

Automation and scripts use:

- `OWNER` — org or user login
- `REPO` — repository name
- `PROJECT_NUMBER` — project number from the URL (`https://github.com/orgs/ORG/projects/NUMBER`)
- Project **node ID** and **Status field ID** — from **GitHub CLI**:  
  `gh api graphql -f query='query { organization(login: "OWNER") { projectV2(number: N) { id title } } }'`  
  (adjust for `user()` if user project)

Document copied IDs in a **private** ops doc or GitHub **Environment** secrets — do not commit secrets.

---

## Automation A: label reset (GitHub Actions)

**File:** [.github/workflows/aidlc-project-label-sync.yml](../.github/workflows/aidlc-project-label-sync.yml)

- **`workflow_dispatch`** — manual run; optional inputs for testing.
- **`projects_v2_item` / `edited`** — when your org/repo supports it, syncs labels on Status change. **Permissions** and event availability vary; validate in a test repo.

`GITHUB_TOKEN` in Actions can be insufficient for **organization** projects — you may need a **PAT** stored as `AIDLC_PROJECT_PAT` with `project`, `issues: write`.

---

## Automation B: Mac `launchd` + Claude Code

Use **`launchd`** instead of `crontab` on macOS for reliable environment and logging.

### Prerequisites

- [`gh`](https://cli.github.com/) authenticated (`gh auth login`).
- **Fine-grained PAT** (or classic) with `repo`, `read:project`, `write:issues` (and project scope if org project) — store in **Keychain** or a file **outside git**, e.g. `~/.config/aidlc/github.env`:

  ```bash
  export GH_TOKEN=ghp_...
  export AIDLC_REPO=OWNER/REPO
  export AIDLC_PROJECT_NUMBER=1
  ```

- **Claude Code** CLI on `PATH` (`claude`).

### Wrapper script

[scripts/aidlc-cron.sh](../scripts/aidlc-cron.sh) — template that:

1. Sources env.
2. Queries issues/cards in a given **Status** with **`aidlc_work:unstarted`** (extend the `gh`/`graphql` section for your project).
3. Optionally sets `aidlc_work:in_progress` before invoking Claude.
4. Runs non-interactive Claude with a prompt from [scripts/prompts/aidlc-phase-issue.md](../scripts/prompts/aidlc-phase-issue.md).

**Security:** Never put tokens in the plist or crontab. Load `EnvironmentVariables` from a file that is **chmod 600** or use `launchctl setenv` in a login hook.

### Example `launchd` plist

See [scripts/launchd/com.aidlc.cron.example.plist](../scripts/launchd/com.aidlc.cron.example.plist). Install:

```bash
cp scripts/launchd/com.aidlc.cron.example.plist ~/Library/LaunchAgents/com.aidlc.cron.plist
# Edit ProgramArguments and paths; then:
launchctl load ~/Library/LaunchAgents/com.aidlc.cron.plist
```

Use **`StartInterval`** (seconds) or **`StartCalendarInterval`** for schedule.

### Claude invocation (pattern)

Exact flags depend on your **Claude Code** version. Typical pattern:

```bash
cd /path/to/your/repo
claude --print --dangerously-skip-permissions \
  "Read issue #$ISSUE in $AIDLC_REPO. Run the phase for current Project Status: follow /plan, /build, /review, or /ship from AI-DLC skills per docs/AIDLC.md. Then update labels per team rules."
```

Prefer a **small prompt file** per phase; see [scripts/prompts/aidlc-phase-issue.md](../scripts/prompts/aidlc-phase-issue.md). Use **`--print`** or headless flags per current [Claude Code CLI docs](https://code.claude.com/docs).

### Idempotency

- Set **`aidlc_work:in_progress`** immediately before a run (or use a lock file under `~/.cache/aidlc/`).
- If Claude fails, reset to **`aidlc_work:unstarted`** or leave `in_progress` with an alert — document team policy.

---

## Manual workflow dispatch

If Actions sync is not wired, after moving a card call:

```bash
gh workflow run aidlc-project-label-sync.yml -f issue_number=123 -f reset_to_unstarted=true
```

(Requires the workflow file in the repo — see template.)

---

## Classic Project boards

If you use **classic** boards only: keep the **same Status names** as section headers or labels (`aidlc-status:plan`, …) and perform label resets **manually** or with a **scheduled** `gh` script that cannot detect drags in real time.

---

## Links

- Tutorial (manual queue): [alexa-recipe-app `docs/github-queue.md`](https://github.com/queen-of-code/alexa-recipe-app/blob/main/docs/github-queue.md) — optional automation points here.
- Work tracking skill: [skills/work-tracking/SKILL.md](../skills/work-tracking/SKILL.md)
