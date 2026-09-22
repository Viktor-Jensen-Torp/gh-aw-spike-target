---
emoji: 🛠️
description: Implements a labelled issue as a pull request with tests.
intent: Turn an accepted issue into a reviewable pull request that passes the repository's checks, without a person writing the code.

on:
  label_command:
    name: implement
    events: [issues]

concurrency:
  job-discriminator: ${{ github.run_id }}

permissions:
  contents: read
  issues: read

engine:
  id: pi
  # Role for .github/pi/postconditions.cjs (installed by a pre-agent step).
  env:
    PI_ROLE: implement
model: anthropic/claude-haiku-4-5-20251001

network:
  allowed:
    - defaults
    - node

runtimes:
  node:
    version: "24"

pre-agent-steps:
  # Install the role-postconditions Pi extension for the agent run only.
  # Not via engine.args: those also reach the evals job, which has no checkout,
  # and Pi exits 1 on a missing --extension file (dist/main.js). Pi auto-loads
  # *.js from $PI_CODING_AGENT_DIR/extensions, which gh-aw sets to
  # /tmp/gh-aw/pi-agent-dir and never clears (pi_models_json.cjs only mkdirs).
  # The source is the base branch's copy: .github/ is restored from base before
  # these steps run (restore_base_github_folders.sh).
  - name: Install role postconditions extension
    run: |
      set -euo pipefail
      mkdir -p /tmp/gh-aw/pi-agent-dir/extensions
      cp .github/pi/postconditions.cjs /tmp/gh-aw/pi-agent-dir/extensions/postconditions.js
      echo "installed: $(wc -c < /tmp/gh-aw/pi-agent-dir/extensions/postconditions.js) bytes, role=$PI_ROLE"
    env:
      PI_ROLE: implement

tools:
  cli-proxy: true
  github:
    mode: gh-proxy
    toolsets: [issues, repos]
  # Pi does not support a bash allow-list (the compiler rejects one), so bash is
  # unrestricted inside the firewalled container. See FINDINGS.md.
  bash: ["*"]
  timeout: 300

safe-outputs:
  github-app:
    client-id: ${{ vars.IMPLEMENTER_CLIENT_ID }}
    private-key: ${{ secrets.IMPLEMENTER_APP_PRIVATE_KEY }}
  create-pull-request:
    draft: false
    title-prefix: "[implementer] "
    labels: [agent, needs-review]
    # Agent work targets `develop`, not `main`. Without this the base is
    # `github.ref_name`, which on an `issues` event is the default branch.
    base-branch: develop
    # Arm the merge at creation; the `develop gate` ruleset decides when it
    # happens (required checks: test, hold, Agent review). Established on
    # PR #14: arming is allowed while a required check is RED, and a check
    # going red pauses the pending merge rather than cancelling it, so the
    # reviewer's REQUEST_CHANGES → rework → green cycle needs nothing re-armed.
    # Squash because the ruleset allows only squash, and one issue per commit
    # on `develop` is what makes a revert cheap (../pi-github-test ADR 0011).
    # Note: arming is best-effort in gh-aw — a failure is only a warning and the
    # PR is still created, so a PR that never merges is a sweeper case.
    auto-merge: squash
    # gh-aw's glob compiles `src/**/*.js` to ^src/.*/[^/]*\.js$, which does NOT
    # match a file directly in src/. Use `src/**` for "everything under src/".
    allowed-files:
      - "src/**"
      - "test/**"
    # No github-token-for-extra-empty-commit: safe-outputs.github-app already
    # makes the branch push and the PR come from the implementer App, so CI
    # fires on `opened` by itself. The extra commit only added a second
    # `synchronize` event, doubling CI and reviewer runs. See FINDINGS.md.
  threat-detection:
    engine:
      id: claude
      model: claude-haiku-4-5-20251001
    # Strict mode. The default (true) lets safe outputs run when the detector
    # cannot return a verdict: the WTD policy in the safe-outputs spec is keyed
    # on conclusion == "warning", but an engine failure yields "failure", so
    # nothing gates the write. See FINDINGS.md, spike 2 run 1.
    continue-on-error: false
    # threat-detect's own default is 0, so one clean exit without a verdict is
    # terminal. Two retries absorb a flaky detector without weakening the gate.
    retries: 2
---

# Implement

## Task

Objective: turn the labelled issue into one pull request that satisfies it and
passes the repository's checks.

The triggering issue is #${{ github.event.issue.number }} in
${{ github.repository }}. Its sanitized title and body are:

"${{ steps.sanitized.outputs.text }}"

Work in this order:

1. Read the issue and the existing code under `src/` and `test/`. Read
   `package.json` for the commands this repository uses.
2. Make the smallest change that satisfies the issue. Touch only `src/**/*.js`
   and `test/**/*.js`.
3. Add or update tests for the behaviour you changed.
4. Run `npm test`. If it fails, fix the cause and run it again.
5. Open one pull request with `create_pull_request`. The body states what the
   issue asked for, what you changed, and the result of `npm test`.

Stop and call `noop` with a short reason, without opening a pull request, when:

- the issue does not describe a change to code under `src/` or `test/`;
- the change needed falls outside those paths;
- `npm test` still fails after your fix attempts.

Never edit files outside `src/` and `test/`, and do not change `package.json`
or anything under `.github/`.
