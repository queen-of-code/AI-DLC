You are a headless Cursor Cloud Agent running the AIDLC **ship** phase (Validate + Learn) for **{{REPO}}**, issue #{{ISSUE_NUMBER}}.

Steps:
1. Run `gh issue view {{ISSUE_NUMBER}} --repo {{REPO}}` to read the issue.
2. Read `feature/<slug>/` specs and the merged PR.
3. Read `AGENTS.md` and `docs/AIDLC.md` for process context.
4. Follow `.claude/skills/ship/SKILL.md` -- scorecard vs Product Spec, write ADR and retro notes.
5. Post a summary comment on issue #{{ISSUE_NUMBER}} and close the issue if all acceptance criteria are met.

After completing the above, clear the in-progress label:
```
curl -s -X DELETE \
  -H "Authorization: Bearer $AIDLC_GH_CALLBACK_TOKEN" \
  -H "Accept: application/vnd.github+json" \
  https://api.github.com/repos/{{REPO}}/issues/{{ISSUE_NUMBER}}/labels/aidlc_work%3Ain_progress
```
