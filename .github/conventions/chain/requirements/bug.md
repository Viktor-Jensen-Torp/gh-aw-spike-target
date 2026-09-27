---
type: Convention
title: Requirements — Bug
description: What a pull request for a Bug issue (something behaving wrongly) must prove before it merges. The reviewer returns a verdict on every row; the implementer builds to them. Part of the chain.
tags: [review, requirements, chain]
---

# Bug: something behaving wrongly

Each row is met only when the proof is given: the file and line that show it.
Without proof a row is unproven, and an unproven row blocks like an unmet one.

| ID | Requirement | Proof |
|---|---|---|
| B1 | A test reproduces the reported failure: it uses the input or steps from the issue and asserts the correct behaviour, so it would fail without the fix | The test's name, file and line, and the input it uses |
| B2 | The fix changes the code that caused the failure, not a symptom elsewhere | File and line of the cause, and one sentence on why it failed |
| B3 | Every case under the issue's "Done when" has its own test, named after the case | For each case: the test's name, file and line |
| B4 | Nothing changes beyond the fix | Every changed file accounted for |
