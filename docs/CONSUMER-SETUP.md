# Consumer repo setup (AIDLC)

How to **vendor** this library in an application repo and wire **tracker-agnostic** AIDLC without copying Vega-specific automation.

**Related:** [ISSUE-TRACKER-PORTABILITY.md](ISSUE-TRACKER-PORTABILITY.md), [INTERACTIVE-UI-VALIDATION.md](INTERACTIVE-UI-VALIDATION.md), [templates/AIDLC.md](templates/AIDLC.md).

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

**Override rule:** When both exist, **consumer `.cursor/skills` wins** for the same skill name. Overrides must state what they replace and link to the generic skill.

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

## Terminology

| Term | Meaning |
|------|---------|
| **Validate phase** | AIDLC phase 6; `/ship`; scorecard vs Product Spec |
| **UI validation** | Chrome DevTools MCP technique; used in Review and inside Validate — **not** a separate phase |

---

## GitHub automation (optional)

See **[GITHUB-AIDLC-QUEUE.md](GITHUB-AIDLC-QUEUE.md)** for the recommended Projects v2 queue (copy templates from `docs/templates/github-workflows/`). Tier B/C overview: [GITHUB-AIDLC-PROJECT.md](GITHUB-AIDLC-PROJECT.md).
