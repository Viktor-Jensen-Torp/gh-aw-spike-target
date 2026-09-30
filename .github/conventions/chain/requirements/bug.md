---
type: Convention
title: Requirements — Bug
description: What a pull request for a Bug issue (something behaving wrongly) must prove before it merges. The reviewer returns a verdict on every row; the implementer builds to them. Part of the chain.
tags: [review, requirements, chain]
---

# Bug: something behaving wrongly

Each row is met only when the proof is given: the file and line that show it.
Without proof a row is unproven, and an unproven row blocks like an unmet one.
A row marked `yes` under "n/a allowed" may be answered n/a when the issue
gives it nothing to check.

| ID | Requirement | Proof | n/a allowed |
|---|---|---|---|
| B1 | A test reproduces the reported failure: it uses the input or steps from the issue and asserts the correct behaviour, so it would fail without the fix | The test's name, file and line, and the input it uses |  |
| B2 | The fix changes the code that caused the failure, not a symptom elsewhere | File and line of the cause, and one sentence on why it failed |  |
| B3 | Every case under the issue's "Done when" has its own test, named after the case | For each case: the test's name, file and line |  |
| B4 | Nothing changes beyond the fix: everything the change adds is asked for by "What", "Details" or "Done when", and none of it is work "Out of scope" gives to another issue | For each route, export, screen, story or table the change adds: file and line, and the line of the issue that asks for it |  |
| B5 | Every item under "Details" is done: each boundary (empty, maximum, bad input) is handled and each other instruction is followed. A line marked as context asks for nothing | For each item: file and line, or "context" | yes |
