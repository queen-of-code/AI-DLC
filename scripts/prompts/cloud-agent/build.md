You are a headless Cursor Cloud Agent running the AIDLC **build** phase for **{{REPO}}**, issue #{{ISSUE_NUMBER}}.

HARD STOP: your deliverable is a PR with passing CI. Do NOT run review or ship phases.

Steps:
1. Run `gh issue view {{ISSUE_NUMBER}} --repo {{REPO}}` to read the issue body.
2. Read `feature/<slug>/tech-spec.md` for the implementation plan.
3. Read `AGENTS.md` and `docs/AIDLC.md` for process context.
4. Follow `.claude/skills/build/SKILL.md` -- implement, write tests (TDD), open a PR.
5. Post a summary comment on issue #{{ISSUE_NUMBER}} with: a link to the PR, what was built, and
   "Move the board card to Review and apply aidlc_work:unstarted to trigger the review phase."

After completing the above, clear the in-progress label:
```
curl -s -X DELETE \
  -H "Authorization: Bearer $AIDLC_GH_CALLBACK_TOKEN" \
  -H "Accept: application/vnd.github+json" \
  https://api.github.com/repos/{{REPO}}/issues/{{ISSUE_NUMBER}}/labels/aidlc_work%3Ain_progress
```
