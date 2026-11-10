Implement {{identifier}} test-first on branch `{{branch}}` (the lane is already on it).
Contract: the acceptance criteria in {{identifier}}'s description and its section of the Feature's Tech Spec Document.
{{bounceBlock}}
When local checks pass, open (or update) the PR with `gh pr create` — title and body contain {{identifier}} — and mark it ready. The daemon moves the slice to Review after it re-verifies the checks; you do not.
