---
description: >
  Lets the agent run the app and look at it (#108). gh-aw's built-in Playwright
  tool installs `playwright-cli` and Chromium before the agent starts
  (.github/aw/playwright.md); the agent starts the dev server inside its own
  sandbox and reads each page as an accessibility snapshot. Snapshots, not
  screenshots: gh-aw declares Pi's model text-only (pi_models_json.cjs), so
  images would be dropped. Needs the app's dependencies installed
  (shared/node-runtime.md).

tools:
  playwright:
---

## Seeing the app

When the change touches `apps/web/`, look at the screens it changes (a shared
component: its stories in Storybook) before you finish. How to start them,
read them and stop them: `.github/pi/seeing-the-app.md`. Skip this for changes
with no screen. If the app does not start, say so in your output with the last
lines of its log; never skip it silently.
