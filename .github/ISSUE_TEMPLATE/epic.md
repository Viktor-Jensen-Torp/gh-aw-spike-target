---
name: Epic
about: A feature too big for one pull request, split into sub-issues. Never built directly.
title: ""
labels: []
---

<!--
The shape of an epic. An epic is never implemented itself: its sub-issues are,
each one a work item (work-item.md). It closes when they are all done.

Set the issue type to Epic. Add the pieces as native sub-issues, and set
"blocked by" between them where one needs another first.
-->

## Goal

What is true for a user when this whole epic is done, in a sentence or two.

## Sources

Where the decisions live, as paths in this repository: the design file, the
ADRs. When one of these changes, its sub-issues are checked again.

- `design/…`
- `docs/adr/…`

## Out of scope

What this epic deliberately does not cover, so a sub-issue does not grow into it.

## Sub-issues

Listed by GitHub under this issue. Add them there, not here.
