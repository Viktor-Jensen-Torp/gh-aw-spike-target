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

When the change touches `apps/web/`, run the app and look at the screens it
changes. Skip this for changes that have no screen.

```bash
DATABASE_URL=:memory: npm run dev > /tmp/app.log 2>&1 & echo $! > /tmp/app.pid
curl --fail --silent --retry 20 --retry-connrefused --retry-all-errors \
  --retry-max-time 60 http://127.0.0.1:5173/ >/dev/null \
  || { echo "THE APP DID NOT START"; tail -n 40 /tmp/app.log; }
playwright-cli open --browser=chromium "http://127.0.0.1:5173/"
playwright-cli snapshot
```

- The snapshot is the page as text: roles, names and text, with refs you can
  `playwright-cli click` or `fill`. Check what you see against the issue's
  "Done when", and against `/tmp/gh-aw/agent/design/` when it exists.
- If the app does not start, say so in your output (the pull request or review
  body) with the last lines of `/tmp/app.log`. Never skip this silently.
- Before running `verify.sh` and before you finish, close the browser and stop
  what you started, by the process id you saved:

  ```bash
  playwright-cli close
  kill "$(cat /tmp/app.pid)" "$(cat /tmp/storybook.pid)" 2>/dev/null || true
  ```

  A server left running changes what the browser tests start. Never stop
  processes by name (`pkill`, `killall`, `pgrep`): your own agent process
  matches too, and on review run 36465779257 that ended the run. The pipeline
  refuses those commands.

**A shared component** (`src/components/`) is looked at in Storybook, one story
at a time, instead of in the app:

```bash
npm run storybook > /tmp/storybook.log 2>&1 & echo $! > /tmp/storybook.pid
curl --fail --silent --retry 30 --retry-connrefused --retry-all-errors \
  --retry-max-time 90 http://127.0.0.1:6006/ >/dev/null \
  || { echo "STORYBOOK DID NOT START"; tail -n 40 /tmp/storybook.log; }
playwright-cli open --browser=chromium "http://127.0.0.1:6006/iframe.html?id=<story-id>&viewMode=story"
playwright-cli snapshot
```

A story's id is its title and name in kebab case, joined by `--`
(`components-button--with-icon`); the list is at
`http://127.0.0.1:6006/index.json`.
