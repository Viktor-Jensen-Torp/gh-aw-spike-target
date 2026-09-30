---
name: Work item
about: Something you want built or changed. Rough is fine — add needs-refinement and the refiner fills in the gaps overnight.
title: ""
labels: []
---

<!--
This is the shape of a refined issue. Write as much or as little as you like.
Without a stage label an issue is a draft, and nothing touches it. Add
`needs-refinement` when you want the refiner to fill in the gaps; it marks the
issue `refined`, and you set `ready` once you agree. `paused` stops it wherever
it is.

The refiner reads THIS FILE to know what a refined issue looks like, so these
headings are the single definition of "refined". Change them here and the
refiner follows.
-->

## What

The behaviour you want, in a sentence or two. What should be true afterwards
that is not true now.

## Why

The reason, so whoever implements it can judge a trade-off without asking.

## Details

The boundaries: what happens at zero, at the maximum, on bad input, on an empty
list. Anything you already know the answer to and would otherwise be asked.

## Done when

The cases that have to hold. Each one becomes a named test, so write them as
things a test could check, not as a feeling of completeness.

Pick the shape that fits the work — do not use both:

**A table, for anything with inputs and outputs.** A function, a calculation, a
transform. Most work here is this shape.

| Given | Expect |
|---|---|
| `truncate("hello world", 8)` | `"hello w…"` — 8 characters, ellipsis included |
| `truncate("hello", 5)` | `"hello"` — exactly the limit already fits |
| `truncate("x", 0)` | throws `RangeError` |

**Scenarios, for anything with steps and state.** A journey through a screen, a
flow with a before and after. These map onto browser tests directly, so write
them the way a test would read.

```gherkin
Given I am signed out
When I open the dashboard
Then I am sent to the sign-in page
And the dashboard is not rendered
```

Use a table for a function and scenarios for a journey. A pure function has no
"given I am…" state to set up, and a scenario written for one is longer and
says less. A journey written as a table loses the ordering that is the whole
point.

Cover the boundaries you named in **Details**: the empty case, the maximum, the
bad input. A case nobody could check is not a case.

## Design

Optional. The parts of a design file this issue builds, one per line, as
`path#id` and the part's name: `` `design.pen#MJtCe` State — Delete Confirmation ``.
A change inside one of these sends this issue back to refinement; a part no
issue claims is not built yet.

## Out of scope

Nearby work this issue does not do, and which issue does it, by number: "The
sign-up and sign-in routes: #176, #177." Name every neighbour an implementer
might build by mistake: siblings in the same epic, issues this one blocks, work
a line under "Details" mentions in passing. If nothing is nearby, write "Nothing
nearby." Anything else deliberately left out goes here too.
