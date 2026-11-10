# aidlc-daemon

The local event loop for the AIDLC OpenCode transport. It is the only process that moves Linear state and the only verifier. **Read [docs/OPENCODE-LOCAL.md](../../../OPENCODE-LOCAL.md) first**: it covers the privilege model, setup and operations. The design is in [feature/opencode-local/plan.md](../../../../feature/opencode-local/plan.md) §3, §4 and §6.

Node.js ≥ 20, no npm dependencies.

| Path | What |
|---|---|
| `bin/aidlc`, `bin/aidlc-daemon` | CLI (`status`, `tail`, `gate confirm`, `pause`/`resume`, `reconcile`, `doctor`, `slices`, `breaker reset`, `kick`, `init`) and the daemon entry point |
| `config.jsonc.example` | per-repo config → `~/.config/aidlc/<owner>/<repo>/config.jsonc` |
| `transitions.json.example` | the plan §4 table, keyed on (issue kind, state, event) → `…/transitions.json` |
| `daemon.env.example`, `agent.env.example` | the two principals' secrets → `~/.config/aidlc/{daemon,agent}.env` (0600) |
| `prompts/` | phase prompts (override any of them in `<config dir>/prompts/`) |
| `units/` | launchd LaunchAgent, systemd user unit, crontab one-shot |
| `lib/` | `engine` (observe → actor check/revert/fence → transitions), `runner` (claim CAS → lane → `opencode run` → evidence → documents → teardown → clear delegate), `publish` (Decision B: publishes the run's Documents from the lane; protects a human's in-UI edits), `checks` (Actions / local re-run, tamper flag), `slices`, `linear`, `github`, `lanes`, `store` |
| `test/` | `*.test.mjs` (run below): Linear mock + fake GitHub + fake opencode; `check-schema.mjs` validates the GraphQL against Linear's schema; `real-opencode.mjs` is a manual smoke test against real OpenCode + a local model |

```bash
node --test --test-concurrency=1 docs/templates/aidlc-local/daemon/test/*.test.mjs
```
