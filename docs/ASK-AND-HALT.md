# Ask and halt: headless runs still ask — on the ticket — and wait

**Tracker-neutral.** Every phase skill that says **"ask in chat"**, **"conversation first"**, **"stop and ask"**, or **"surface it — do not assume"** means the same thing in a headless run: **ask the question on the work item, tag a human, and halt until they answer.** Headless is a change of *channel*, never permission to skip the question or to guess.

## Why

A headless agent that is told to "document assumptions instead of asking" will take the path of least resistance on every ambiguity and bury the choice in a summary nobody reads. The questions the skills require are the human gates on judgment calls; removing them removes the gate.

## Ask

Post **one** comment on the work item (the issue being worked — the slice, or the Feature for Plan/Design), **as the bot identity** so the mention notifies:

- **@mention** the accountable human — the assignee; if none, the team lead named in `AGENTS.md`.
- **Every open question in that one comment, numbered.** For each: the options you see, your **recommended default**, and what each choice changes. One open question round per work item at a time — never several comments to reconcile.
- **What is blocked** until it's answered, and what you already finished.

Ask **early**. Ambiguities in the contract (spec, ticket, acceptance criteria) should be found in the orient step, before code.

## Halt

In the same run, after posting:

1. **Apply `needs-a-human`** and **remove the in-flight label** (`bot-working` on Linear, `aidlc_work:in_progress` on the GitHub queue).
2. **Leave the work item's state/phase unchanged.** A pause is not a bounce and not a gate — it does not count toward the bounce circuit breaker.
3. **Clear your delegate** (tracker-native agent dispatch) so nothing believes a run is live.
4. **Save work without advancing:** push work-in-progress to the branch so it survives the VM. In **Build**, do **not** open a PR, mark one ready, or request review — those fire the Build → Review automation. (On transports where the agent platform auto-creates a PR at run end, commit nothing new and put the diff summary in the question comment instead.)
5. **Stop.** Do not continue on your recommended default.

## Resume

- **Never auto-resume.** Every dispatcher (daily audit, reconcile, merge/PR-open automation, board launch) **skips work items labeled `needs-a-human`**. Put that check at the single launch chokepoint, not in each caller.
- **The human resumes it:** answers in the thread, then re-delegates (Linear) or comments `/aidlc-launch` (GitHub queue). Either explicit human action is the resume signal.
- **On start, every phase run checks first:** if `needs-a-human` is present and there is **no human comment newer than the bot's last question**, stop immediately (post nothing new). If a human has answered, remove `needs-a-human`, apply the in-flight label, read the answers, and continue **in the same phase** from where the run halted.
- A human moving the work item to a different state/phase also clears `needs-a-human` — they have taken the decision.

## What is *not* a question

Not every ambiguity needs a halt. If the standard behavior clearly applies and the choice is cheap to reverse, **decide, and disclose** it under `## Spec deviations & assumptions` in the PR body (see [INTENT-OVER-LITERAL.md](INTENT-OVER-LITERAL.md)). Halt when:

- no standard behavior clearly fits, or two reasonable readings produce different user-visible results;
- matching the contract literally would require a special case;
- the answer changes scope, data, security, or anything a human gate would otherwise review;
- a skill explicitly says *ask* (Plan's conversation-first step, Design's product-scope check, report-bug's missing repro/environment, …).

## Transport notes

| | Linear | GitHub Projects v2 queue |
|---|---|---|
| Question lands on | comment on the issue, bot seat (`LINEAR_ROBOT_KEY`) | issue comment via `AIDLC_GH_CALLBACK_TOKEN` |
| In-flight label | `bot-working` | `aidlc_work:in_progress` |
| Paused label | `needs-a-human` | `needs-a-human` |
| Resume | human answers + re-delegates | human answers + comments `/aidlc-launch` (removes `needs-a-human`) |
| Human queue view | add `OR label = needs-a-human` to the "waiting on me" view — a paused Build+Test item is otherwise invisible to a state-only view | filter issues by `needs-a-human` |

See [LINEAR-AIDLC-PROJECT.md](LINEAR-AIDLC-PROJECT.md) and [GITHUB-AIDLC-QUEUE.md](GITHUB-AIDLC-QUEUE.md).
