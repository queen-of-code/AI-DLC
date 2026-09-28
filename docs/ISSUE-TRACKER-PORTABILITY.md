# Issue tracker portability (AIDLC)

Teams choose **where work is tracked** (GitHub Issues, **Linear**, **Jira**, etc.). AIDLC **phase orchestrators** (`/plan`, `/design`, …) are **tracker-first** for specs and work state; they should **not** hard-code one vendor. **How** status moves, labels, and automations are implemented is a **pluggable “transport”** — this doc defines the **contract** and the **one place** each repo records its choice: **`AGENTS.md`**.

## Invariants (every tracker)

- **`docs/AIDLC.md`** in the app repo (vendored or linked).
- **Parent Feature work item** in the issue tracker — specs and phase artifacts live **there by default** (not in git). See **Spec storage** below.
- **Pull requests + CI** as the implementation and review vehicle (for codebases that use PRs).
- **ADRs** stay in the repo under **`adr/`** — durable architecture records, not tracker drafts.

## Spec storage

| **Spec storage** (`AGENTS.md`) | Meaning |
|--------------------------------|---------|
| **`issue-tracker`** (default) | Product Spec, Tech Spec, and phase artifacts (review mirror, validate scorecard, learn notes) are **on the parent Feature work item**. Agents use the tracker’s native mechanism (Linear Documents, GitHub issue body/comment, Jira description, …). **Do not** add `feature/<slug>/` markdown to the repo unless the team explicitly opted into the row below. |
| **`repo-feature-folder`** (optional, **not recommended**) | **Also** commit specs under `feature/<slug>/`. Clutters the repo and duplicates the tracker; only use when policy requires specs in git (e.g. legal review of committed docs). |

If **Spec storage** is omitted from `AGENTS.md`, treat it as **`issue-tracker`**.

**Canonical artifact names** (adapt to your tracker):

| Artifact | Typical title / location |
|----------|---------------------------|
| Product Spec | `Product Spec — {feature name}` (Linear Document) or `## Product Spec` in the Feature issue |
| Tech Spec | `Tech Spec — {feature name}` or `## Tech Spec` |
| Review report | PR comments (preferred) + optional tracker Document or issue comment |
| Validate scorecard | Tracker Document or issue section |
| Learn notes | Tracker Document or short issue note; **ADRs still in `adr/`** |

Detail for agents: **[`spec-management`](../skills/spec-management/SKILL.md)** § Spec storage. **Linear:** [LINEAR-AIDLC-PROJECT.md](LINEAR-AIDLC-PROJECT.md). **GitHub:** keep specs on the **Feature issue** (description sections or updated comments); PRs link the issue key — see [GITHUB-AIDLC-PROJECT.md](GITHUB-AIDLC-PROJECT.md).

## Pluggable (per organization)

- **Phases on a board** (columns, workflow states, Jira status categories).
- **“Ready for agent” signals** (labels, custom fields, `aidlc_work:*` patterns).
- **Automation** (GitHub Actions, `project_card`, Linear Asks/automations, Jira post-functions, **scheduled** `gh` / API scripts — whatever the org runs).

**Canonical GitHub path** (Projects classic + labels + optional cron): [GITHUB-AIDLC-PROJECT.md](GITHUB-AIDLC-PROJECT.md). **Linear-native path** (workflow states = phases, Documents, slices born inert, bot @mentions): [LINEAR-AIDLC-PROJECT.md](LINEAR-AIDLC-PROJECT.md). Other trackers follow the **same ideas** with their native automations (no Jira template in this repo yet) — the **setup agent** (below) links to the right checklists and leaves **your** wiring in the repo’s `AGENTS.md`.

---

## Record your tracker in the app repo: `AGENTS.md`

Add a **short, copy-pastable** block so **humans and agents** know what to use. Keep it **one screen**; link out for long automation docs.

### Template (copy into consumer `AGENTS.md`)

```markdown
## Issue tracker (AIDLC)

| Field | Value |
|--------|--------|
| **System** | `github-issues` \| `github-projects-classic` \| `linear` \| `jira` \| `other` — pick one |
| **Spec storage** | `issue-tracker` (default) \| `repo-feature-folder` (not recommended) |
| **Work item for a Feature** | e.g. GitHub issue URL pattern, Linear team + project, Jira Epic key pattern |
| **Phase signal** | e.g. board column = phase; or labels `aidlc_work:*`; or Linear state; or Jira status |
| **Spec artifacts** | Where each spec lives on the Feature item (e.g. Linear Document titles; GitHub `## Product Spec` in issue body) |
| **Automation entry points** | Links to your workflows, or “manual until …” |

**Notes (optional):** e.g. “Specs on Linear Documents only — no `feature/` folder.” or “Legacy: `repo-feature-folder` until Q3 migration.”
```

### Extended template (dual-tracker and PR gates)

Use when product backlog and headless orchestration differ:

```markdown
## Issue tracker (AIDLC)

| Field | Value |
|--------|--------|
| **Primary tracker (product backlog)** | e.g. `linear` — team `ENG`, ticket pattern `ENG-123` |
| **Orchestration tracker (optional)** | e.g. `github-projects-v2` — org project #1, field `AIDLC phase` |
| **Spec storage** | `issue-tracker` (default) |
| **Ticket key on every PR** | Pattern in **title and body** (CI may enforce), e.g. `ENG-123` |
| **Phase signal** | Linear workflow state **or** GitHub board column **or** labels `aidlc_work:*` |
| **Spec artifacts** | Linear Documents on `ENG-*`; GitHub orchestration issue links the Linear URL |
| **Automation entry points** | Links to workflows, or “manual `/aidlc-launch` until …” |

**Example — Linear + GitHub orchestration:** Linear holds `ENG-*` scope, acceptance, and **all specs**; GitHub issue + Projects v2 runs Cursor phase agents; PRs link both.

**Example — GitHub only:** Single GitHub issue per Feature; specs in the issue body; Projects v2 column = phase; see [GITHUB-AIDLC-PROJECT.md](GITHUB-AIDLC-PROJECT.md).
```

**`other`:** set **System** to `other` and name the product in **Notes** (e.g. Asana, Height). Phase orchestrators still read this table before assuming GitHub.

---

## Setup: `agent-issue-tracker-setup`

Use the library agent **[`agent-issue-tracker-setup`](../skills/agents/agent-issue-tracker-setup/SKILL.md)** when:

- A repo is **adopting AIDLC** and needs a **recorded** tracker choice, or
- You are **switching** from one system to another.

The agent’s job is **not** to run proprietary APIs with your credentials blindly. It **does**:

1. Capture **`System`** and links from the human.
2. Fill the **table above** (or a variant) for **your** `AGENTS.md`, defaulting **Spec storage** to **`issue-tracker`** unless they insist on `repo-feature-folder` (warn about repo clutter).
3. Emit a **checklist** of concrete steps: which AI-DLC doc to follow ([GITHUB-AIDLC-PROJECT.md](GITHUB-AIDLC-PROJECT.md) for GitHub classic path, or Linear/Jira docs you maintain), which labels/fields to create, and what **not** to put in the repo (secrets in workflows; **spec markdown** unless `repo-feature-folder`).
4. Point phase skills at **`AGENTS.md` → Issue tracker (AIDLC)** so **no skill assumes GitHub** when you chose Linear/Jira.

**Skills** involved: [`work-tracking`](../skills/work-tracking/SKILL.md) (hierarchy and platform ideas), plus repo hygiene via [`git-workflow`](../skills/git-workflow/SKILL.md) when opening setup PRs.

---

## For phase orchestrators (normative)

- **`/plan`**, **`/design`**, etc. must read **`AGENTS.md`** for an **Issue tracker (AIDLC)** section. If it is **missing**, default **Spec storage** to **`issue-tracker`**, **ask** which system holds the parent Feature work item, or follow any repo doc like `docs/github-queue.md` / `docs/linear-workflow.md` if present.
- **Do not** create `feature/<slug>/` or commit spec files unless **Spec storage** is **`repo-feature-folder`**.
- Use **tracker APIs / MCP** (Linear Documents, `gh issue edit`, Jira REST, …) when available to read and write spec artifacts on the Feature work item.
- **ADRs** are always created in **`adr/`** in git (Learn / Design), not as tracker-only drafts.

## Links

- [GITHUB-AIDLC-PROJECT.md](GITHUB-AIDLC-PROJECT.md) — GitHub automation tiers (recommended queue, minimal templates, classic legacy)
- [LINEAR-AIDLC-PROJECT.md](LINEAR-AIDLC-PROJECT.md) — Linear-native transport (states = phases, Documents, inert slices, bot @mentions)
- [CONSUMER-SETUP.md](CONSUMER-SETUP.md) — submodule, overrides, UI validation environments
- [work-tracking skill](../skills/work-tracking/SKILL.md) — hierarchy; GitHub + Linear platform mapping (extend for Jira in your repo)
- [AGENTS.md](AGENTS.md) in **this** repo (AI-DLC) — contributor quick links
