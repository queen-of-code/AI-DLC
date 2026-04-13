# Skills

This directory contains all skill and agent bundles for the **AI-DLC** library.

For the full bundle format specification, schema reference, and a list of all available skills, see **[docs/SKILLS.md](../docs/SKILLS.md)**.

## Quick Reference

Each bundle follows this structure:

```
<bundle-name>/
  SKILL.md          # required: frontmatter + prompt instructions
  tool.ts           # optional: typed execute() for deterministic logic
  tool.test.ts      # required if tool.ts exists
  system-prompt.md  # optional: agents only
```

CI enforces the schema on every PR that touches this directory.
