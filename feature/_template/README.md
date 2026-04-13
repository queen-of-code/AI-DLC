# Feature folder bootstrap (optional)

Some repos add **`feature/_template/`** with empty or partial `product-spec.md` / `tech-spec.md` files so `/plan` can copy a folder in one step.

In **this** repository, the canonical templates live under:

- [`../../skills/spec-management/templates/product-spec-template.md`](../../skills/spec-management/templates/product-spec-template.md)
- [`../../skills/spec-management/templates/tech-spec-template.md`](../../skills/spec-management/templates/tech-spec-template.md)

Copy them into `feature/<slug>/` when starting a feature. **ADRs:** copy [`../../skills/spec-management/templates/adr-template.md`](../../skills/spec-management/templates/adr-template.md) into your project’s **`adr/NNNN-title.md`** (see [`adr-guidance.md`](../../skills/spec-management/templates/adr-guidance.md)) — not under `feature/`.
