---
name: validate-deployed
description: Validate a PR's change on a deployed copy before merge, against its spec — numbered checks written first, the deployed commit confirmed, each check exercised in the browser, API or a script, a screenshot per browser check, observability for the deploy window, and one PR comment with the results table. Used by /review when the consumer declares deployed previews.
type: skill
aidlc_phases: [review]
tags: [aidlc, review, validation, preview, screenshots, evidence]
requires: []
author: Melissa Benua
created_at: 2026-11-10
updated_at: 2026-11-12
---

# Validate the deployed change

A reviewer that has read the code still hasn't seen the change work. This skill runs the PR's change on a **deployed copy** (a preview environment, a review slot) and shows, check by check, how it lines up with the spec: a table in the PR with a screenshot for every check made in the browser.

It is not the Validate phase. `/ship` scores the shipped Feature against the Product Spec after merge; this checks one PR before merge.

## When it runs

`/review` runs it when the consumer's `AGENTS.md` has a **Deployed previews** section (below) and the PR changes behaviour someone can observe: UI, an API, a job. For a docs-only or config-only PR, say **N/A** in one line.

## What the consumer provides (`AGENTS.md` → Deployed previews)

| Item | Example |
|---|---|
| How a PR gets a deployed copy, and how to tell when it's ready | "Label the PR `preview:<slot>`; the deploy run's summary names the slot and the commit" |
| How to confirm which commit is deployed | a `/version` endpoint, the deploy run's head SHA |
| How to sign in | a seed login script, test credentials in the environment |
| Where screenshots go | signed upload URLs handed to the run, a bucket path, an artifact store |
| The observability query for the deploy window | the tracing environment and filter for that preview |
| Which preview reviewers may use | a slot reserved for agents, so a run never deploys over a person's |

Without that section, this skill doesn't run; `/review`'s Frontend/UX pass ([INTERACTIVE-UI-VALIDATION.md](../../docs/INTERACTIVE-UI-VALIDATION.md)) still applies.

## Steps

1. **Checks first.** Before touching the deployed copy, write numbered checks (C1, C2, …) from the work item's acceptance criteria and the Tech Spec section it implements: what to do, and what you expect to see. No criteria on the work item: derive them from the PR description and say so in the comment. Writing them after testing turns "what we saw" into "what we expected".
2. **Confirm what is deployed.** The deployed commit must be the PR's head (or the PR's head merged with the base branch, when that's what the preview deploys). If it isn't, wait for the deploy or stop and say so. A result on another commit says nothing about this PR.
3. **Exercise every check** on the deployed copy:
   - **browser**: through Chrome DevTools MCP ([INTERACTIVE-UI-VALIDATION.md](../../docs/INTERACTIVE-UI-VALIDATION.md)); sign in the way the consumer says;
   - **api**: the request and the status and body that matter;
   - **script**: a throwaway script of your own for multi-step or data checks. Create only new records that the run owns; never change existing data.
4. **A screenshot for every browser check,** showing the **result** state (not the starting page). Upload each to where the consumer says screenshots go. Never commit screenshots to the repository.
5. **Observability.** Query the consumer's tracing for the deploy window (deploy time → now): error and exception counts, any new error signatures, 5xx responses. An error caused by the change fails the related check; an unrelated one is listed, not failed.
6. **Post exactly one PR comment:**

   ```markdown
   ## Deployed-change validation — PASS

   Commit `<sha>` on `<preview>`.

   | # | Check | Method | Result | Evidence |
   |---|---|---|---|---|
   | C1 | <what was checked> | browser | PASS | ![C1](<screenshot url>) |
   | C2 | <what was checked> | api | FAIL | `POST /x` → 500: <message> |

   ### Observability
   <counts, new signatures, 5xx> — [query](<link>)
   ```

   `Method` is `browser`, `api`, `script` or `observability`. Every `browser` row has a screenshot. The heading says **FAIL** if any check fails, and **INCOMPLETE** if any check couldn't be run, with why.

## Validate mode only

This skill always runs with a **zero hack budget**. It never bypasses, fakes or overrides anything to get a check through: no stubbed responses, no hand-edited data, no skipped steps, no retries until something happens to pass. When a check is blocked, the check fails or is `UNVERIFIED`, and the report says what blocked it, so the cause gets fixed.

A run that works around blockers to reach the end (a demo recorded on a deadline, say) is a different mode. It must record every workaround, and its result never counts as validation. Never post its results with this skill's heading.

## Honesty rules

- **Never report a check you didn't run as PASS.** If the preview is down, sign-in fails, or a check can't be exercised, the row says `UNVERIFIED` with the error, and the heading says INCOMPLETE.
- **A failing check is a finding for `/review`:** blocking when it shows the change doesn't do what the spec says.
- **Screenshots show the result,** not the page you started on.
