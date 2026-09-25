---
type: ConventionIndex
title: Conventions
description: What agents must read before writing code here, and which document applies to what.
tags: [conventions, agents]
---

# Conventions

Each document here states how work of a particular kind is done in this
repository. An agent reads the one that applies **before** it writes anything;
the reviewer checks against the same document afterwards. One source, two
consumers, so the rule and the check cannot drift apart.

The shape is markdown with YAML frontmatter and a required `type` — the Open
Knowledge Format v0.2. That costs nothing here, because every workflow and
template in this repository is already markdown with frontmatter, and it keeps
the option of other tools reading these documents later. It is **not** a
dependency: nothing in the pipeline requires an OKF parser.

| Document | Applies to |
|---|---|
| [javascript.md](javascript.md) | Any change under `src/` or `test/` |

## A convention is only real if something fails

Everything here that can be checked mechanically **is** checked, and the check is
named next to the rule. Written instructions are not enough on their own: the
refiner ignored a bolded, reasoned instruction three runs in a row
(2026-09-22). Prose tells an agent what to aim for; a failing check is what makes
it true.
