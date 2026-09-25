---
type: Convention
title: JavaScript conventions
description: How helpers are laid out, tested and exported in this repository.
tags: [javascript, src, test]
resource: ../../src
---

# JavaScript conventions

## One helper, one file

**Each exported helper lives in its own file under `src/`, named after it**, with
its tests alongside in `test/<name>.test.js`.

```
src/clamp.js        test/clamp.test.js
src/unique.js       test/unique.test.js
```

**Why this rule exists**, because it is not a style preference. Every helper used
to be added to `src/index.js`, which ends with one line listing them all:

```js
module.exports = { sum, movingAverage, unique };
```

Two agents adding two helpers both edit that line. Not occasionally — *every
time*. On 2026-09-22 three issues were implemented in parallel: one merged and
the other two collided, both on that line (stress test). At any real
parallelism a shared mutable list makes collisions the normal case rather than
the exception, and every collision then costs a repair, a re-review and a merge.

Separate files have nothing in common to collide over.

**Also checked by the lint rule** `local/one-helper-per-file`
(`.github/lint/rules/`): every `src/` file except `src/index.js` must define one
function named after the file and export exactly `module.exports = { <name> };`.
Run `npm run lint` to check, `npm run format` to fix formatting.

**Checked by** `.github/workflows/conventions.yml`, which fails a pull request
that adds a function to `src/index.js` or a name to its export line.

## Exports, and how a consumer reaches a helper

Each file exports exactly what it defines:

```js
/** Returns the value pulled inside [min, max]. */
function clamp(value, min, max) { /* … */ }

module.exports = { clamp };
```

**A consumer requires the file it wants, directly:**

```js
const { clamp } = require('./src/clamp.js');
```

**There is no barrel, and that is the point.** `src/index.js` stays as it is for
what is already there: do not add to it, and do not rewrite it to re-export the
new files. A file that lists every helper is the shared line this rule exists to
remove — re-creating it under another name brings the collisions straight back.

So "export it", in an issue, means **export it from its own file**. A helper is
finished when its own file exports it; nothing else needs to change for it to be
usable. Do not treat the absence of a central export as an unfinished job — it
is the convention working.

## Tests

Tests go in `test/<name>.test.js`, in the style of the existing ones
(`node:test` plus `node:assert`, one `test()` per case). **Every case in the
issue's "Done when" table or scenarios becomes a named test**, so the reviewer
can check them off one by one rather than forming an impression.

## Input validation

Reject arguments of the wrong shape with a `TypeError`, and out-of-range values
with a `RangeError`. Say which argument was wrong in the message.
