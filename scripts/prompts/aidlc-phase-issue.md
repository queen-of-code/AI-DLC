You are running the AIDLC phase **{{PHASE}}** for repository **{{REPO}}**, issue **#{{ISSUE}}**.

1. Use `gh issue view {{ISSUE}} --repo {{REPO}}` (or GitHub MCP) to load the issue body. Find `feature/<slug>/` and open or create that folder under the repo root.

2. Follow `docs/AIDLC.md` in the workspace for phase definitions.

3. Invoke the matching orchestrator intent:
   - **plan** or **design**: use `/plan` (Plan + Design) until Product Spec and Tech Spec are approved per skill `skills/plan/SKILL.md`.
   - **build**: use `/build` — deliver an **open PR with green CI** per AIDLC.
   - **review**: use `/review`.
   - **ship**: use `/ship` (Validate + Learn).

4. After a successful phase handoff, do **not** change Project Status in this headless run unless the human documented that — prefer updating issue comment with summary and next steps.

5. Labels: if your team uses `aidlc_work:*`, set `aidlc_work:in_progress` only while you work; when done with this run, either leave status for the human to move the Project card or follow team rules.
