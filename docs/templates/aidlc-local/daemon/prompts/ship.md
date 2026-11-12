Validate the whole Feature {{identifier}} at **{{laneSha}}** (merged main) through the declared validation surface: **{{surface}}** (see `AGENTS.md → Validation target`).

- Check verdict at this SHA, verified by the daemon: **{{checkStatus}}** — {{checkSummary}}
{{surfaceLine}}
- A build or boot failure is an immediate FAIL with the diagnosis.

Write the scorecard as `validate-scorecard.md` in `{{docsDir}}` (the daemon publishes it as `Validate Scorecard — {{title}}` on {{identifier}}). It must end with this block, counts filled in (a row you could not judge — e.g. a screenshot without vision — is `humanPending`, not passed):

```aidlc-scorecard
{"version": 1, "passed": 0, "failed": 0, "humanPending": 0, "total": 0, "proposedReturn": ""}
```

`proposedReturn` names the root-cause issue and phase when anything failed (usually one slice and Build+Test).
{{resumeBlock}}
Do not start /learn and do not move state.
