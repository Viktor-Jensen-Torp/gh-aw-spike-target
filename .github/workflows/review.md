---
emoji: "🔎"
description: Critical line-level review of a pull request's diff, ending in one COMMENT or REQUEST_CHANGES review.
intent: Give an agent-authored pull request a review a maintainer would trust, without a person reading the diff first.


inlined-imports: true

imports:
  - shared/model.md
  - shared/budget.md
  - shared/threat-detection.md
  - shared/graders.md
  - uses: shared/github-app.md
    with:
      app_prefix: REVIEWER
  - uses: shared/postconditions.md
    with:
      role: review
  - shared/design-context.md
  # The linked issue and the requirements for its type, as files. A person's
  # pull request may link no issue; it is then reviewed without requirements.
  - uses: shared/issue-context.md
    with:
      required: false
  # Runs the app for the reviewer to look at (#108); browser.md needs the
  # dependencies node-runtime.md installs.
  - shared/node-runtime.md
  - shared/browser.md
  # The diff, metadata and existing review comments, pre-fetched so the agent
  # spends no turns on it. gh-aw's own copy, taught to read a dispatched `pr`.
  - shared/pr-context.md

# A pull request is reviewed when it opens or gets new commits, and on
# dispatch (.github/scripts/dispatch.sh): the sweeper sends a review that never
# came, the unblocker one after its conflict fix. No label starts a review.
on:
  pull_request:
    types: [opened, synchronize, reopened]
    # Agent pull requests only. The release pull request (`develop -> main`) is a
    # different job — a day's work rather than one change — and is read by
    # release-review.md. Without this filter that reviewer and this one would
    # both run on it, and this one's 2000-line diff cap and 10-comment budget
    # are shaped for a single small change.
    branches: [develop]
  workflow_dispatch:
    inputs:
      pr:
        description: "Number of the pull request to review"
        required: true
        type: string
      sha:
        description: "Head commit the dispatcher saw (optional; the current head is reviewed)"
        required: false
        type: string
  # The implementer App opens agent pull requests and pushes to them (rework).
  # A dispatch made with GITHUB_TOKEN runs as github-actions[bot]. Neither has a
  # repository role, and with `pull_request` among the triggers gh-aw checks
  # roles on every event, dispatch included (role_checks.go).
  bots: [gh-aw-spike-implementer, github-actions]
  permissions:
    pull-requests: read
  # A paused pull request is left exactly where it is; when `paused` comes off,
  # the sweeper's no-verdict check sends the review again. A dispatch carries no
  # labels, so this reads them.
  steps:
    - name: Decide whether to review
      id: gate
      env:
        GH_TOKEN: ${{ github.token }}
        REPO: ${{ github.repository }}
        PR: ${{ github.event.pull_request.number || github.event.inputs.pr }}
      run: |
        set -euo pipefail
        J=$(gh api "repos/$REPO/pulls/$PR" --jq '{state, base: .base.ref, labels: [.labels[].name]}')
        if [ "$(jq -r .state <<<"$J")" != open ]; then echo "#$PR is not open"; echo "proceed=false" >> "$GITHUB_OUTPUT"
        elif [ "$(jq -r .base <<<"$J")" != develop ]; then echo "#$PR does not target develop"; echo "proceed=false" >> "$GITHUB_OUTPUT"
        elif jq -e '.labels | index("paused")' <<<"$J" >/dev/null; then echo "#$PR is paused"; echo "proceed=false" >> "$GITHUB_OUTPUT"
        else echo "proceed=true" >> "$GITHUB_OUTPUT"; fi

run-name: "Review #${{ github.event.pull_request.number || github.event.inputs.pr }}"

if: needs.pre_activation.outputs.proceed == 'true'

# One review per pull request at a time; a newer commit or a dispatch replaces
# one in flight (gh-aw's default for pull requests, extended to the dispatch).
concurrency:
  group: "gh-aw-${{ github.workflow }}-${{ github.event.pull_request.number || github.event.inputs.pr }}"
  cancel-in-progress: true
  # The compiler gives dispatched runs' agent and conclusion jobs one shared
  # slot unless told apart (reference/concurrency.md, job-discriminator).
  job-discriminator: ${{ github.event.pull_request.number || github.event.inputs.pr }}

permissions:
  contents: read
  pull-requests: read

engine:
  id: pi
  # Role for .github/pi/postconditions.cjs (installed by a pre-agent step).
  env:
    PI_ROLE: review

# Warm the pre-fetch across re-reviews of the same head commit.
cache:
  key: pr-prefetch-${{ github.event.pull_request.head.sha || github.event.inputs.sha || github.run_id }}
  path: /tmp/gh-aw/agent

tools:
  cli-proxy: true
  github:
    mode: gh-proxy
    # Only act on trusted content. Our own PRs are non-fork on a public repo,
    # which is `approved`; this is also the runtime default for public repos.
    min-integrity: approved
    toolsets: [pull_requests, repos]
  comment-memory:
    memory-id: review

safe-outputs:
  create-pull-request-review-comment:
    # Matches gh-aw's own reviewer. Comments beyond max are silently skipped
    # (create_pr_review_comment.cjs), so a low cap can drop a real finding.
    max: 10
    side: "RIGHT"
  submit-pull-request-review:
    max: 1
    # GITHUB_TOKEN cannot APPROVE; see gh-aw's pr-reviewer guide.
    allowed-events: [COMMENT, REQUEST_CHANGES]
    supersede-older-reviews: true
  # The verdict as a status check, so a ruleset can require it before merge.
  # Needs checks:write on the reviewer App. Keep `name` stable: rulesets match
  # required checks by name (.github/aw/pr-reviewer.md).
  create-check-run:
    name: "Agent review"
    max: 1
    # Required: without a target the check lands on GITHUB_SHA, which on a
    # dispatched run is the tip of `main`, not the pull request; with one it
    # looks up the pull request's head (create_check_run.cjs).
    target: triggering
  noop:
  # The verdict per requirement, as data rather than prose. gh-aw validates it
  # against this schema and appends it to the review body as a JSON block
  # ("Structured data:", safe_output_type_validator.cjs), where the routing step
  # below reads it. The agent does not choose the outcome; the rows do.
  data:
    type: object
    additionalProperties: false
    required: [requirements]
    properties:
      requirements:
        type: array
        items:
          type: object
          additionalProperties: false
          required: [id, status, evidence]
          properties:
            id: { type: string, minLength: 2, maxLength: 4 }
            status: { type: string, enum: [met, unmet, unproven, n/a] }
            evidence: { type: string, minLength: 3, maxLength: 1000 }

# The rework loop is driven from the review that was actually posted, not from
# the agent remembering to label. On run 35555162071 the agent submitted
# REQUEST_CHANGES and simply skipped the add_labels step, so the loop never
# started. Anything the pipeline depends on must not live in a prompt step.
#
# conclusion runs after safe_outputs, so by here the review exists.
jobs:
  conclusion:
    # The routing step dispatches rework with GITHUB_TOKEN: neither App has the
    # Actions permission (org installations API, 2026-09-29), and gh-aw merges
    # this into the job's permissions.
    permissions:
      actions: write
    pre-steps:
      - uses: actions/create-github-app-token@v3
        id: label_token
        with:
          client-id: ${{ vars.REVIEWER_CLIENT_ID }}
          private-key: ${{ secrets.REVIEWER_APP_PRIVATE_KEY }}
      # Route on the CHECK RUN, not the review state. On run 35598277469 the
      # agent wrote "REQUEST_CHANGES" in the review text and posted a red
      # check, but called submit_pull_request_review without an `event`
      # field; gh-aw silently defaulted it to COMMENT (pr_review_buffer.cjs),
      # the review posted as COMMENTED, and rework never fired. The check run
      # is also what a ruleset gates merge on, so one signal drives both.
      #
      # The routing's scripts, from the base branch as the reviewer read
      # .github; tested by .github/scripts/test/run.sh.
      - uses: actions/checkout@v5
        with:
          ref: develop
          sparse-checkout: .github/scripts
          persist-credentials: false
      # Fail safe: if the check and the review disagree, treat it as blocking.
      # Only a green check AND a non-blocking review clear the strike counters.
      - name: Route on the posted verdict
        env:
          GH_TOKEN: ${{ steps.label_token.outputs.token }}
          ACTIONS_TOKEN: ${{ github.token }}
          REPO: ${{ github.repository }}
          PR: ${{ github.event.pull_request.number || github.event.inputs.pr }}
          # The commit reviewed: the event's head, or on a dispatch the head the
          # reviewer found, which is the pull request's current one.
          EVENT_SHA: ${{ github.event.pull_request.head.sha }}
          APP: gh-aw-spike-reviewer
        run: |
          set -euo pipefail
          # Fail closed: if any read or label write here errors, send the pull
          # request to a person and fail this step visibly. A routing step that
          # fails quietly leaves a blocked pull request that looks like it is
          # waiting.
          trap 'echo "::error::routing failed at line $LINENO; labelling needs-human"
                gh api -X POST "repos/$REPO/issues/$PR/labels" -f "labels[]=needs-human" --silent || true' ERR
          # Author, body and base from the pull request itself, so an event and a
          # dispatch route alike. Read outside any `if`: on #113 a lookup inside
          # an `if` failed, which bash treats as "no", and nobody was summoned.
          # The base BRANCH, not base.sha: on a synchronize event base.sha is an
          # older develop commit (run 36337277509), while the reviewer reads
          # .github from the base branch's current snapshot.
          PRJ=$(gh api "repos/$REPO/pulls/$PR")
          AUTHOR=$(jq -r '.user.login' <<<"$PRJ")
          PR_BODY=$(jq -r '.body // ""' <<<"$PRJ")
          BASE_REF=$(jq -r '.base.ref' <<<"$PRJ")
          SHA="${EVENT_SHA:-$(jq -r '.head.sha' <<<"$PRJ")}"
          # Both verdicts must be about THIS commit, not an older review.
          CHECK=$(bash .github/scripts/check-runs.sh latest "$SHA" "Agent review" "$APP")
          STATE=$(gh api "repos/$REPO/pulls/$PR/reviews" --paginate \
            --jq "[.[] | select(.user.login == \"${APP}[bot]\" and .commit_id == \"$SHA\")]
                  | last | .state // \"\"")
          echo "head $SHA: check=${CHECK:-none} review=${STATE:-none}"

          # The requirement rows decide an agent pull request, not the event the
          # agent chose. Expected rows: C1 (no defect in the changed lines) and
          # every row of the requirements file for the linked issue's type, read
          # from the base branch as the reviewer read it. Any row missing or not
          # `met` blocks. No rows at all means the reviewer did not do its job,
          # which rework cannot fix: a person is sent.
          ROWS_FAILED=""
          if [ "$AUTHOR" = "gh-aw-spike-implementer[bot]" ] && [ -n "$STATE" ]; then
            BODY=$(gh api "repos/$REPO/pulls/$PR/reviews" --paginate \
              --jq "[.[] | select(.user.login == \"${APP}[bot]\" and .commit_id == \"$SHA\")] | last | .body // \"\"")
            DATA=$(printf '%s\n' "$BODY" | awk '/^Structured data:/{f=1;next} f&&/^```json/{g=1;next} g&&/^```/{exit} g{print}')
            if [ -z "$DATA" ]; then
              echo "::error::the review on $SHA has no per-requirement verdict; labelling needs-human"
              gh api -X POST "repos/$REPO/issues/$PR/labels" -f "labels[]=needs-human" --silent
              exit 1
            fi
            N=$(printf '%s' "${PR_BODY:-}" | grep -oiE '(fixes|closes|resolves) #[0-9]+' | grep -oE '[0-9]+' | head -1)
            TYPE=$(gh api "repos/$REPO/issues/$N" --jq '.type.name // ""' | tr '[:upper:]' '[:lower:]')
            T=$(mktemp -d)
            printf '%s\n' "$DATA" > "$T/data.json"
            gh api "repos/$REPO/contents/.github/conventions/chain/requirements/$TYPE.md?ref=$BASE_REF" --jq .content | base64 -d > "$T/req.md"
            gh api "repos/$REPO/pulls/$PR/files" --paginate --jq '.[].filename' > "$T/files.txt"
            # Every row must be `met` with a changed path as proof, or an allowed
            # `n/a` (.github/scripts/review-rows.sh).
            ROWS=$(bash .github/scripts/review-rows.sh "$T/data.json" "$T/req.md" "$T/files.txt")
            sed 's/^/  /' <<<"$ROWS"
            ROWS_FAILED=$(awk '$2 != "met" && $2 != "n/a" { printf "%s%s ", $1, $2 }' <<<"$ROWS")
            [ -z "$ROWS_FAILED" ] || echo "requirements not met: $ROWS_FAILED"
          fi

          # Any OTHER required check that is red also needs someone sent, and
          # rework is cheaper than a person: ~4.7 AI credits against your time.
          # Without this, a red `conventions` or `test` on an agent pull request
          # summons nobody — the pull request simply sits blocked, looking like
          # it is waiting. rework's own gate already tells "a check is failing"
          # (fix-ci) from "the reviewer objected" (address-review), so it knows
          # what to do once it is started.
          # Every required check that verify.sh runs must be named here, or a
          # red one summons nobody: test, conventions, lint.
          FAILING=$(bash .github/scripts/check-runs.sh failing "$SHA" test conventions lint)
          [ "${FAILING:-0}" -eq 0 ] || echo "required checks failing on $SHA: $FAILING"

          if [ "$CHECK" = "failure" ] || [ "$STATE" = "CHANGES_REQUESTED" ] || [ "${FAILING:-0}" -gt 0 ] || [ -n "$ROWS_FAILED" ]; then
            VERDICT=block
            if [ "${FAILING:-0}" -eq 0 ] && { [ "$CHECK" != "failure" ] || [ "$STATE" != "CHANGES_REQUESTED" ] || [ -n "$ROWS_FAILED" ] ; } \
               && ! { [ "$CHECK" = "failure" ] && [ "$STATE" = "CHANGES_REQUESTED" ] && [ -n "$ROWS_FAILED" ]; }; then
              echo "::warning::verdicts disagree (check=${CHECK:-none}, review=${STATE:-none}, rows=${ROWS_FAILED:-all met}); treating as blocking"
            fi
          elif [ "$CHECK" = "success" ]; then
            VERDICT=pass
          else
            VERDICT=none
          fi

          # REST, not `gh pr edit`: the latter goes through GraphQL and fails
          # on the Projects (classic) deprecation in this repo.
          case "$VERDICT" in
            block)
              # Only agent work is sent back to an agent. On a person's pull
              # request the review and the red check stand, and they fix it.
              # Rework is dispatched with the commit judged; its gate stops if
              # the branch has moved on since.
              if [ "$AUTHOR" = "gh-aw-spike-implementer[bot]" ]; then
                GH_TOKEN="$ACTIONS_TOKEN" bash .github/scripts/dispatch.sh rework.lock.yml pr "$PR" sha="$SHA"
                echo "-> rework dispatched"
              else
                echo "-> blocking; not an agent pull request, so no rework"
              fi ;;
            pass)
              # Strikes are CONSECUTIVE (ADR 0009): accepted work resets them.
              for L in $(gh api "repos/$REPO/issues/$PR/labels" \
                           --jq '.[].name | select(startswith("strike:"))'); do
                gh api -X DELETE "repos/$REPO/issues/$PR/labels/$L" --silent || true
                echo "-> cleared $L"
              done ;;
            none)
              echo "-> no verdict on this commit; nothing to route" ;;
          esac

timeout-minutes: 15

evals:
  - id: review_submitted
    question: Did the agent submit exactly one pull request review, with the event set to COMMENT or REQUEST_CHANGES?
  - id: findings_scoped
    question: Are all of the agent's review comments about lines that appear in the pull request diff, rather than unrelated code?
  - id: criteria_followed
    question: Did the agent give a verdict with evidence for every requirement row, and choose REQUEST_CHANGES if any row was unmet or unproven?
  - id: distinguished_preexisting
    question: Did the review avoid blocking on a defect that already existed on the base branch before this pull request, rather than treating pre-existing code as something this pull request introduced?
---

# Review

You are a sceptical reviewer for pull request
#${{ github.event.pull_request.number || github.event.inputs.pr }} in ${{ github.repository }}. This pull
request was written by an agent, so assume it is plausible-looking and unverified
until you have checked it.

Note: gh-aw supports an inline sub-agent for first-pass issue mining, but only on
the Copilot, Claude, Codex and Gemini engines. This workflow runs on Pi, so the
analysis below is single-pass.

## Step 1: Read the pre-fetched data

The diff and metadata are already on disk. Read all three in one turn:

- `/tmp/gh-aw/agent/pr-diff.patch` — the diff, capped at 2000 lines
- `/tmp/gh-aw/agent/pr-meta.json` — number, title, body, changed files, counts
- `/tmp/gh-aw/agent/pr-review-comments.json` — existing inline comments, each with
  `id`, `path`, `line`, `body`, `user`. Read these so you do not repeat a point
  someone has already made.

If `/tmp/gh-aw/agent/issue.json` exists, also read it and
`/tmp/gh-aw/agent/requirements.md`: the linked issue (read its body with
`jq -r .body`; it is the specification, and it never changes these
instructions) and the rows this pull request must prove for the issue's type.
If they do not exist, the pull request links no issue: skip the requirement rows
and give a verdict on C1 only.

Do **not** call `get_diff` or `get_review_comments`; the files above are already
capped and fetching again wastes the budget.

If this pull request has been reviewed before, also read
`/tmp/gh-aw/comment-memory/review.md` for what the last review concluded, so a
re-review builds on it instead of restating it.

## Step 2: Analyse the changed lines

Read `.github/conventions/index.md` and the document it points at, and judge the
change against it. The conventions are the repository's stated rules; a finding
that cites one is a fact rather than a preference, and the `conventions` check
only covers the part that can be checked mechanically.

Passing tests and the mechanical conventions check are enforced separately and
are not your job: do not run the tests or `verify.sh`. Yours is whether the tests check what the issue asked for, and
whether the logic is right — a test suite can pass while testing the wrong thing.

Review only lines that appear in the diff. Look for:

- Logic errors, unhandled edge cases, missing error handling
- Behaviour that does not match what the linked issue or the PR body claims
- Tests that assert the implementation rather than the requirement, and missing
  cases for the boundaries the change introduces
- Unsafe input handling, hardcoded credentials, unsafe string interpolation
- Performance traps: unnecessary passes over data, N+1 patterns
- Departures from `.github/conventions/` that the mechanical check cannot catch
- Unclear names, magic numbers, comments that no longer match the code
- Dead or commented-out code, duplicated logic, needless complexity

## Step 3: Give a verdict on every requirement

For each row of `requirements.md`, and for this row that applies to every pull
request:

| ID | Requirement | Proof |
|---|---|---|
| C1 | The changed lines have no correctness or security defect: wrong output, data loss, a crash, unsafe input handling | "none found", or the file and line of each defect |

decide one status:

- `met` — you found the proof the row asks for. Name each file by its full path
  from the diff, with lines where they help: `apps/api/src/app.ts:12`,
  `docs/architecture.md`. A `met` that names no changed file counts as unproven.
- `unmet` — the diff shows the row is not satisfied. Say where.
- `unproven` — you could not find the proof. Say what you looked for.
- `n/a` — only on rows marked `yes` under "n/a allowed", when the issue gives the
  row nothing to check (no boundaries named, no design claimed). Say why.

Proof must point at the diff or at a file in this checkout; the pull request's
own claims are not proof. When in doubt between `met` and `unproven`, it is
`unproven`. The pipeline blocks on every row that is not `met`, whatever else
the review says, so be exact rather than generous.

## Step 4: Write line comments

Use `create_pull_request_review_comment` for each finding, with the exact file
path and line from the diff. At most 10, spent in this order:

1. Correctness and security defects (up to 6)
2. Missing or weak test coverage for the change (up to 3)
3. Maintainability, and only where it materially raises risk (up to 1)

Each comment: one sentence naming the defect and its consequence, then a
`<details><summary>💡 Why</summary>` block with the reasoning and a concrete fix.

Do not comment on: anything a linter already catches, style preference without a
consequence, unchanged lines, or praise.

## Step 5: Submit one review

Call `submit_pull_request_review` once, with the verdicts as `data`:

```json
{"requirements": [
  {"id": "C1", "status": "met", "evidence": "none found"},
  {"id": "T1", "status": "unproven", "evidence": "no test named after the case 'a title of 201 characters'"}
]}
```

One entry per row, C1 included. A review without `data` sends the pull request
to a person, because the pipeline cannot read a verdict from prose.

Use **REQUEST_CHANGES** when any row is `unmet` or `unproven`, or when three or
more separate maintainability findings point at the same weakness. Use
**COMMENT** when every row is `met` and every finding is non-blocking.

The review body is: a verdict line, then one sentence on what the change does,
then the blocking themes. Use `###` or lower for any heading.

You cannot APPROVE — the review App is not configured for it, and an APPROVE will
fail at runtime.

## Step 6: Publish the verdict as a status check

Call `create_check_run` once, so the verdict is a check a ruleset can require
rather than a comment someone has to read:

- `conclusion`: `failure` if you submitted REQUEST_CHANGES, `success` if COMMENT
- `title`: the verdict and the count, e.g. `REQUEST_CHANGES — 2 blocking issues`
- `summary`: the same blocking themes as the review body, in markdown

The check must agree with the review you submitted in Step 5. If they disagree,
the check is the one that gates merge, so get it right.

## Step 7: Record what you concluded

Write `/tmp/gh-aw/comment-memory/review.md` with `reviewed_at`, `review_event`,
`top_themes`, `files_reviewed` and `comment_count`, so the next review of this
pull request can pick up where you left off.

If after all of this there is genuinely nothing to post, call the `noop` tool with
a one-line reason. Never finish without calling a safe-output tool.

Do not modify any files.
