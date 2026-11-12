Validate {{identifier}}{{featureLine}} on the deployed copy at **{{laneSha}}** (its merge SHA) through the declared validation surface: **{{surface}}** (see `AGENTS.md → Validation target`). This is the In Staging check of one slice or reactive item against its own acceptance criteria, not a Feature scorecard.

- Check verdict at this SHA, verified by the daemon: **{{checkStatus}}** — {{checkSummary}}
{{surfaceLine}}
- Follow the `validate-deployed` skill's contract, in **Validate mode** (zero hack budget: never bypass, fake or override anything to get a check through):
  1. write numbered checks from this issue's **acceptance criteria** before touching the deployed copy (none on the issue: derive them from its description, and say so in the scorecard);
  2. confirm the deployed commit is this SHA (or a later one that contains it); if it isn't, the run is INCOMPLETE;
  3. exercise every check in the browser, through the API or with a script that creates only its own records; a screenshot of the result for every browser check;
  4. read the observability for the deploy window.
- A build, deploy or boot failure is an immediate FAIL with the diagnosis.

File the result as the Linear Document `Validate Scorecard — <issue title>` on {{identifier}}: the checks table with evidence, then this block with the counts filled in. A check you could not run or judge (no vision for a screenshot, the deployed copy unreachable) is `humanPending`, never passed:

```aidlc-scorecard
{"version": 1, "passed": 0, "failed": 0, "humanPending": 0, "total": 0, "proposedReturn": ""}
```

It passes only when every check passes. `proposedReturn` names what to fix when anything failed (usually this issue, Build+Test).
{{resumeBlock}}
Do not move state, merge, or start /learn.
