---
type: Convention
title: How conventions work
description: How these documents are organised, how a rule is made true, and the one check that decides. Part of the chain; the same in every project.
tags: [conventions, agents, chain]
references:
  - { title: "Harness engineering: leveraging Codex in an agent-first world", author: Ryan Lopopolo, url: "https://openai.com/index/harness-engineering/", published: 2026-02-11, retrieved: 2026-09-27 }
  - { title: "Best practices for Claude Code", url: "https://code.claude.com/docs/en/best-practices", retrieved: 2026-09-27 }
  - { title: "How Claude remembers your project", url: "https://code.claude.com/docs/en/memory", retrieved: 2026-09-27 }
  - { title: "Effective context engineering for AI agents", author: Anthropic, url: "https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents", published: 2025-09-29, retrieved: 2026-09-27 }
  - { title: "Skill authoring best practices", url: "https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices", retrieved: 2026-09-27 }
  - { title: "Cursor Rules", url: "https://cursor.com/docs/context/rules", retrieved: 2026-09-27 }
  - { title: "Context Engineering for Coding Agents", author: Birgitta Böckeler, url: "https://martinfowler.com/articles/exploring-gen-ai/context-engineering-coding-agents.html", published: 2026-02-05, retrieved: 2026-09-27 }
  - { title: "Harness engineering for coding agent users", author: Birgitta Böckeler, url: "https://martinfowler.com/articles/harness-engineering.html", published: 2026-04-02, retrieved: 2026-09-27 }
  - { title: "Using Linters to Direct Agents", author: Alvin Sng (Factory), url: "https://factory.com/news/using-linters-to-direct-agents", published: 2025-09-05, retrieved: 2026-09-27 }
---

# How conventions work

- **Start at the map.** `.github/conventions/index.md` is short on purpose: it
  says which documents to read for the paths you will touch. Read those, not all
  of them.
- **One check decides.** `bash .github/scripts/verify.sh` runs every check CI
  runs, in the same order. Run it before you finish, and fix everything it
  names. Green there is green in CI.
- **A rule is real when something fails.** Every rule names what checks it: a
  lint rule, the type checker, a test, the `conventions` check, or the reviewer.
  Lint messages say how to fix; follow them.
- **Documents over existing patterns.** Copy the code you find only where it
  matches these documents. Where they disagree, the document wins; note the
  difference in one line of your pull request description.
- **These documents hold what the code cannot show.** When a reviewer flags the
  same thing twice, it becomes a rule, with a check, in the layer it belongs to:
  `chain/` when it holds for any project, the project's documents otherwise.
