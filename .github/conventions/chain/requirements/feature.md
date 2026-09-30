---
type: Convention
title: Requirements — Feature
description: What a pull request for a Feature issue (new behaviour) must prove before it merges. The reviewer returns a verdict on every row; the implementer builds to them. Part of the chain.
tags: [review, requirements, chain]
---

# Feature: new behaviour

Each row is met only when the proof is given: the file and line that show it.
Without proof a row is unproven, and an unproven row blocks like an unmet one.
A row marked `yes` under "n/a allowed" may be answered n/a when the issue
gives it nothing to check.

| ID | Requirement | Proof | n/a allowed |
|---|---|---|---|
| F1 | Every case under the issue's "Done when" has its own test, named after the case, of the kind `.github/conventions/chain/testing.md` maps it to | For each case: the test's name, file and line |  |
| F2 | Each of those tests asserts the case's Expect (or Then) through the interface, not how the code produces it | For each case: the assertion's file and line |  |
| F3 | Every item under "Details" is done: each boundary (empty, maximum, bad input) is handled and each other instruction is followed. A line marked as context asks for nothing | For each item: file and line, or "context" | yes |
| F4 | Everything the change adds is asked for by "What", "Details" or "Done when", and none of it is work "Out of scope" gives to another issue | For each route, export, screen, story or table the change adds: file and line, and the line of the issue that asks for it |  |
| F5 | If the issue claims design parts, the built screen matches their JSON: text, sizes, colours | For each claimed part: file and line, or "no design claims" | yes |
