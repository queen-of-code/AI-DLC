# GitHub Issues + Projects (classic) for AIDLC

**Not using GitHub for issue tracking?** See **[ISSUE-TRACKER-PORTABILITY.md](ISSUE-TRACKER-PORTABILITY.md)** and declare your system in the app repo’s **`AGENTS.md`**. This file is the **GitHub-specific** transport path; phase skills (`/plan`, `/design`, …) read **`AGENTS.md`** when present.

This guide is for teams that use a **GitHub Project (classic)** board: **columns** map to AIDLC phases, and **labels** `aidlc_work:*` say whether a **Claude Code** (or other) run should pick up the issue. It complements [INSTALL.md](INSTALL.md) and assumes each consumer repo vendors [AIDLC.md](https://github.com/queen-of-code/external-brain/blob/main/AIDLC.md) (or your fork) at `docs/AIDLC.md`.

**Why not Projects (new) / “v2”?**  
[GitHub Actions `project_card` events only fire for **projects (classic)**](https://docs.github.com/en/actions/using-workflows/events-that-trigger-workflows#project_card). The newer Projects product uses a different model (Status fields, GraphQL) and does **not** provide the same card-move webhooks, so **automated label reset on “column change” in Actions** is not wired the way this playbook expects. If you are stuck on the new Projects UI, you typically fall back to **label-only phase signals**, **scheduled** `gh` jobs, or **manual** `aidlc_work` updates until GitHub’s automation story matches your needs.

**Scope (this document):** [Projects (classic)](https://docs.github.com/en/issues/organizing-your-items-with-project-boards/managing-project-boards/about-project-boards) — a board with **columns** and **cards** (issues/PRs). If your org can’t create a new classic board, see [community discussion on classic vs new project boards](https://github.com/orgs/community/discussions/62113) and org settings; you may need an **existing** classic project on the repository.

---

## Projects (classic) vs Projects (new)

| | **Classic (“v1” / board columns)** | **Projects (new) / v2** |
|---|-------------------------------------|-------------------------|
| Phase | A **column** = a phase (Idea, Plan, …) | A **Status** (or other) field on the item |
| **Actions trigger for moves** | [`project_card`](https://docs.github.com/en/actions/using-workflows/events-that-trigger-workflows#project_card) | Not `project_card` — different events / GraphQL |
| **This guide’s label-sync workflow** | **Supported** (template uses `project_card`) | **Not** the primary path; use labels + cron or custom automation |

---

## Concepts

| Mechanism | Role |
|-----------|------|
| **Column** | Single source of truth for **which AIDLC phase** the work is in (one column per stage you use). |
| **Labels `aidlc_work:*`** | Whether the **current column** still needs an agent run: `unstarted` = eligible for cron; `in_progress` = a run is active; do not start another. |
| **GitHub Actions** | **Reset** `aidlc_work:*` to `unstarted` when a **classic** card **moves** (see template). **Mac cron** cannot see board moves. |
| **Mac `launchd`** | Poll GitHub; find issues in the right **column** + `aidlc_work:unstarted`; invoke **Claude Code**. |

**Why two layers:** **Actions** react to **project_card** in the cloud. **launchd** only **scans** and **starts** Claude on a schedule.

---

## Column names (suggested)

Create **one column per phase** you use, **in order**. Names are suggestions — keep them stable in docs and in cron queries if you key off column name via API.

| Column | Meaning | Slash command when `aidlc_work:unstarted` | Cron? |
|--------|---------|------------------------------------------|--------|
| **Idea** | Backlog / intake. Not in AIDLC yet. | — | **No** |
| **Plan** | Plan — Product Spec only. | `/plan` | Yes |
| **Design** | Design — Tech Spec + review passes. | `/design` | Yes |
| **Build** | Build + Test; exit = open PR + green CI per AIDLC. | `/build` | Yes |
| **Review** | Review gate. | `/review` | Yes |
| **Ship** | Validate + Learn. | `/ship` | Yes |
| **Done** | Shipped / accepted. | — | **No** |
| **Won’t do** | Closed without delivery. | — | **No** |

- **Build** and **Test** are **one** column if you do not split them.
- **Idea**, **Done**, and **Won’t do** are **excluded** from cron (same as before).

---

## Labels

Create these **repository** labels:

| Label | Meaning |
|-------|---------|
| `aidlc_work:unstarted` | Ready for the next **automated** run for the **current** column. |
| `aidlc_work:in_progress` | A run is in progress; **skip** in cron until finished or reset. |

### Rule when a card moves to a new column

When a card **moves** to a **non-terminal** column (not **Done** / **Won’t do**), set **`aidlc_work:unstarted`** (drop `in_progress`). Implement with **[GitHub Actions](https://docs.github.com/en/actions)** and the template [`docs/templates/github-workflows/aidlc-project-label-sync.yml`](templates/github-workflows/aidlc-project-label-sync.yml) (copy to **your app repo** as `.github/workflows/aidlc-project-label-sync.yml`), or run the [manual workflow](#manual-workflow-dispatch) if Actions is off.

The template uses **`project_card`** so each move can reset labels, matching [GitHub’s own classic-project examples](https://docs.github.com/en/actions/managing-issues-and-pull-requests/removing-a-label-when-a-card-is-added-to-a-project-board-column).

---

## Issue body convention

Each Feature issue should include:

```markdown
AIDLC feature folder: `feature/<kebab-slug>/`
Parent issue: #NNN (if sub-issue)
```

Match `<kebab-slug>` to the directory your agents use locally.

---

## GitHub setup (checklist) — classic project

1. **Repository project (classic):** [Create a project (classic)](https://docs.github.com/en/issues/organizing-your-items-with-project-boards/managing-project-boards/creating-a-project-board) on the **repository** (team workflows in this doc assume the board lives with the repo).
2. Add **columns** named to match the table above (or your subset).
3. Create labels `aidlc_work:unstarted` and `aidlc_work:in_progress`.
4. Add issues to the board; place cards in the right **column**; set **`aidlc_work:unstarted`** when you want automation to pick the issue up.
5. Copy [`docs/templates/github-workflows/aidlc-project-label-sync.yml`](templates/github-workflows/aidlc-project-label-sync.yml) to your app repo as `.github/workflows/aidlc-project-label-sync.yml` and adjust [optional `column_id` filters](#optional-limit-workflow-to-specific-columns) if needed.
6. Configure **Mac** `launchd` using [scripts/launchd/com.aidlc.cron.example.plist](../scripts/launchd/com.aidlc.cron.example.plist) and [scripts/aidlc-cron.sh](../scripts/aidlc-cron.sh).

### Optional: limit workflow to specific columns

In the `project_card` job you can **skip** terminal columns (e.g. **Done**) by comparing `github.event.project_card.column_id` to known IDs, or by setting a repo variable / secret. Get a **column ID** from the board UI: next to the column name → **Copy link** — the link ends with `#column-` **24687531** (example in [GitHub’s doc](https://docs.github.com/en/actions/managing-issues-and-pull-requests/removing-a-label-when-a-card-is-added-to-a-project-board-column)).

### Finding project / column IDs (REST, classic)

- **Column ID:** from the **Copy column link** URL, or `gh api projects/columns/COLUMN_ID` after resolving the project.
- **Project (classic) ID** (repo): `gh api repos/OWNER/REPO/projects` (older REST) — prefer column IDs in Actions expressions when filtering.

Document IDs in a **private** ops note or org secrets — do not commit secrets.

---

## Automation A: label reset (GitHub Actions)

**File (template in AI-DLC):** [`docs/templates/github-workflows/aidlc-project-label-sync.yml`](templates/github-workflows/aidlc-project-label-sync.yml) — copy to `.github/workflows/` in your application repository.

- **`workflow_dispatch`** — manual run for a single **issue** number.
- **`project_card`** — `moved` / `created` / `converted` / `edited` for **projects (classic)**. The script reads **`project_card.content_url`** to find the **issue or PR** number, then sets labels. **Note cards** (no `content_url`) are skipped.

`GITHUB_TOKEN` is usually enough for a **repo** project in the same repository. **Org-wide** classic boards or stricter token scopes may need a **PAT** (e.g. `repo`, `read:org`, `project`) in `secrets.AIDLC_PROJECT_PAT` and wiring `github-token` in the action — validate in a throwaway repo first.

---

## Automation B: Mac `launchd` + Claude Code

Unchanged in intent: poll with **`gh`** / REST, filter by **column** + `aidlc_work:unstarted`, then invoke `claude`. For classic projects, [Projects REST](https://docs.github.com/en/rest/projects) lists cards and column membership — extend the placeholder in [scripts/aidlc-cron.sh](../scripts/aidlc-cron.sh) accordingly (no **ProjectV2** GraphQL required for classic column walks).

**Security:** same as before — tokens in **Keychain** or env file outside git, not in the plist.

---

## Manual workflow dispatch

```bash
gh workflow run aidlc-project-label-sync.yml -f issue_number=123
```

(Workflow file must exist under `.github/workflows/` in the repo — see [template](templates/github-workflows/aidlc-project-label-sync.yml).)

---

## If you must use Projects (new) / v2

- Expect **no** `project_card` events; rely on **labels** (e.g. `aidlc-phase:plan`) that humans or bots update, or **time-based** `gh` that cannot see every drag in real time.
- Optional: use GraphQL to read **Status** in scheduled Actions; **webhook coverage** for “field changed” is different from classic — re-validate on each GitHub change.
- The old **`projects_v2_item`**-based label sync is **not** the recommended path in this document; if you still have that workflow in an app repo, test against GitHub’s current event payloads in your org.

---

## Personal-account path: Projects v2 + Cursor Cloud Agents

If you are on a **personal GitHub account** (not an org), two constraints apply:

| Constraint | Why |
|-----------|-----|
| Cannot create new classic projects | GitHub deprecated new classic project creation on personal accounts (late 2023). |
| `projects_v2_item` events never fire | This webhook only fires for **org-owned** Projects v2, not user-owned projects. |

The solution is to use `issues.labeled` as the event-driven trigger in GitHub Actions,
read the board phase via GraphQL, and launch a **Cursor Cloud Agent** instead of a local `claude` session.

### How it works

```
Developer action                  GitHub Actions              Cursor Cloud Agent
-----------------                 --------------              ------------------
1. Move board card to phase       (no event fires)
2. Apply aidlc_work:unstarted  -> issues.labeled fires
                                  3. Read phase via GraphQL
                                  4. Swap label -> in_progress
                                  5. Launch Cursor agent   -> Agent runs skill
                                                              Agent posts summary comment
                                                              Agent clears in_progress label
                                                              (via AIDLC_GH_CALLBACK_TOKEN)
```

### Key design decisions

- **`issues.labeled` trigger** fires reliably on personal accounts; `projects_v2_item` and `project_card` do not.
- **GraphQL to read board phase**: The workflow queries the Projects v2 `AIDLC phase` single-select field to determine which skill to run, without needing a separate config file.
- **Agent self-callback**: The Cursor agent is given a GitHub PAT (`AIDLC_GH_CALLBACK_TOKEN`) via the Cursor dashboard environment, not GitHub secrets. The agent calls the GitHub API itself to clear `aidlc_work:in_progress` when done -- no polling or cron.
- **Phase-scoped prompts with hard stops**: Each prompt names exactly one deliverable and includes explicit `HARD STOP` and `Do NOT` directives to prevent phase bleed when running headlessly (no human approval gate).
- **Immediate feedback**: The workflow posts a "launching..." comment before calling the Cursor API, then updates it with the agent link. Developers never wonder if the automation fired.

### Setup

**Step 0 (required before anything else): Configure the Cloud Agent environment**

Cloud agents run on an isolated Ubuntu VM. The VM must be configured so the agent has the right
tools installed and the skills are on disk. You must do this once per repo before any automated
agent run will succeed.

**Why the skills path matters:** The prompts tell the agent to read skill files at `.claude/skills/`.
This path exists when your repo vendors AI-DLC as a **git submodule** — the approach used by repos
that follow the AIDLC tutorial (e.g. `alexa-recipe-app`). It is **different** from the global
`install.sh` approach, which links skills into `~/.cursor/skills` on your local machine but leaves
nothing in the repo for a Cloud Agent to read.

**If you haven't done the submodule setup yet**, do it once in your repo:

```bash
# Add AI-DLC as a submodule
git submodule add https://github.com/queen-of-code/AI-DLC.git .claude/deps/ai-dlc

# Create the .claude/skills symlink that prompts reference
cd .claude && ln -s deps/ai-dlc/skills skills && cd ..

# Commit both
git add .gitmodules .claude/deps/ai-dlc .claude/skills
git commit -m "chore: vendor AI-DLC as submodule at .claude/deps/ai-dlc"
```

**If your repo already has the submodule** (`.claude/deps/ai-dlc/` and `.claude/skills/` exist),
you are set -- just ensure the Cloud Agent initializes it at runtime (below).

The Cursor Cloud Agent checks out your repo but does **not** initialize submodules by default --
your `install` command must do that.

1. Go to [cursor.com/onboard](https://cursor.com/onboard), connect your GitHub account, and select the repo.
2. Add a `.cursor/environment.json` to your repo (see [Cursor Cloud Agent setup docs](https://cursor.com/docs/cloud-agent/setup)):

```json
{
  "install": "git submodule update --init --recursive && <your-dependency-install-command>"
}
```

The `git submodule update --init --recursive` populates `.claude/deps/ai-dlc/` so the `.claude/skills/`
symlink resolves. Without it, the agent will not find any skills.

The `install` command runs before every agent and must be idempotent. Add your repo's dependency
setup after the submodule init. Examples by stack:
- Node.js: `git submodule update --init --recursive && npm install`
- .NET: `git submodule update --init --recursive && dotnet restore`
- Python: `git submodule update --init --recursive && pip install -r requirements.txt`

Once setup is complete, **take a snapshot** at [cursor.com/onboard](https://cursor.com/onboard)
so future agents start from a cached image with submodules and dependencies already present.

After environment setup, complete the remaining steps:

1. **GitHub secrets**: `CURSOR_API_KEY` in repo Settings -> Secrets -> Actions.
2. **GitHub variables** (optional): `AIDLC_PROJECT_OWNER`, `AIDLC_PROJECT_NUMBER`.
3. **Cursor dashboard secret**: `AIDLC_GH_CALLBACK_TOKEN` (GitHub PAT, `repo` scope) in [cursor.com/dashboard/cloud-agents](https://cursor.com/dashboard/cloud-agents) -> Environment. **Do not add to GitHub secrets or commit it.**
4. **Labels**: create `aidlc_work:unstarted` and `aidlc_work:in_progress` in the repo.
5. **Workflow**: copy [`docs/templates/github-workflows/aidlc-agent-launch.yml`](templates/github-workflows/aidlc-agent-launch.yml) to `.github/workflows/aidlc-agent-launch.yml` in your app repo. Adjust `DEFAULT_BRANCH` at the top of the script block.

### Per-feature workflow

1. Create a GitHub issue with `AIDLC feature folder: feature/<kebab-slug>/` in the body.
2. Add the issue to your Projects v2 board.
3. Move the board card to the target phase column (e.g. **Plan**).
4. Apply the label **`aidlc_work:unstarted`** to the issue.

The workflow fires, posts an immediate comment, and launches the agent. When the agent finishes, it posts a summary and clears `aidlc_work:in_progress`. Move the card to the next phase column and re-apply `aidlc_work:unstarted` to continue.

### Manual trigger (testing or re-runs)

```bash
gh workflow run aidlc-agent-launch.yml \
  -f issue_number=123 \
  -f phase=plan
```

### Prompt templates

Per-phase headless prompt templates (markdown source): [`scripts/prompts/cloud-agent/`](../scripts/prompts/cloud-agent/).

The workflow builds the actual prompt text dynamically; these files are the human-readable source of truth.

---

## Links

- Tutorial (manual queue): [alexa-recipe-app `docs/github-queue.md`](https://github.com/queen-of-code/alexa-recipe-app/blob/main/docs/github-queue.md)
- Work tracking skill: [skills/work-tracking/SKILL.md](../skills/work-tracking/SKILL.md)
- Actions: [`project_card` event](https://docs.github.com/en/actions/using-workflows/events-that-trigger-workflows#project_card) (projects **(classic)** only)
- Actions: [`issues.labeled` event](https://docs.github.com/en/actions/using-workflows/events-that-trigger-workflows#issues) (personal account path)
- Cursor Cloud Agents API: [cursor.com/docs/cloud-agent/api/endpoints](https://cursor.com/docs/cloud-agent/api/endpoints)
