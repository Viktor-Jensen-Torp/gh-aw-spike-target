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
  # gh-aw v0.88.7 installs the browser with `PLAYWRIGHT_BROWSERS_PATH:
  # ${RUNNER_TEMP}/gh-aw/playwright-browsers` in a step's `env:`, which GitHub
  # Actions does not expand (pkg/workflow/playwright_cli.go:35). The browser
  # lands in a folder literally named `${RUNNER_TEMP}` inside the checkout, and
  # playwright-cli, which looks in the real one, finds nothing: no agent could
  # open a browser (review run 36675018713, call 15). Move it where it is looked
  # for, and say whether a browser now opens. Remove once gh-aw fixes it (#163).
  - name: Put Playwright's browser where playwright-cli looks for it
    run: |
      WRONG="$GITHUB_WORKSPACE/\${RUNNER_TEMP}/gh-aw/playwright-browsers"
      RIGHT="$RUNNER_TEMP/gh-aw/playwright-browsers"
      if [ -d "$WRONG" ]; then
        mkdir -p "$RIGHT" && cp -a "$WRONG"/. "$RIGHT"/ && rm -rf "$GITHUB_WORKSPACE/\${RUNNER_TEMP}"
        echo "moved the browsers to $RIGHT"
      fi
      if PLAYWRIGHT_BROWSERS_PATH="$RIGHT" playwright-cli open about:blank >/dev/null 2>&1; then
        PLAYWRIGHT_BROWSERS_PATH="$RIGHT" playwright-cli close >/dev/null 2>&1 || true
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
