---
type: Convention
title: Building from the design
description: How to use the design parts an issue claims and their exact values. Part of the chain; read when an issue has a "## Design" section.
tags: [design, pen, chain]
---

# Building from the design

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
