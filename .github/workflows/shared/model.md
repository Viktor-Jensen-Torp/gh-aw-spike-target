---
description: >
  The model every role runs on, in one place. Established by experiment, not
  from the documentation: `model` is absent from the "Allowed Import Fields"
  table in reference/imports.md, but it imports — relate.md compiled with no
  model line of its own and its lock still carried the right agent_model. The
  same is true of max-ai-credits and max-daily-ai-credits, so that table is
  incomplete rather than exhaustive.

  A workflow that needs a different model still sets `model:` in its own
  frontmatter, which takes precedence over an import.

model: anthropic/claude-haiku-4-5-20251001
---
