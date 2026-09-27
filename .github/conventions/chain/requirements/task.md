---
type: Convention
title: Requirements — Task
description: What a pull request for a Task issue (anything that is neither a Bug nor a Feature) must prove before it merges. The reviewer returns a verdict on every row; the implementer builds to them. Part of the chain.
tags: [review, requirements, chain]
---

# Task: everything else

Each row is met only when the proof is given: the file and line that show it.
Without proof a row is unproven, and an unproven row blocks like an unmet one.

| ID | Requirement | Proof |
|---|---|---|
| T1 | Every case under the issue's "Done when" has its own test, named after the case, of the kind `.github/conventions/chain/testing.md` maps it to | For each case: the test's name, file and line |
| T2 | Each of those tests asserts the case's Expect (or Then) through the interface, not how the code produces it | For each case: the assertion's file and line |
| T3 | Every boundary named under "Details" is handled in the code | For each boundary: file and line |
| T4 | The change does what "What" describes and touches nothing listed under "Out of scope" | Every changed file accounted for |
