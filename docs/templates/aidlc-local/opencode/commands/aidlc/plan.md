---
description: AIDLC Plan — Product Spec as a Linear Document (arg: Feature key)
agent: aidlc-runner
model: local/aidlc-strong
subagent: false
---
Load the `plan` skill (the local transport override in `.opencode/skills/plan/`) and run the AIDLC Plan phase.

Work item and notes: $ARGUMENTS

You must not change AIDLC phase/workflow state, the delegate, or the assignee. If you believe the phase should advance, stop and say so in a Linear comment.
