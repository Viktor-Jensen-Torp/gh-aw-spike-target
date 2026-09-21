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
model: anthropic/claude-haiku-4-5-20251001

network:
  allowed:
    - defaults
    - node

runtimes:
  node:
    version: "24"

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
    # gh-aw's glob compiles `src/**/*.js` to ^src/.*/[^/]*\.js$, which does NOT
    # match a file directly in src/. Use `src/**` for "everything under src/".
    allowed-files:
      - "src/**"
      - "test/**"
    github-token-for-extra-empty-commit: app
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
