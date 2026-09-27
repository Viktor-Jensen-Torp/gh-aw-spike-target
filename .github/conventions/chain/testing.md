---
type: Convention
title: Testing
description: Which test proves which acceptance case, where tests live, and how they are written. Part of the chain; read for every change.
tags: [testing, acceptance, chain]
references:
  - { title: "Best practices for Claude Code", url: "https://code.claude.com/docs/en/best-practices", retrieved: 2026-09-27 }
  - { title: "Building effective agents", author: Anthropic, url: "https://www.anthropic.com/engineering/building-effective-agents", published: 2024-12-19, retrieved: 2026-09-27 }
  - { title: "Effective harnesses for long-running agents", author: Anthropic, url: "https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents", published: 2025-11-26, retrieved: 2026-09-27 }
  - { title: "How To Make Codebases AI Agents Love", author: Matt Pocock, url: "https://www.aihero.dev/how-to-make-codebases-ai-agents-love", updated: 2026-02-26, retrieved: 2026-09-27 }
  - { title: "Using Linters to Direct Agents", author: Alvin Sng (Factory), url: "https://factory.com/news/using-linters-to-direct-agents", published: 2025-09-05, retrieved: 2026-09-27 }
---

# Testing

The project's tools for each kind of test are named in its architecture map,
`docs/architecture.md`.

## From "Done when" to tests

An issue's "Done when" is the list of tests to write: one case, one test, named
after the case, so a reader can tick the issue off against the test names.

| The issue says | Write | Where |
|---|---|---|
| A table row (`Given` → `Expect`) about a rule, a route or a function | a unit or API test per row | next to the module it tests |
| A table row about what a component shows | a component test per row | next to the component |
| A scenario (`Given / When / Then`) | a browser test per scenario, named after its first line | the web app's `e2e/<feature>` |

## How tests are written

- **Test through the interface**: call the module, the route or the screen the
  way its user would. Component tests find controls by role and name, as a
  person does. A test that has to reach past the interface means the module has
  the wrong shape.
- **Each test starts from nothing**: a fresh database, no data or order shared
  with another test.
- **No network in unit and component tests**: replace the API client at its
  seam instead of mocking the network everywhere.
- **Time is given, not read**: code that needs "now" takes it as a parameter or
  from one clock module, so tests set it. Date logic is tested at fixed times,
  including just before and after midnight.
- **Never weaken or delete a test to make a check pass.** If a test is wrong, say
  why in the pull request.
