---
type: Convention
title: Shared components
description: How the web app's shared UI components are built, shown and tested — one folder each, shadcn-style variants, composition, tokens, and a Storybook story per state that doubles as its test. Read when touching a shared component or building a screen from them.
tags: [web, components, storybook, shadcn]
references:
  - { title: "shadcn/ui", url: "https://ui.shadcn.com/docs", retrieved: 2026-09-28 }
  - { title: "Storybook: Writing stories", url: "https://storybook.js.org/docs/writing-stories", retrieved: 2026-09-28 }
  - { title: "Storybook: Vitest addon", url: "https://storybook.js.org/docs/writing-tests/integrations/vitest-addon", retrieved: 2026-09-28 }
---

# Shared components

A screen is built from shared components. A component is finished, in every
state the design gives it, before a screen uses it; a screen never builds its
own copy of one.

## Where they live

- One folder per component: `apps/web/src/components/<Name>/`, holding
  `<Name>.tsx` and `<Name>.stories.tsx`. Import it by that file's path; there
  are no `index.ts` re-exports (lint, `no-barrel-files`).
- Before building anything, look in the web app's `src/components/` for what
  exists and reuse it. A component that needs a new variant gets it in its own
  folder, not a copy elsewhere.
- The class-merging helper `cn` is in the web app's `src/lib/utils.ts`.

## How they are written

The shadcn/ui way, which is also how agents know it best:

- **Behaviour from Radix** (the `radix-ui` package) wherever the design has an
  interactive pattern it covers: menus, dialogs, checkboxes, popovers. Keyboard
  and screen-reader behaviour then come built in. A plain element needs none.
- **Variants with `cva`** (`class-variance-authority`); classes combined with
  `cn`, so a caller's `className` wins over the defaults.
- **Composition over configuration**: `children`, and `asChild` (Radix `Slot`)
  to render as another element. Add a prop only for a real variant the design
  shows.
- **Native props pass through**: a `Button` takes everything a `button` does,
  `ref` included (a plain prop in React 19).
- **Design tokens only** (`web.md`, "Styling"); sizes from the claimed parts'
  JSON. Icons from `lucide-react`.
- **No API calls, dates or app state.** A component renders what it is given.

## Stories are its tests

Each state the design shows is one story. Its `args` put the component in that
state; its `play` function acts (clicks, types, keys) and asserts, with
`expect` and `within` from `storybook/test`. A "Done when" case is a story named
after it (`.github/conventions/chain/testing.md`).

Every story runs as a test in a real browser (Storybook's Vitest addon, inside
`npm test`, so `verify.sh` runs it), and every story passes the accessibility
check (Storybook's a11y addon, set to fail). Never turn that check off for a
story.

Run `npm run storybook` to see them: <http://127.0.0.1:6006>.
