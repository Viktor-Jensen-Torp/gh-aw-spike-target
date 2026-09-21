---
emoji: "🔎"
description: Critical line-level review of a pull request's diff, ending in one COMMENT or REQUEST_CHANGES review.
intent: Give an agent-authored pull request a review a maintainer would trust, without a person reading the diff first.

on:
  pull_request:
    types: [opened, synchronize, reopened]
  # The implementer App is not a repository collaborator, so without this the
  # role check in pre_activation denies its pull requests.
  bots: [gh-aw-spike-implementer]

permissions:
  contents: read
  pull-requests: read

engine:
  id: pi
  model: anthropic/claude-haiku-4-5-20251001

# Warm the pre-fetch across re-reviews of the same head commit.
cache:
  key: pr-prefetch-${{ github.event.pull_request.head.sha }}
  path: /tmp/gh-aw/agent
  restore-keys:
    - pr-prefetch-${{ github.event.pull_request.number }}-

# Fetch the diff, metadata and existing comments on the runner instead of
# spending agent turns on it. Adapted from gh-aw's own shared/pr-diff-data-fetch.md;
# we cannot import that file because it lives in the gh-aw repository.
pre-agent-steps:
  - name: Pre-fetch PR diff, metadata and existing review comments
    env:
      GH_TOKEN: ${{ github.token }}
      PR_NUMBER: ${{ github.event.pull_request.number }}
      PR_HEAD_SHA: ${{ github.event.pull_request.head.sha }}
      EXPR_GITHUB_REPOSITORY: ${{ github.repository }}
      PR_DIFF_MAX_LINES: "2000"
    run: |
      set -euo pipefail
      mkdir -p /tmp/gh-aw/agent
      CACHE_HEAD_SHA=""
      if [ -f /tmp/gh-aw/agent/pr-data-head-sha.txt ]; then
        CACHE_HEAD_SHA="$(tr -d '\n' < /tmp/gh-aw/agent/pr-data-head-sha.txt)"
      fi
      if [ "$PR_HEAD_SHA" = "$CACHE_HEAD_SHA" ] \
        && [ -f /tmp/gh-aw/agent/pr-diff.patch ] \
        && [ -f /tmp/gh-aw/agent/pr-meta.json ] \
        && [ -f /tmp/gh-aw/agent/pr-review-comments.json ]; then
        echo "Cache hit for head ${PR_HEAD_SHA}"
      else
        { gh pr diff "$PR_NUMBER" --repo "$EXPR_GITHUB_REPOSITORY" \
            --exclude '**/*.lock.yml' || true; } \
          | head -n "${PR_DIFF_MAX_LINES}" > /tmp/gh-aw/agent/pr-diff.patch
        gh pr view "$PR_NUMBER" --repo "$EXPR_GITHUB_REPOSITORY" \
          --json number,title,body,headRefName,headRefOid,additions,deletions,changedFiles,files \
          > /tmp/gh-aw/agent/pr-meta.json
        gh api "repos/$EXPR_GITHUB_REPOSITORY/pulls/$PR_NUMBER/comments" --paginate \
          --jq '.[] | {id, path, line: (.line // .original_line), body: .body[:200], user: .user.login}' \
          2>/dev/null | jq -s '.' > /tmp/gh-aw/agent/pr-review-comments.json \
          || echo '[]' > /tmp/gh-aw/agent/pr-review-comments.json
        printf '%s\n' "$PR_HEAD_SHA" > /tmp/gh-aw/agent/pr-data-head-sha.txt
        echo "Pre-fetched $(wc -l < /tmp/gh-aw/agent/pr-diff.patch) diff lines for head ${PR_HEAD_SHA}"
      fi

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
  github-app:
    client-id: ${{ vars.REVIEWER_CLIENT_ID }}
    private-key: ${{ secrets.REVIEWER_APP_PRIVATE_KEY }}
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
  noop:
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

# The rework loop is driven from the review that was actually posted, not from
# the agent remembering to label. On run 35555162071 the agent submitted
# REQUEST_CHANGES and simply skipped the add_labels step, so the loop never
# started. Anything the pipeline depends on must not live in a prompt step.
#
# conclusion runs after safe_outputs, so by here the review exists.
jobs:
  conclusion:
    pre-steps:
      - uses: actions/create-github-app-token@v3
        id: label_token
        with:
          client-id: ${{ vars.REVIEWER_CLIENT_ID }}
          private-key: ${{ secrets.REVIEWER_APP_PRIVATE_KEY }}
      - name: Route on the posted verdict
        env:
          GH_TOKEN: ${{ steps.label_token.outputs.token }}
          REPO: ${{ github.repository }}
          PR: ${{ github.event.pull_request.number }}
        run: |
          set -euo pipefail
          STATE=$(gh api "repos/$REPO/pulls/$PR/reviews" --paginate \
            --jq '[.[] | select(.user.login == "gh-aw-spike-reviewer[bot]")] | last | .state // ""')
          echo "latest review by this App: ${STATE:-none}"
          case "$STATE" in
            CHANGES_REQUESTED)
              gh pr edit "$PR" --repo "$REPO" --add-label needs-rework
              echo "-> needs-rework" ;;
            COMMENTED|APPROVED)
              # Strikes are CONSECUTIVE (ADR 0009): accepted work resets them.
              DROP=$(gh pr view "$PR" --repo "$REPO" --json labels \
                --jq '[.labels[].name | select(startswith("strike:") or startswith("conflict:"))] | join(",")')
              [ -n "$DROP" ] && gh pr edit "$PR" --repo "$REPO" --remove-label "$DROP" || true
              echo "-> cleared: ${DROP:-nothing}" ;;
            *)
              echo "-> no verdict to route" ;;
          esac

timeout-minutes: 15

evals:
  - id: review_submitted
    question: Did the agent submit exactly one pull request review, with the event set to COMMENT or REQUEST_CHANGES?
  - id: findings_scoped
    question: Are all of the agent's review comments about lines that appear in the pull request diff, rather than unrelated code?
  - id: criteria_followed
    question: If the agent chose REQUEST_CHANGES, did it name at least one concrete defect? If it chose COMMENT, are all of its findings non-blocking?
---

# Review

You are a sceptical reviewer for pull request
#${{ github.event.pull_request.number }} in ${{ github.repository }}. This pull
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

Do **not** call `get_diff` or `get_review_comments`; the files above are already
capped and fetching again wastes the budget.

If this pull request has been reviewed before, also read
`/tmp/gh-aw/comment-memory/review.md` for what the last review concluded, so a
re-review builds on it instead of restating it.

## Step 2: Analyse the changed lines

Review only lines that appear in the diff. Look for:

- Logic errors, unhandled edge cases, missing error handling
- Behaviour that does not match what the linked issue or the PR body claims
- Tests that assert the implementation rather than the requirement, and missing
  cases for the boundaries the change introduces
- Unsafe input handling, hardcoded credentials, unsafe string interpolation
- Performance traps: unnecessary passes over data, N+1 patterns
- Unclear names, magic numbers, comments that no longer match the code
- Dead or commented-out code, duplicated logic, needless complexity

## Step 3: Write line comments

Use `create_pull_request_review_comment` for each finding, with the exact file
path and line from the diff. At most 10, spent in this order:

1. Correctness and security defects (up to 6)
2. Missing or weak test coverage for the change (up to 3)
3. Maintainability, and only where it materially raises risk (up to 1)

Each comment: one sentence naming the defect and its consequence, then a
`<details><summary>💡 Why</summary>` block with the reasoning and a concrete fix.

Do not comment on: anything a linter already catches, style preference without a
consequence, unchanged lines, or praise.

## Step 4: Submit one review

Call `submit_pull_request_review` once.

Use **REQUEST_CHANGES** when any of these is true:

- A change can cause wrong output, data loss, a crash, or a security problem
- The change does not do what the issue asked
- The change is untested and its behaviour is not obvious from reading it
- Three or more separate maintainability findings point at the same weakness

Use **COMMENT** when every finding is non-blocking, and when you found nothing.

The review body is: a verdict line, then one sentence on what the change does,
then the blocking themes. Use `###` or lower for any heading.

You cannot APPROVE — the review App is not configured for it, and an APPROVE will
fail at runtime.

## Step 5: Publish the verdict as a status check

Call `create_check_run` once, so the verdict is a check a ruleset can require
rather than a comment someone has to read:

- `conclusion`: `failure` if you submitted REQUEST_CHANGES, `success` if COMMENT
- `title`: the verdict and the count, e.g. `REQUEST_CHANGES — 2 blocking issues`
- `summary`: the same blocking themes as the review body, in markdown

The check must agree with the review you submitted in Step 4. If they disagree,
the check is the one that gates merge, so get it right.

## Step 6: Record what you concluded

Write `/tmp/gh-aw/comment-memory/review.md` with `reviewed_at`, `review_event`,
`top_themes`, `files_reviewed` and `comment_count`, so the next review of this
pull request can pick up where you left off.

If after all of this there is genuinely nothing to post, call the `noop` tool with
a one-line reason. Never finish without calling a safe-output tool.

Do not modify any files.
