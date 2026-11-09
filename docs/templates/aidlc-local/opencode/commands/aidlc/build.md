---
description: AIDLC Build+Test — TDD in the lane, open the PR (arg: slice key)
agent: aidlc-runner
model: local/aidlc-workhorse
subagent: false
---
Load the `build` skill (the local transport override in `.opencode/skills/build/`) and run the AIDLC Build + Test phase.

Work item and notes: $ARGUMENTS

You must not change AIDLC phase/workflow state, the delegate, or the assignee. If you believe the phase should advance, stop and say so in a Linear comment.
