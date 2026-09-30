---
type: Convention
title: Writing issues
description: How an issue is filled in so an agent can start without asking a question — Done when, design claims, dependencies, boundaries (Out of scope names neighbours by number), type, effort and priority. Read by everything that writes issues (the refiner, /decompose). Part of the chain.
tags: [issues, refinement, chain]
---

# Writing issues

The headings are fixed by the templates: `.github/ISSUE_TEMPLATE/work-item.md`
for work, `.github/ISSUE_TEMPLATE/epic.md` for an epic. This document is how to
fill them in. `.github/scripts/check-issue.sh` checks the shape; these rules are
the part a script cannot check.

An issue is **refined** when it is both:

- **Clear**: someone could start without asking a question. The behaviour
  wanted is stated, including what happens at the edges, and it says how anyone
  would know it works.
- **Small**: one pull request's worth, reviewable in one sitting.

## The body

- **Use the template's headings exactly**, in its order. Keep a heading empty
  only if you genuinely cannot fill it, and say why under it.
- **Keep the author's intent and their words.** You fill in what an implementer
  would otherwise have to ask; you do not rewrite their request into your own.
- **"Done when" is a table or scenarios, never both.** A table of inputs and
  expectations for a function, a calculation, a transform; scenarios (`Given`,
  `When`, `Then`) for a journey through a screen. Never a scenario for a pure
  function: it is longer and says less. Each case becomes a named test
  (`.github/conventions/chain/testing.md`), so write it as something a test
  could check.
- **Write only cases you can derive from the issue, the source or the code.** An
  invented case reads exactly like one the author asked for, and an implementer
  will build to it. If nothing settles what happens at a boundary, that is a
  question for the author, not a case to make up.
- **Cover the boundaries named under "Details"**: the empty case, the maximum,
  the bad input.

## Design claims

An issue built from a design names the parts it builds under "## Design", one
per line, as `` `path#id` `` and the part's name. Carry claims over exactly when
rewriting: they are how a design change finds the issue. Add or change one only
when the design moved.

## Dependencies

When an issue cannot finish without another, say so under "Details" as a line
`Depends on #N — why`, one per dependency. Record one only where the work
cannot finish without the other, not where it merely touches the same files.
The "blocked by" link follows from the line.

When a case needs something another issue builds, say how this issue's tests
get it without building it: "tests create sessions through the service; the
sign-up and sign-in routes are #176 and #177". Otherwise the implementer builds
the other issue's work to make its test pass (#168 built both routes, PR #194).

## Boundaries

An implementer sees only its own issue, so "Out of scope" is where it learns
what its neighbours will build. Name each piece of nearby work with the issue
that owns it, by number: "The sign-up and sign-in routes: #176, #177."
Neighbours are the other sub-issues of the same epic, the issues this one
blocks, and anything a line under "Details" mentions without asking for it.
Name the ones an implementer could plausibly build by mistake, not every
sibling. When nothing is nearby, write "Nothing nearby." `check-issue.sh`
refuses an "Out of scope" with neither. Keep the epic's own "Out of scope" as
well: it covers work no issue owns yet.

Everything under "Details" is part of the work: the reviewer checks each item,
not only the "Done when" cases. A line that is context, not work, says so ("for
context: …").

## Type, effort, priority

- **Type**: `Bug` for something behaving wrongly, `Feature` for new behaviour,
  `Component` for a shared UI component built and shown in Storybook first,
  `Task` for everything else. One always applies. An `Epic` is never built
  itself; its sub-issues are.
- **Effort**: `Low` for a change of a few lines in one file, `Medium` for one
  file's worth of real work, `High` for anything that would be too big if it
  were any bigger. A size estimate, not a promise.
- **Priority**: set only when the issue itself gives the evidence — it calls
  something broken, names a deadline, or the author said it is urgent — or a
  person decided it. Otherwise leave it unset: a priority an agent guessed makes
  the field mean nothing.
- **Never set the sprint or a milestone.** The sprint is the Project's `Sprint`
  field, decided by people at planning; milestones are releases.
