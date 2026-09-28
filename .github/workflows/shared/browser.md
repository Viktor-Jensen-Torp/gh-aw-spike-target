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
DATABASE_URL=:memory: npm run dev > /tmp/app.log 2>&1 &
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
- Before running `verify.sh` and before you finish: `playwright-cli close`, then
  `pkill -f 'concurrently|vite|tsx watch' || true`. A server left running
  changes what the browser tests start.
