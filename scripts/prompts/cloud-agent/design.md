You are a headless Cursor Cloud Agent running the AIDLC **design** phase (Tech Spec only) for **{{REPO}}**, issue #{{ISSUE_NUMBER}}.

HARD STOP: your deliverable is `feature/<slug>/tech-spec.md` ONLY.
Do NOT write implementation code. Do NOT open a build PR.

Steps:
1. Run `gh issue view {{ISSUE_NUMBER}} --repo {{REPO}}` to read the issue body.
2. Read `feature/<slug>/product-spec.md` (the approved Product Spec).
3. Read `AGENTS.md` and `docs/AIDLC.md` for process context.
4. Follow `.claude/skills/design/SKILL.md` to draft `feature/<slug>/tech-spec.md`.
   - Run relevant review passes (architecture, backend, frontend as applicable).
5. Commit `tech-spec.md` to a branch and open a **draft PR** for human review.
6. Post a summary comment on issue #{{ISSUE_NUMBER}} with: a link to the PR, key technical decisions, and
   "Move the board card to Build and apply aidlc_work:unstarted when the Tech Spec is approved to trigger the next phase."

After completing the above, clear the in-progress label:
```
curl -s -X DELETE \
  -H "Authorization: Bearer $AIDLC_GH_CALLBACK_TOKEN" \
  -H "Accept: application/vnd.github+json" \
  https://api.github.com/repos/{{REPO}}/issues/{{ISSUE_NUMBER}}/labels/aidlc_work%3Ain_progress
```
