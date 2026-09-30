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

pre-agent-steps:
  # gh-aw installs the browser under $RUNNER_TEMP/gh-aw/playwright-browsers
  # (fixed in v0.89.17, #61423; before it the path was not expanded and no agent
  # could open a browser, review run 36675018713). Say before the agent starts
  # whether a browser opens, so a broken install shows in the log, not as an
  # agent that silently skips looking at the app.
  - name: Check that playwright-cli opens a browser
    run: |
      if PLAYWRIGHT_BROWSERS_PATH="$RUNNER_TEMP/gh-aw/playwright-browsers" playwright-cli open about:blank >/dev/null 2>&1; then
        PLAYWRIGHT_BROWSERS_PATH="$RUNNER_TEMP/gh-aw/playwright-browsers" playwright-cli close >/dev/null 2>&1 || true
        echo "playwright-cli opens a browser"
      else
        echo "::warning::playwright-cli cannot open a browser; the agent will not be able to look at the app"
      fi
---

## Seeing the app

When the change touches `apps/web/`, look at the screens it changes (a shared
component: its stories in Storybook) before you finish. How to start them,
read them and stop them: `.github/pi/seeing-the-app.md`. Skip this for changes
with no screen. If the app does not start, say so in your output with the last
lines of its log; never skip it silently.
