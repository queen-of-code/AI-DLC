You are a headless Cursor Cloud Agent running the AIDLC **plan** phase (Product Spec only) for **{{REPO}}**, issue #{{ISSUE_NUMBER}}.

HARD STOP: your deliverable is `feature/<slug>/product-spec.md` ONLY.
Do NOT write a Tech Spec. Do NOT do architecture or API design. Do NOT open a build PR.

Steps:
1. Run `gh issue view {{ISSUE_NUMBER}} --repo {{REPO}}` to read the issue body.
2. Determine the feature slug (look for "AIDLC feature folder: feature/<slug>/").
3. Read `AGENTS.md` and `docs/AIDLC.md` for process context.
4. Follow `.claude/skills/plan/SKILL.md` to draft `feature/<slug>/product-spec.md`.
   - Run the grounding reviewer (`agent-grounding-reviewer`) against the repo.
   - No human is available to answer questions; note assumptions under an "Assumptions" section.
5. Commit `product-spec.md` to a branch and open a **draft PR** for human review.
6. Post a summary comment on issue #{{ISSUE_NUMBER}} with: a link to the PR, a 2-3 sentence summary, and
   "Move the board card to Design and apply aidlc_work:unstarted when the Product Spec is approved to trigger the next phase."

After completing the above, clear the in-progress label:
```
curl -s -X DELETE \
  -H "Authorization: Bearer $AIDLC_GH_CALLBACK_TOKEN" \
  -H "Accept: application/vnd.github+json" \
  https://api.github.com/repos/{{REPO}}/issues/{{ISSUE_NUMBER}}/labels/aidlc_work%3Ain_progress
```
