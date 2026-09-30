---
description: >
  Node access, version and dev dependencies for the roles that write code
  (implement, rework, unblock) and for review, which runs the app to look at it
  (shared/browser.md). No `import-schema` parameter is needed.

  No `network` here, on purpose: `runtimes: node` already opens the npm
  registry, and an imported `network` makes gh-aw drop the importing
  workflow's `network.blocked` (v0.88.7 to v0.89.21, pkg/workflow/imports.go
  MergeNetworkPermissions keeps only `allowed`), which Review relies on.

runtimes:
  node:
    version: "24"

pre-agent-steps:
  # Install the dependencies and Playwright's Chromium before the agent starts,
  # so its pre-push check (verify.sh) runs every test, browser tests included:
  # the agent's firewall blocks the npm registry and browser downloads. The
  # workspace is shared with the agent's container, and the browser goes inside
  # node_modules (PLAYWRIGHT_BROWSERS_PATH=0), so the agent finds it there;
  # node_modules is git-ignored, so it survives branch checkouts.
  # Never fails the job: if this does not install, verify.sh installs itself.
  # Where the checkout has no lockfile yet (main before a release carries it),
  # there is nothing to install.
  - name: Install dev dependencies for the pre-push checks
    run: |
      if [ -f package-lock.json ]; then
        npm ci --ignore-scripts --no-audit --no-fund --loglevel=error \
          || echo "::warning::npm ci failed; verify.sh will install inside the agent"
        if [ -x node_modules/.bin/playwright ]; then
          PLAYWRIGHT_BROWSERS_PATH=0 npx playwright install --with-deps chromium \
            || echo "::warning::Playwright's browser did not install; browser tests will fail inside the agent"
        fi
      else
        echo "no package-lock.json in this checkout; nothing to install"
      fi
---
