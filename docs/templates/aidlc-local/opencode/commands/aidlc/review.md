---
description: AIDLC Review — six specialist passes on the PR (args: slice key, PR number)
agent: aidlc-runner
model: local/aidlc-strong
subagent: false
---
Load the `review` skill (the local transport override in `.opencode/skills/review/`) and run the AIDLC Review phase.

Work item and notes: $ARGUMENTS

You must not change AIDLC phase/workflow state, the delegate, or the assignee. If you believe the phase should advance, stop and say so in a Linear comment.
