# Interactive UI validation (Chrome DevTools MCP)

**This is not the AIDLC Validate phase.** The **Validate phase** is Feature-level (`/ship` orchestrator): scorecard vs Product Spec, deploy readiness, tracker closure. **UI validation** is a **technique** for exercising UI acceptance criteria with tool evidence — used **inside** Review (Frontend/UX pass) and **inside** Validate phase when specs include UI success criteria.

---

## Mandatory tool

**`chrome-devtools`** MCP server — [Chrome DevTools MCP](https://github.com/ChromeDevTools/chrome-devtools-mcp).

Configure in the consumer repo’s `.cursor/mcp.json` (see [templates/mcp.json.example](templates/mcp.json.example)). Before first use, confirm the server is loaded and tools exist: `navigate_page`, `take_snapshot`, `fill_form`, `click`, `take_screenshot`, `wait_for`.

---

## Forbidden for interactive UI validation

| Tool | Allowed use |
|------|-------------|
| **`cursor-ide-browser` MCP** | **Never** for agent UI verification — unreliable in many Cloud Agent environments. |
| **Playwright** (smoke, demo, `e2e/`) | **CI and test authoring only** — not for “I checked the UI” claims in Review or Validate. |
| **`computerUse` subagent** | **Not** a substitute for Chrome DevTools MCP evidence. |

---

## Workflow

1. Confirm **`chrome-devtools`** MCP is ready.
2. **`navigate_page`** — target URL from **`AGENTS.md` → UI validation environments** (local or staging).
3. **`take_snapshot`** — read accessibility `uid`s for links, inputs, buttons.
4. **Sign in (when needed)** — use consumer-declared test credentials; `fill_form` + `click` submit; **`wait_for`** post-login indicator.
5. **Exercise acceptance criteria** — navigate surfaces from the Tech Spec or Product Spec; `click`, `fill`, `wait_for` as needed.
6. **Evidence** — **`take_screenshot`** (PNG). Attach paths in PR comments, `review-report.md`, or validate scorecard artifacts.
7. **Optional** — `list_console_messages`, `list_network_requests` for regressions.

### Honesty rule

Never report code review, inference, or Playwright CI logs as UI validation evidence. If login fails, MCP errors, or criteria were not exercised, record **Fail** or **Unverifiable** with the error text.

---

## Environments (consumer declares in `AGENTS.md`)

Each app repo fills a **`## UI validation environments`** table in **`AGENTS.md`** (template in [CONSUMER-SETUP.md](CONSUMER-SETUP.md)):

| Field | Example |
|-------|---------|
| **Local dev URL** | `http://127.0.0.1:8080` |
| **Staging / pre-prod URL** | `https://app.staging.example.com` |
| **Test credential env vars** | Names only in `AGENTS.md`; values in Cloud Agent dashboard or local env — never commit secrets |

---

## Unavailable MCP

If **`navigate_page`** fails with **“Missing X server”** (common in headless Cloud VMs):

1. Ensure a display exists (e.g. `Xvfb :1` when `DISPLAY=:1` has no server).
2. Retry **`navigate_page`** once the display is up.

If **`chrome-devtools` is not in the MCP catalog**:

- **Stop** interactive UI validation.
- Report: *Chrome DevTools MCP not loaded* — fix `.cursor/mcp.json` and team MCP settings; start a **new** agent session.
- Do **not** substitute Playwright or `cursor-ide-browser`.

---

## Who references this doc

| Phase / artifact | Usage |
|------------------|--------|
| **`/review`** § Frontend/UX | UI validation before merge |
| **`/ship`** (Validate phase) | UI success criteria after deploy/CI gates |
| **`frontend-web`**, **`testing`** skills | Cross-links for manual pre-PR checks |
