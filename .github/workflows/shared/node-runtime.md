---
description: >
  Node access, version and dev dependencies for the three roles that write
  code (implement, rework, unblock). Byte-identical in all three before this
  import existed, so no `import-schema` parameter is needed.

network:
  allowed:
    - defaults
    - node

runtimes:
  node:
    version: "24"

pre-agent-steps:
  # Install the dev tooling (ESLint, Prettier) before the agent starts, so its
  # pre-push check (verify.sh) finds node_modules ready instead of spending the
  # agent's time on `npm ci` mid-run. The workspace is shared with the agent's
  # container; node_modules is git-ignored, so it survives branch checkouts.
  # Never fails the job: if this does not install, verify.sh installs itself.
  # Where the checkout has no lockfile yet (main before a release carries it),
  # there is nothing to install.
  - name: Install dev dependencies for the pre-push checks
    run: |
      if [ -f package-lock.json ]; then
        npm ci --ignore-scripts --no-audit --no-fund --loglevel=error \
          || echo "::warning::npm ci failed; verify.sh will install inside the agent"
      else
        echo "no package-lock.json in this checkout; nothing to install"
      fi
---
