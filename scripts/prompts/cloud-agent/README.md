# Cloud Agent prompts

The prompt sent to a Cursor Cloud Agent for each AIDLC phase is built directly in
[`docs/templates/github-workflows/aidlc-agent-launch.yml`](../../docs/templates/github-workflows/aidlc-agent-launch.yml).

## Why there are no per-phase prompt files here

The skills (`/plan`, `/design`, `/build`, `/review`, `/ship`) already contain the full
orchestration instructions and sub-agent composition. The workflow prompt just needs:

1. Which phase and issue to work on
2. A **HARD STOP** — the only headless-specific content (skills assume a human is present)
3. The callback `curl` to clear `aidlc_work:in_progress`

Everything else is in the SKILL.md the agent reads. Duplicating sub-skill lists here
would just create drift.

## The full prompt (from the workflow)

```
You are a headless Cursor Cloud Agent running AIDLC **<phase>** for **<repo>**, issue #<N>.

HARD STOP: <phase-specific one-liner>

Steps:
1. `gh issue view <N> --repo <repo>` -- read the issue and find the feature slug.
2. Read `AGENTS.md` and `docs/AIDLC.md` for process context.
3. Read `.claude/skills/<phase>/SKILL.md` and follow its Orchestration section.
   Headless override: skip all "ask in chat" / "conversation first" steps.
   Document assumptions in the output instead of asking.
4. Post a summary comment on issue #<N> with results and next-phase instructions.

When done, clear the in-progress label:
curl ...
```

## Path assumption

`.claude/skills/` resolves via the AI-DLC submodule at `.claude/deps/ai-dlc/`.
The Cloud Agent's `install` command must include `git submodule update --init --recursive`.
See [GITHUB-AIDLC-PROJECT.md](../../docs/GITHUB-AIDLC-PROJECT.md) Step 0.
