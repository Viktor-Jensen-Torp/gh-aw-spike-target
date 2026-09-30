---
type: Convention
title: Requirements — Component
description: What a pull request for a Component issue (a shared UI component, built and shown in Storybook first) must prove before it merges. The reviewer returns a verdict on every row; the implementer builds to them. Part of the chain.
tags: [review, requirements, chain]
---

# Component: a shared UI component

Each row is met only when the proof is given: the file and line that show it.
Without proof a row is unproven, and an unproven row blocks like an unmet one.
A row marked `yes` under "n/a allowed" may be answered n/a when the issue
gives it nothing to check.

| ID | Requirement | Proof | n/a allowed |
|---|---|---|---|
| U1 | Every case under the issue's "Done when" has its own story, named after the case, whose `play` function checks its Expect (or Then) through roles and names | For each case: the story's name, file and line |  |
| U2 | Every state the claimed design parts show (default, error, disabled, open…) has a story | For each state: the story's name, file and line |  |
| U3 | No story turns the accessibility check off | The stories file, by its full path, with no `a11y` override in it |  |
| U4 | Sizes, colours and text come from the claimed parts' JSON through design tokens, never raw values | For each claimed part: file and line | yes |
| U5 | It reuses the existing shared components it contains instead of rebuilding them | The import of each one it contains | yes |
| U6 | It lives in its own folder under the web app's `src/components/`, passes native props through, and holds no API calls, dates or app state | The component's file and line |  |
| U7 | Everything the change adds is asked for by "What", "Details" or "Done when", and none of it is work "Out of scope" gives to another issue | For each story, prop or export the change adds: file and line, and the line of the issue that asks for it |  |
