---
emoji: 🛠️
description: Implements a labelled issue as a pull request with tests.
intent: Turn an accepted issue into a reviewable pull request that passes the repository's checks, without a person writing the code.


inlined-imports: true

imports:
  - shared/model.md
  - shared/budget.md
  - shared/threat-detection.md
  - shared/graders.md
  - shared/node-runtime.md
  - uses: shared/github-app.md
    with:
      app_prefix: IMPLEMENTER
  - uses: shared/postconditions.md
    with:
      role: implement

on:
  label_command:
    name: implement
    events: [issues]

concurrency:
  job-discriminator: ${{ github.run_id }}

permissions:
  contents: read
  issues: read

# Agent work happens on `develop`, the untrusted integration branch, while
# `main` stays the default branch and the release target. GitHub loads an
# issue-triggered workflow's DEFINITION from the default branch and cannot be
# told otherwise, but the code the agent reads and edits is this checkout.
# Without it the implementer would write against `main` and open pull requests
# into `develop`, never seeing work it had already merged.
#
# Consequence (../pi-github-test ADR 0019, release skew): a pull_request
# workflow loads its definition from the branch under review, which comes off
# `develop`, while this one loads from `main`. Keep `.github/` identical on both
# branches and push workflow changes to both; never carry them through the
# develop -> main release.
checkout:
  ref: develop

engine:
  id: pi
  # Role for .github/pi/postconditions.cjs (installed by a pre-agent step).
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
  create-pull-request:
    draft: false
    title-prefix: "[implementer] "
    labels: [agent, needs-review]
    # Agent work targets `develop`, not `main`. Without this the base is
    # `github.ref_name`, which on an `issues` event is the default branch.
    base-branch: develop
    # Belt to that brace. On run 35806260362 the agent passed `main` as the base
    # itself — the repository default, which is the obvious guess and the wrong
    # answer — and gh-aw refused the whole pull request because per-run
    # overrides were not allowed. Naming the one permitted base turns a failed
    # run into a corrected one.
    allowed-base-branches: [develop]
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
---

# Implement

## Task

Objective: turn the labelled issue into one pull request that satisfies it and
passes the repository's checks.

The triggering issue is #${{ github.event.issue.number }} in
${{ github.repository }}. Its sanitized title and body are:

"${{ steps.sanitized.outputs.text }}"

Work in this order:

1. **Read `.github/conventions/index.md` first, and then the document it points
   at for the kind of change this is.** It is not background reading: it states
   how code is laid out here, and a pull request that ignores it fails the
   `conventions` check and cannot merge. Then read the issue and the existing
   code under `src/` and `test/`, and `package.json` for the commands this
   repository uses.
2. Make the smallest change that satisfies the issue, following those
   conventions. Touch only `src/**/*.js` and `test/**/*.js`.
3. Add or update tests for the behaviour you changed.
4. Run `npm test`. If it fails, fix the cause and run it again.
5. Run `bash .github/scripts/check-conventions.sh origin/develop`. **If it
   fails, fix what it names and run it again** — it is the same check that gates
   the pull request, so a breach you leave here comes back as a rejected review,
   a rework round and a second review. Fixing it now costs nothing; fixing it
   later costs three runs.
6. Open one pull request with `create_pull_request`. The body states what the
   issue asked for, what you changed, and the result of `npm test`.
   **Do not set a base branch.** This workflow already targets `develop`, the
   branch agent work merges into; `main` is the release branch and a pull
   request against it will be refused.
7. **Then stop.** Do not inspect the result — no `git log`, no `git status`, no
   `ls` to confirm the commit, no reading the pull request back. gh-aw pushes
   the branch and opens the pull request after your run ends, so the working
   directory you would be looking at cannot show you the outcome either way:
   a clean check and a broken one look identical from in here. On run
   35874352977 the implementer spent four calls doing exactly this and learned
   nothing. If the write fails, the run fails and the sweeper picks it up.

Stop and call `noop` with a short reason, without opening a pull request, when:

- the issue does not describe a change to code under `src/` or `test/`;
- the change needed falls outside those paths;
- `npm test` still fails after your fix attempts.

Never edit files outside `src/` and `test/`, and do not change `package.json`
or anything under `.github/`.
