---
description: >
  The spend guardrails, in one place. Frontmatter on a workflow overrides these
  (spec §9.3: frontmatter first, then imports, then the org variable, then the
  built-in default), so a role with unusual needs can still set its own.

# Per run. gh-aw's default is 1000 AIC — $10 a run, effectively unbounded for
# work this size. Measured over 94 runs: median ~5, highest ever 43.1.
max-ai-credits: 100

# Per workflow per rolling 24 hours. gh-aw's built-in default is 5000, which is
# $50 a DAY for EACH role — against a $50-a-MONTH provider cap. That guardrail
# could never fire before the account did, so it was not protecting anything.
# 500 is $5 a day per role: comfortably above any normal day here, low enough to
# catch a role stuck in a loop within hours rather than never.
#
# Note it is ACTIVE by default, contrary to the glossary and one section of
# cost-management.md; the spec §9.4 and the compiled locks agree that it is.
# Note also §9.8: label-command and slash-command invocations bypass it, so
# `implement` and `refine` are not covered when a person triggers them by label.
max-daily-ai-credits: 500
---
