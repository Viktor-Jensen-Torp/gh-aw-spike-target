---
emoji: "🔎"
description: Critical line-level review of a pull request's diff, ending in one COMMENT or REQUEST_CHANGES review.
intent: Give an agent-authored pull request a review a maintainer would trust, without a person reading the diff first.

on:
  pull_request:
    # `labeled` is how a conflict fix gets re-reviewed, and it is the door gh-aw
    # deliberately left open. Its confused-deputy guard fires ONLY on
    # `synchronize` with a bot actor, and its own comment says why: "Other
    # pull_request actions (labeled, unlabeled, assigned…) legitimately have
    # actor != pr_author". A conflict fix always pushes as `github-actions[bot]`
    # — gh-aw's signed path cannot represent a merge commit, and its unsigned
    # path authenticates with the checkout's GITHUB_TOKEN rather than the App it
    # minted — so `synchronize` is denied and no verdict is ever posted
    # (Review run 35814898713). A label is not.
    #
    # `names:` filters ONLY the labeled action; the compiled condition is
    # `event.action != 'labeled' || event.label.name == 'recheck'`, so opened,
    # synchronize and reopened are unaffected.
    types: [opened, synchronize, reopened, labeled]
    names: [recheck]
    # Agent pull requests only. The release pull request (`develop -> main`) is a
    # different job — a day's work rather than one change — and is read by
    # release-review.md. Without this filter that reviewer and this one would
    # both run on it, and this one's 2000-line diff cap and 10-comment budget
    # are shaped for a single small change.
    branches: [develop]
  # The implementer App is not a repository collaborator, so without this the
  # role check in pre_activation denies its pull requests.
  bots: [gh-aw-spike-implementer]
  # The label may be applied by either App depending on which role fixed it.
  # For a non-`synchronize` action the allowlist IS consulted, unlike the
  # guard above, so this is the legitimate grant rather than a bypass.

permissions:
  contents: read
  pull-requests: read

engine:
  id: pi
  model: anthropic/claude-haiku-4-5-20251001
  # Role for .github/pi/postconditions.cjs (installed by a pre-agent step).
  env:
    PI_ROLE: review

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
      PI_ROLE: review
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
      # Route on the CHECK RUN, not the review state. On run 35598277469 the
      # agent wrote "REQUEST_CHANGES" in the review text and posted a red
      # check, but called submit_pull_request_review without an `event`
      # field; gh-aw silently defaulted it to COMMENT (pr_review_buffer.cjs),
      # the review posted as COMMENTED, and rework never fired. The check run
      # is also what a ruleset gates merge on, so one signal drives both.
      #
      # Fail safe: if the check and the review disagree, treat it as blocking.
      # Only a green check AND a non-blocking review clear the strike counters.
      - name: Route on the posted verdict
        env:
          GH_TOKEN: ${{ steps.label_token.outputs.token }}
          REPO: ${{ github.repository }}
          PR: ${{ github.event.pull_request.number }}
          SHA: ${{ github.event.pull_request.head.sha }}
          APP: gh-aw-spike-reviewer
        run: |
          set -euo pipefail
          # Both verdicts must be about THIS commit, not an older review.
          CHECK=$(gh api "repos/$REPO/commits/$SHA/check-runs" \
            --jq "[.check_runs[] | select(.name == \"Agent review\" and .app.slug == \"$APP\")]
                  | sort_by(.completed_at) | last | .conclusion // \"\"")
          STATE=$(gh api "repos/$REPO/pulls/$PR/reviews" --paginate \
            --jq "[.[] | select(.user.login == \"${APP}[bot]\" and .commit_id == \"$SHA\")]
                  | last | .state // \"\"")
          echo "head $SHA: check=${CHECK:-none} review=${STATE:-none}"

          if [ "$CHECK" = "failure" ] || [ "$STATE" = "CHANGES_REQUESTED" ]; then
            VERDICT=block
            if [ "$CHECK" != "failure" ] || [ "$STATE" != "CHANGES_REQUESTED" ]; then
              echo "::warning::verdicts disagree (check=${CHECK:-none}, review=${STATE:-none}); treating as blocking"
            fi
          elif [ "$CHECK" = "success" ]; then
            VERDICT=pass
          else
            VERDICT=none
          fi

          # REST, not `gh pr edit`: the latter goes through GraphQL and fails
          # on the Projects (classic) deprecation in this repo.
          # `recheck` is a one-shot request, like `implement`. Leaving it on
          # would mean the next label change never re-fires anything.
          gh api -X DELETE "repos/$REPO/issues/$PR/labels/recheck" --silent 2>/dev/null \
            && echo "-> cleared recheck"

          case "$VERDICT" in
            block)
              gh api -X POST "repos/$REPO/issues/$PR/labels" -f "labels[]=needs-rework" --silent
              echo "-> needs-rework" ;;
            pass)
              # Strikes are CONSECUTIVE (ADR 0009): accepted work resets them.
              for L in $(gh api "repos/$REPO/issues/$PR/labels" \
                           --jq '.[].name | select(startswith("strike:") or startswith("conflict:"))'); do
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

Read `.github/conventions/index.md` and the document it points at, and judge the
change against it. The conventions are the repository's stated rules; a finding
that cites one is a fact rather than a preference, and the `conventions` check
only covers the part that can be checked mechanically.

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
