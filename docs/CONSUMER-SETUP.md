# Consumer repo setup (AIDLC)

How to **vendor** this library in an application repo and wire **tracker-agnostic** AIDLC without copying Vega-specific automation.

**Related:** [GETTING-ORIENTED.md](GETTING-ORIENTED.md) (diagrams), [ISSUE-TRACKER-PORTABILITY.md](ISSUE-TRACKER-PORTABILITY.md), [INTERACTIVE-UI-VALIDATION.md](INTERACTIVE-UI-VALIDATION.md), [templates/AIDLC.md](templates/AIDLC.md).

---

## Layout

```
.claude/deps/ai-dlc/          # git submodule (pin a release tag)
.claude/skills → deps/ai-dlc/skills
.cursor/skills/<name>/       # optional repo-specific overrides
docs/AIDLC.md                # copy from docs/templates/AIDLC.md
AGENTS.md                      # Issue tracker + UI validation environments
.cursor/mcp.json               # from docs/templates/mcp.json.example
```

### Submodule

```bash
git submodule add https://github.com/queen-of-code/AI-DLC.git .claude/deps/ai-dlc
cd .claude && ln -s deps/ai-dlc/skills skills
```

Pin to a **release tag** (e.g. `v1.0.0`), not floating `main` — see [INSTALL.md](INSTALL.md).

### Cloud Agent install

`.cursor/environment.json`:

```json
{
  "install": "git submodule update --init --recursive && <your-dependency-install>"
}
```

---

## Two skill roots

| Path | Role |
|------|------|
| `.claude/skills` (symlink → submodule) | Generic AIDLC orchestrators and library skills |
| `.cursor/skills` | **Optional overrides** — consumer specialists, env-specific Ship/Review deltas |
| `.opencode/skills` | **OpenCode overrides** — the local transport's phase deltas (see below) |

**Override rule:** When both exist, **consumer `.cursor/skills` wins** for the same skill name (and in OpenCode, `.opencode/skills` outranks `.claude/skills`). Overrides must state what they replace and link to the generic skill.

**Exception:** UI validation procedure is **not** overridden for tool choice — use [INTERACTIVE-UI-VALIDATION.md](INTERACTIVE-UI-VALIDATION.md) (Chrome DevTools MCP). Consumers only customize URLs and credentials below.

---

## Consumer specialist dispatch (Build example)

Default **`/build`** uses horizontal skills (`frontend-web`, `backend-saas`, `testing`). Larger repos may add **`.cursor/skills/build/SKILL.md`** that routes to vertical specialists (backend, frontend, infra) per Tech Spec sections — see [skills/build/SKILL.md](../skills/build/SKILL.md) § Consumer specialist dispatch.

Do **not** copy entire agent libraries into the submodule; keep specialists in the app repo’s `.cursor/agents/` or equivalent.

---

## `AGENTS.md` blocks to add

### Issue tracker (AIDLC)

Full template: [ISSUE-TRACKER-PORTABILITY.md](ISSUE-TRACKER-PORTABILITY.md).

Dual-tracker pattern (common): **Linear** (or Jira) = product backlog; **GitHub Projects v2** = optional headless phase transport — link issues, do not duplicate scope.

### UI validation environments

```markdown
## UI validation environments

Procedure: [INTERACTIVE-UI-VALIDATION.md](INTERACTIVE-UI-VALIDATION.md) (or vendored copy under `docs/`).
Tool: **Chrome DevTools MCP** (`chrome-devtools`) in `.cursor/mcp.json` — see AI-DLC `docs/templates/mcp.json.example`.

| Field | Value |
|--------|--------|
| **Local dev URL** | e.g. `http://127.0.0.1:8080` |
| **Staging / pre-prod URL** | e.g. `https://app.staging.example.com` |
| **Test credential env vars** | e.g. `STAGING_TEST_EMAIL`, `STAGING_TEST_PASSWORD` (values in Cloud Agent env only) |
| **Login flow notes** | Optional |
```

---

## OpenCode local transport

Runs the lifecycle on **OpenCode + self-hosted models**, with Linear for gates and specs and GitHub for PRs. Design: [`feature/opencode-local/plan.md`](../feature/opencode-local/plan.md). P1 is human-driven: you run each phase yourself (`/aidlc/plan ENG-123` …) and make every state move; the polling daemon arrives in P2.

```
opencode.jsonc                     # from templates/aidlc-local/opencode/opencode.jsonc (repo root)
.opencode/skills/aidlc-local/      # shared local rules
.opencode/skills/<phase>/          # plan design build review ship learn — overrides
.opencode/commands/aidlc/<phase>.md  # /aidlc/<phase>: binds runner agent + model tier
.opencode/agents/aidlc-review/     # six read-only review subagents
.claude/skills → deps/ai-dlc/skills  # unchanged: the overrides read the library skills here
```

```bash
T=.claude/deps/ai-dlc/docs/templates/aidlc-local
cp $T/opencode/opencode.jsonc .
mkdir -p .opencode && cp -R $T/opencode/{agents,commands,skills} .opencode/
mkdir -p scripts && cp $T/aidlc-doctor.sh $T/aidlc-slices.sh scripts/ && cp $T/.env.example aidlc.env.example
```

Then set the two model IDs in `opencode.jsonc`, export the **agent** variables from `.env.example`, and run `scripts/aidlc-doctor.sh --e2e` until it reports no FAILs.

**Privilege (the reason for this layout):** the runner agent denies everything by default and allows only what phases need. Policies allow only the `local` model provider. **No agent gets `linear_save_issue`**: the Linear MCP uses that one tool to create *and* update issues (state, delegate, assignee), so it is the self-approval path. `gh pr merge` and `gh api` are denied as well.

**Slices without an issue-write tool:** `/aidlc/design` writes the slice plan as an `aidlc-slices` JSON block inside the Tech Spec Document. After **you** move the Feature to Build+Test, run, in your own shell with the full key:

```bash
scripts/aidlc-slices.sh ENG-123 --dry-run   # review
scripts/aidlc-slices.sh ENG-123             # create sub-issues in the backlog state, chained with "blocks"
```

It refuses unless the Feature is already in Build+Test, never assigns or delegates, and is safe to re-run. Then move the first slice to Build+Test to start building. In P2 the daemon does both steps on your gate move. `aidlc-slices.sh --plan-file spec.md` lints a slice plan offline.

Add the **Privilege** row to your Issue tracker table ([ISSUE-TRACKER-PORTABILITY.md](ISSUE-TRACKER-PORTABILITY.md)) and a **Validation target** block, which `/aidlc/ship` reads:

```markdown
## Validation target

| Field | Value |
|--------|--------|
| **Surface** | `web` \| `macos-app` \| `cli` |
| **Launch** | e.g. `docker compose up -d` / `npm run dev -- --port $((3000 + AIDLC_LANE_OFFSET))` / `xcodebuild -scheme App -destination …` / `./bin/tool` |
| **Readiness** | e.g. `curl -fsS http://127.0.0.1:$PORT/health` |
| **Isolation per lane** | port offset (`web`); ephemeral simulator device via `xcrun simctl create` / `delete` (`macos-app`) |
| **Test credential env vars** | names only, e.g. `STAGING_TEST_EMAIL` (values never in the repo) |
| **Teardown** | e.g. `docker compose down -v` |
```

---

## Terminology

| Term | Meaning |
|------|---------|
| **Validate phase** | AIDLC phase 6; `/ship`; scorecard vs Product Spec |
| **UI validation** | Chrome DevTools MCP technique; used in Review and inside Validate — **not** a separate phase |

---

## GitHub automation (optional)

See **[GITHUB-AIDLC-QUEUE.md](GITHUB-AIDLC-QUEUE.md)** for the recommended Projects v2 queue (copy templates from `docs/templates/github-workflows/`). Tier B/C overview: [GITHUB-AIDLC-PROJECT.md](GITHUB-AIDLC-PROJECT.md).
