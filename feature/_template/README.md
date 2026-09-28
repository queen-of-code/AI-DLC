# Optional legacy: repo feature folder

**Default AIDLC spec storage is on the issue tracker** (`issue-tracker` in **`AGENTS.md`**), not in git. See [ISSUE-TRACKER-PORTABILITY.md](../../docs/ISSUE-TRACKER-PORTABILITY.md).

Some repos set **Spec storage** to **`repo-feature-folder`** (not recommended). They may keep **`feature/_template/`** with empty or partial `product-spec.md` / `tech-spec.md` so **`/plan`** and **`/design`** can copy a folder in one step.

Templates (source of truth for content):

- [`../../skills/spec-management/templates/product-spec-template.md`](../../skills/spec-management/templates/product-spec-template.md)
- [`../../skills/spec-management/templates/tech-spec-template.md`](../../skills/spec-management/templates/tech-spec-template.md)

Copy them into `feature/<slug>/` only when using **`repo-feature-folder`**. **ADRs:** copy [`../../skills/spec-management/templates/adr-template.md`](../../skills/spec-management/templates/adr-template.md) into your project’s **`adr/NNNN-title.md`** (see [`adr-guidance.md`](../../skills/spec-management/templates/adr-guidance.md)) — always in git, not under `feature/`.
