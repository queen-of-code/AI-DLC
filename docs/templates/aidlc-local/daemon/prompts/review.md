Review PR #{{prNumber}} ({{prUrl}}) for {{identifier}}. The lane is checked out at the PR head.

- Base SHA: `{{baseSha}}` — head SHA: `{{headSha}}`
- Check verdict at head, verified by the daemon: **{{checkStatus}}** — {{checkSummary}}
{{tamperLine}}
Fan out to the six `aidlc-review/*` subagents, **{{concurrency}}**. Post one PR comment per dimension headed `### AIDLC Review — <Dimension>`, then one Linear summary comment on {{identifier}}: "merge the PR, or bounce the slice to **Build+Test**".
