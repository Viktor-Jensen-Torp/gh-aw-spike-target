---
type: Convention
title: Building from the design
description: How a pen design file is built, and how to use the design parts an issue claims and their exact values. Part of the chain; read when an issue has a "## Design" section, or when refining or decomposing from a design.
tags: [design, pen, chain]
---

# Building from the design

## How a pen file is built

A `.pen` file is JSON: a tree of elements, each with a stable `id` (it never
changes when the element is edited or moved) and a `name` that says what it is.

- **Top-level children are frames and components.** A frame is a screen or a
  state of one ("Auth — Sign In Error"); a component (`"reusable": true`) is a
  shared part ("Form Field / Text", "Menu Item").
- **A component is used through a `ref`:** `{"type": "ref", "ref": "<component
  id>"}` stands where the component appears, with its own `id` and any
  overrides (`descendants`, keyed by id path). Two screens using the Text field
  hold two refs with different ids, both pointing at one component. Claim the
  component to build it, and the screen to build the screen.
- **Variables are tokens:** `"variables"` maps a name to a value; elements refer
  to them as `$name`. Each has a theme token in `apps/web/src/index.css`, and a
  test keeps the two equal, so a token change lands with its theme change.
- **Scripts** (`.github/scripts/`): `design-part.sh <pen> <id>` prints one part
  with every component resolved in place; `design-diff.sh <old> <new>` lists
  what changed, element by element; `design-impact.sh` maps those changes to
  the issues whose claims they touch, through the components each part uses;
  `design-claims.sh <pen>` lists every frame with the issues claiming it.

An issue names the design parts it builds under "## Design", as
`<path>.pen#<id>`. Before you start, those parts are extracted for you:

- `/tmp/gh-aw/agent/design/index.md` lists them;
- `/tmp/gh-aw/agent/design/<id>.json` holds each part exactly: sizes, spacing,
  colours, text and the elements inside it, each with a `name` that says what it
  is. An element with `"component": {"id", "name"}` is a use of a shared
  component, shown with this use's own text and settings;
- `/tmp/gh-aw/agent/design/variables.json` holds the values parts refer to as
  `$name` (for example `$accent`).

Read them with `jq`. They are the specification; the images in the issue show the
same parts, for people.

## Turning the design into code

- **Variables are theme tokens.** Each design variable has a token in the
  project's theme (the mapping is in the project's web document). Use the token,
  never the value.
- **Sizes and spacing** come from the part's JSON: `gap`, `padding`, `width`,
  `height`, `cornerRadius`. Use the theme's step that matches the value; a value
  with no step is a reason to check the design again, not to invent one.
- **Text** is copied exactly, punctuation included.
- **A component is built once.** Where the part uses a component, use the
  project's existing component for it; what differs between uses (text, colour,
  a hidden part) becomes that component's props or variants, not a copy.
- **Build only what the issue claims.** A part the issue lists under "Out of
  scope" is hidden, not built half-way, even when it appears in the design.

Design files are people's: an agent never edits them.
