# Intent over literal: examples illustrate, they don't specify

**Tracker-neutral.** Wired into [`/build`](../skills/build/SKILL.md) (implement + disclose) and [`/review`](../skills/review/SKILL.md) (blocking literal-match test). Sibling of [ARCHITECTURAL-SOUNDNESS.md](ARCHITECTURAL-SOUNDNESS.md): both reject patching a symptom at the place it was observed.

## The failure mode this prevents

Specs, tickets, and bug reports carry **examples** — a sample output string, a mocked payload, a screenshot, "e.g. …". Under test-first pressure an agent copies the example into a test as the golden value, runs the code, sees the platform produce something slightly different, and then **bends the code until it reproduces the example exactly**:

- a post-processing `replace` that rewrites one specific output the standard formatter produced;
- a branch, lookup, or override that fires on one specific input value so its output matches the sample;
- a hardcoded exception list whose only entries come from the example;
- a conditional that exists so one test assertion passes.

This ships green and is "technically correct" against the example, and it is wrong: it adds bespoke behavior nobody asked for, diverges from every other place the codebase does the same thing, and silently encodes an accident of how someone typed a ticket. Examples are frequently wrong in small ways (a sample value that is internally inconsistent, a style that doesn't match the platform) — an agent that notices one inconsistency and "fixes" it, while literal-matching another, is applying literalism only where it is convenient.

## The rule

1. **Examples are illustrative unless the spec explicitly marks them exact** ("must render exactly", "byte-for-byte", a contract fixture). The normative content is the stated rule (what information, what order, what constraint), not the sample.
2. **Implement the intent with the standard behavior** — the platform/library default, or the convention the codebase already uses for the same kind of thing. Reuse over invention.
3. **When the standard output differs from an example, that is a spec deviation, not a bug to patch.** Keep the standard behavior and disclose it: list it under `## Spec deviations & assumptions` at the top of the PR body (what the example said, what ships, why).
4. **If no standard behavior clearly fits, or matching the spec would require a special case, that is a question** — ask it per [ASK-AND-HALT.md](ASK-AND-HALT.md) rather than choosing.
5. **Never add code whose only purpose is to reproduce a specific example value.** If deleting a branch/replace/override would change only the output for the example's exact input, it is a literal-match hack.

**Tests follow the same rule.** A test's expected value comes from the stated rule and the real standard output. If you copied an expected value from an example, verify it against what the standard behavior produces *before* you change code to make it pass. A red test against an illustrative example means the test is wrong, not the code.

## Where each phase enforces it

**Build.** Implement per the rule above. Every deviation from an example is in the PR body's `## Spec deviations & assumptions` section. Before pushing, re-read the final diff and confirm the PR body describes what the code does now (not what an earlier commit did).

**Review.** A **literal-match test** runs on every PR, including copy/CSS/config-only PRs:

- Any value-keyed special case (branch, `replace`, lookup, override, hardcoded exception, test-keyed conditional) is **blocking** unless the spec *explicitly* demands that exact exception.
- "It matches the spec/ticket example" is **not** a justification. The finding reads: *example conflicts with standard behavior → drop the special case, record the deviation; a human decides if the example was meant literally.*
- Reviewers **never reconcile spec and code by editing the example** (silently correcting a sample value so it matches the implementation). Report the mismatch.
- A finding that describes code as a hack, workaround, or string patch is **blocking**. Advisory is for taste, not for code you would call weird.

**Plan / Design.** When an example is meant to be exact, say so explicitly. Otherwise, write the rule ("show the sender's display name, falling back to their email") and let examples illustrate it.
