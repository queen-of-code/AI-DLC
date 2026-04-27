# Issue tracker portability (AIDLC)

Teams choose **where work is tracked** (GitHub Issues, **Linear**, **Jira**, etc.). AIDLC **phase orchestrators** (`/plan`, `/design`, …) are **git- and spec-centric**; they should **not** hard-code one vendor. **How** status moves, labels, and automations are implemented is a **pluggable “transport”** — this doc defines the **contract** and the **one place** each repo records its choice: **`AGENTS.md`**.

## Invariants (every tracker)

- **`docs/AIDLC.md`** in the app repo (vendored or linked).
- **`feature/<slug>/`** for Product Spec, Tech Spec, and related artifacts.
- **Pull requests + CI** as the implementation and review vehicle (for codebases that use PRs).
- **Parent work item** in the team’s issue tracker: body or description links to `feature/<slug>/` and the tracker issue/URL is discoverable from chat or the spec.

## Pluggable (per organization)

- **Phases on a board** (columns, workflow states, Jira status categories).
- **“Ready for agent” signals** (labels, custom fields, `aidlc_work:*` patterns).
- **Automation** (GitHub Actions, `project_card`, Linear Asks/automations, Jira post-functions, **scheduled** `gh` / API scripts — whatever the org runs).

**Canonical GitHub path** (Projects classic + labels + optional cron): [GITHUB-AIDLC-PROJECT.md](GITHUB-AIDLC-PROJECT.md). Other trackers follow the **same ideas** with their native automations; there is no single template file for Jira/Linear in this repo today — the **setup agent** (below) links to the right checklists and leaves **your** wiring in the repo’s `AGENTS.md`.

---

## Record your tracker in the app repo: `AGENTS.md`

Add a **short, copy-pastable** block so **humans and agents** know what to use. Keep it **one screen**; link out for long automation docs.

### Template (copy into consumer `AGENTS.md`)

```markdown
## Issue tracker (AIDLC)

| Field | Value |
|--------|--------|
| **System** | `github-issues` \| `github-projects-classic` \| `linear` \| `jira` \| `other` — pick one |
| **Work item for a Feature** | e.g. GitHub issue URL pattern, Linear team + project, Jira Epic key pattern |
| **Phase signal** | e.g. board column = phase; or labels `aidlc_work:*`; or Linear state; or Jira status |
| **Parent ↔ `feature/<slug>/`** | Where the link to the feature folder lives (issue body, Linear description, Jira description) |
| **Automation entry points** | Links to your workflows, or “manual until …” |

**Notes (optional):** e.g. “We use GitHub Projects classic; label sync is in `.github/workflows/aidlc-project-label-sync.yml`.” or “Linear is source of truth; GitHub issues are PR-only; sync via …”
```

**`other`:** set **System** to `other` and name the product in **Notes** (e.g. Asana, Height). Phase orchestrators still read this table before assuming GitHub.

---

## Setup: `agent-issue-tracker-setup`

Use the library agent **[`agent-issue-tracker-setup`](../skills/agents/agent-issue-tracker-setup/SKILL.md)** when:

- A repo is **adopting AIDLC** and needs a **recorded** tracker choice, or
- You are **switching** from one system to another.

The agent’s job is **not** to run proprietary APIs with your credentials blindly. It **does**:

1. Capture **`System`** and links from the human.
2. Fill the **table above** (or a variant) for **your** `AGENTS.md`.
3. Emit a **checklist** of concrete steps: which AI-DLC doc to follow ([GITHUB-AIDLC-PROJECT.md](GITHUB-AIDLC-PROJECT.md) for GitHub classic path, or Linear/Jira docs you maintain), which labels/fields to create, and what **not** to put in the repo (secrets in workflows).
4. Point phase skills at **`AGENTS.md` → Issue tracker (AIDLC)** so **no skill assumes GitHub** when you chose Linear/Jira.

**Skills** involved: [`work-tracking`](../skills/work-tracking/SKILL.md) (hierarchy and platform ideas), plus repo hygiene via [`git-workflow`](../skills/git-workflow/SKILL.md) when opening setup PRs.

---

## For phase orchestrators (normative)

- **`/plan`**, **`/design`**, etc. must read **`AGENTS.md`** for an **Issue tracker (AIDLC)** section. If it is **missing**, default behavior is: **ask** which system links the parent work item, or use neutral wording (“parent work item in the project tracker”) and follow any repo doc like `docs/github-queue.md` / `docs/linear-workflow.md` if present.
- They **do not** implement Jira/Linear APIs; they **read** the declared mapping and link specs to the work item the human provides.

## Links

- [GITHUB-AIDLC-PROJECT.md](GITHUB-AIDLC-PROJECT.md) — GitHub Issues + Projects (classic) + labels + optional cron
- [work-tracking skill](../skills/work-tracking/SKILL.md) — hierarchy; GitHub + Linear platform mapping (extend for Jira in your repo)
- [AGENTS.md](AGENTS.md) in **this** repo (AI-DLC) — contributor quick links
