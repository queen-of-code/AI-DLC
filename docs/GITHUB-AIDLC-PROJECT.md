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

## Links

- Tutorial (manual queue): [alexa-recipe-app `docs/github-queue.md`](https://github.com/queen-of-code/alexa-recipe-app/blob/main/docs/github-queue.md)
- Work tracking skill: [skills/work-tracking/SKILL.md](../skills/work-tracking/SKILL.md)
- Actions: [`project_card` event](https://docs.github.com/en/actions/using-workflows/events-that-trigger-workflows#project_card) (projects **(classic)** only)
