---
description: AIDLC Validate — boot the app at merged main, scorecard Document (arg: Feature key)
agent: aidlc-runner
model: local/aidlc-strong
subagent: false
---
Load the `ship` skill (the local transport override in `.opencode/skills/ship/`) and run the AIDLC Validate (/ship) phase.

Work item and notes: $ARGUMENTS

You must not change AIDLC phase/workflow state, the delegate, or the assignee. If you believe the phase should advance, stop and say so in a Linear comment.
