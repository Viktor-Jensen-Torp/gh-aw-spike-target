---
type: Convention
title: Structure
description: How code is grouped, how modules and files are shaped, and how code imports other code. Part of the chain; read for every change.
tags: [structure, modules, imports, chain]
references:
  - { title: "How To Make Codebases AI Agents Love", author: Matt Pocock, url: "https://www.aihero.dev/how-to-make-codebases-ai-agents-love", updated: 2026-02-26, retrieved: 2026-09-27 }
  - { title: "Using Linters to Direct Agents", author: Alvin Sng (Factory), url: "https://factory.com/news/using-linters-to-direct-agents", published: 2025-09-05, retrieved: 2026-09-27 }
  - { title: "Harness engineering: leveraging Codex in an agent-first world", author: Ryan Lopopolo, url: "https://openai.com/index/harness-engineering/", published: 2026-02-11, retrieved: 2026-09-27 }
  - { title: "Harness engineering for coding agent users", author: Birgitta Böckeler, url: "https://martinfowler.com/articles/harness-engineering.html", published: 2026-04-02, retrieved: 2026-09-27 }
  - { title: "Set up Claude Code in a monorepo or large codebase", url: "https://code.claude.com/docs/en/large-codebases", retrieved: 2026-09-27 }
---

# Structure

Where this project's workspaces and features are: its architecture map,
`docs/architecture.md`.

## Feature folders

Code is grouped by what it does for a user, not by what kind of file it is:

```
apps/web/src/features/<feature>/     components, hooks, their tests
apps/api/src/features/<feature>/     routes, rules, data access, their tests
packages/<shared>/src/<feature>.ts   what both sides share for that feature
```

A piece of work mostly stays inside one feature folder per workspace. Code used
by two or more features moves to that workspace's `src/lib/`, and only then.

**Why:** an issue is one behaviour end to end; when its code sits together, an
agent finds all of it by path, and two issues in parallel rarely touch the same
files.

## Modules: small interface, real work behind it

A module is a file or a feature folder with a few exports that do a lot. Prefer
one deeper module over several files that only pass calls through. Before adding
a file, ask what a caller would lose if it did not exist; if nothing, fold it in.
Split a module when it has two reasons to change, not when it grows.

- One UI component per file, named after it (`TaskRow.tsx`).
- Other files are kebab-case, named after what they do (`use-tasks.ts`).
- Files stay under 300 lines. **Checked by** lint (`max-lines`).

## Imports

- **Named exports only**, so a search for a name finds every use. **Checked by**
  lint (`import/no-default-export`; framework entry files are the exceptions,
  and the lint config names them).
- **No barrel files**: no `index.ts` that only re-exports. Import from the file
  that defines the thing. **Checked by** lint. Barrels are where parallel changes
  collide, and they hide where code lives.
- **Between workspaces, by package name**, never by a relative path into another
  workspace. **Checked by** lint (`import/no-relative-packages`).
- **No import cycles.** **Checked by** lint (`import/no-cycle`).
- **Only declared dependencies**: import a package only if the importing
  workspace declares it. **Checked by** lint (`import/no-extraneous-dependencies`).

Dependencies, configuration and CI are people's work: package manifests,
lockfiles and `.github/` cannot be changed by an agent (gh-aw protected files).
If a change needs a new dependency, say so in the pull request instead.

## Code comes with tests, the map comes with features

- A change to source files changes or adds a test that proves it. **Checked by**
  the `conventions` check. Which test: [testing.md](testing.md).
- A change that adds, renames, moves or removes a feature folder updates the
  project's `docs/architecture.md` in the same pull request. **Checked by** the
  `conventions` check.
