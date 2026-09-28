---
type: Convention
title: Web app
description: How the React app is built: components, data from the API, routing, forms, styling and accessibility. Read when touching apps/web.
tags: [web, react, tailwind]
resource: ../../apps/web
---

# Web app

## Data comes through one client

All calls to the API go through `apps/web/src/lib/api-client.ts`, which parses
every response with its schema from `@tempo/shared`. Components and hooks never
call `fetch` themselves. **Checked by** lint (`no-restricted-globals: fetch`
outside the client).

**Why:** one seam to replace in tests, one place where the contract is enforced,
and a response that does not match its schema fails loudly instead of rendering
wrong.

## Components

- Screens are built from the shared components (`components.md`): reuse one,
  never rebuild it inside a feature. A part the design repeats that has no
  shared component yet is a `Component` issue first.
- A feature's screen state lives in a hook next to it (`use-tasks.ts`); the
  component renders what the hook returns. Keep components free of API and
  date logic, so the logic is tested without rendering.
- Every screen state the design shows (loading, empty, error, disabled) is a
  state the component can be put in, and a test puts it there.
- Routing uses React Router: every screen is one entry in
  `apps/web/src/routes.tsx`, and its component lives in its feature folder.

## Forms

Validate with the same schema the API uses (`@tempo/shared`), so the form and
the API refuse the same things with the same messages. Show errors where the
design shows them, on the field, in the design's words.

## Styling

- Tailwind classes only, with the design's colours and font through the theme.
  The design's variables map to tokens: `$bg` → `bg-bg`, `$surface` →
  `bg-surface`, `$border` → `border-border`, `$text` → `text-text`, `$muted` →
  `text-muted`, `$faint` → `text-faint`, `$accent` → `bg-accent` /
  `text-accent`, `$accent-soft` → `bg-accent-soft`, `$danger` → `text-danger`,
  `$font` → Inter. No raw colour values in components. **Checked by** lint (no
  hex or `rgb()` in class names or styles).
- Copy text exactly as the design writes it, punctuation included.

## Accessibility

Controls are real elements (`button`, `input`, `label`), and every control has an
accessible name. Keyboard shortcuts the design shows (`⌘ N`) work. **Checked by**
lint (`jsx-a11y-x`), and by tests that find controls by role and name.
