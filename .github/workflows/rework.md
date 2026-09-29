---
emoji: "🔧"
description: Sends a pull request back to the implementer once, carrying the named reason it came back.
intent: Close the loop from a rejected review to a corrected branch, with a bounded number of attempts before a person is called.

# Dispatched, never labelled: review's routing step sends it with the commit it
# judged, and the sweeper sends it for a red pull request nobody is acting on
# (.github/scripts/dispatch.sh). gh-aw reads the pull request from the dispatch's
# `aw_context`: it checks out that pull request's branch and `target:
# triggering` resolves to it (checkout_pr_branch.cjs, invocation_context_helpers.cjs).
#
# Conflicts are unblock.md's job, sent by unblock-detect.yml and the sweeper.

inlined-imports: true

imports:
  - shared/model.md
  - shared/budget.md
  - shared/threat-detection.md
  - shared/graders.md
  - shared/node-runtime.md
  - shared/browser.md
  - uses: shared/github-app.md
    with:
      app_prefix: IMPLEMENTER
  - uses: shared/postconditions.md
    with:
      role: rework
  - shared/design-context.md
  # The issue, its requirement rows and the conventions for the changed paths:
  # the same bar the implementer built to and the reviewer judges by. Without
  # them, rework on #136 fixed padding with a raw value although the
  # conventions say design tokens only (run 36601234520).
  - uses: shared/agent-context.md
    with:
      required: true

on:
  workflow_dispatch:
    inputs:
      pr:
        description: "Number of the pull request to rework"
        required: true
        type: string
      sha:
        description: "The head commit that was judged; a newer head means this round is stale"
        required: true
        type: string
  # The gate below makes gh-aw check the actor's role (a `steps:` key is not one
  # of its safe triggers, role_checks.go). Review's routing and the sweeper
  # dispatch with GITHUB_TOKEN, which runs as github-actions[bot].
  bots: [github-actions]

  permissions:
    contents: read
    pull-requests: write
    issues: write

  # Everything below decides, deterministically, whether this round happens at
  # all and what it is for. It must not be left to the agent: a counter the
  # agent keeps is a counter the agent can lose. Labels are the only state that
  # survives a run, and unlike the run log they are visible on the pull request.
  # Design follows ../pi-github-test docs/adr/0009-the-rework-loop.md.
  #
  # The label writes below use GITHUB_TOKEN, deliberately, NOT an App token:
  # strike labels are state, and github-actions[bot] labels start no workflow
  # (on run 35556564292 an App-applied strike label started a second run that
  # cancelled the first).
  steps:
    - name: Decide whether to rework, and what for
      id: gate
      env:
        GH_TOKEN: ${{ github.token }}
        REPO: ${{ github.repository }}
        PR: ${{ github.event.inputs.pr }}
        JUDGED_SHA: ${{ github.event.inputs.sha }}
        LIMIT: "3"
      run: |
        set -euo pipefail
        stop() { echo "$1"; echo "proceed=false" >> "$GITHUB_OUTPUT"; exit 0; }
        # REST, not `gh pr edit`: that goes through GraphQL and can fail on the
        # Projects (classic) deprecation in this repository.
        add_label()    { gh api -X POST "repos/$REPO/issues/$PR/labels" -f "labels[]=$1" --silent; }

        PRJSON=$(gh pr view "$PR" --repo "$REPO" --json state,labels,mergeable,headRefOid,statusCheckRollup,isCrossRepository)
        [ "$(jq -r .state <<< "$PRJSON")" = OPEN ] || stop "#$PR is not open."
        # Never on a fork: this run pushes with repository credentials.
        [ "$(jq -r .isCrossRepository <<< "$PRJSON")" = false ] || stop "#$PR comes from a fork."
        LABELS=$(jq -r '.labels[].name' <<< "$PRJSON")
        # Rework fixes agent work only; a person fixes their own pull request.
        # Its push already requires `agent`; stopping here spends no strike and
        # no agent run on one it could never push to (PR #107).
        grep -qx agent <<< "$LABELS" || stop "#$PR is not an agent pull request; its author fixes it."
        CURRENT_SHA=$(jq -r '.headRefOid' <<< "$PRJSON")
        MERGEABLE=$(jq -r '.mergeable' <<< "$PRJSON")

        # Only the latest commit counts. If the branch moved after that commit
        # was judged, the new one has its own review and its own chain. Stop
        # before a strike is spent.
        [ "$CURRENT_SHA" = "$JUDGED_SHA" ] || stop "Stale: judged $JUDGED_SHA, head is now $CURRENT_SHA."
        # A person holds it; the pipeline does not touch it.
        if grep -qx needs-human <<< "$LABELS"; then stop "needs-human is on #$PR; a person owns it."; fi
        # A person paused it. No strike is spent; when `paused` comes off, the
        # sweeper finds the red verdict and sends rework again.
        if grep -qx paused <<< "$LABELS"; then stop "paused is on #$PR; it resumes when the label comes off."; fi
        # A conflicted pull request is unblock.md's to fix, not a rework round.
        [ "$MERGEABLE" != "CONFLICTING" ] || stop "Conflicted; that is unblock.md's job."

        # Red CI first, because a failing build is a more concrete task than a
        # review finding. `hold` and `Agent review` are not CI.
        FAILED_CI=$(jq -r '[.statusCheckRollup[]? | select(.name != "Agent review" and .name != "hold")
                            | select(.conclusion == "FAILURE")] | length' <<< "$PRJSON")
        if [ "${FAILED_CI:-0}" -gt 0 ]; then TASK=fix-ci; else TASK=address-review; fi
        KIND=strike

        N=0
        for i in 1 2 3 4 5; do
          grep -qx "$KIND:$i" <<< "$LABELS" && N=$i
        done
        N=$((N + 1))

        if [ "$N" -ge "$LIMIT" ]; then
          add_label needs-human
          gh api -X POST "repos/$REPO/issues/$PR/comments" --silent \
            -f body="Third consecutive $KIND. A human owns this now (ADR 0009)."
          stop "Third consecutive $KIND; escalated to a person."
        fi

        # The counter goes on before the agent runs, so a crashed run still
        # spends its round.
        add_label "$KIND:$N"
        echo "proceed=true"   >> "$GITHUB_OUTPUT"
        echo "task=$TASK"     >> "$GITHUB_OUTPUT"
        echo "round=$KIND:$N" >> "$GITHUB_OUTPUT"
        echo "Round $KIND:$N — $TASK"

jobs:
  pre-activation:
    outputs:
      proceed: ${{ steps.gate.outputs.proceed }}
      task: ${{ steps.gate.outputs.task }}
      round: ${{ steps.gate.outputs.round }}

run-name: "Rework #${{ github.event.inputs.pr }}"

if: needs.pre_activation.outputs.proceed == 'true'

# One round per pull request at a time; different pull requests side by side.
concurrency:
  group: "gh-aw-${{ github.workflow }}-${{ github.event.inputs.pr }}"
  cancel-in-progress: false
  # The compiler gives dispatched runs' agent and conclusion jobs one shared
  # slot unless told apart (reference/concurrency.md, job-discriminator).
  job-discriminator: ${{ github.event.inputs.pr }}

permissions:
  contents: read
  pull-requests: read

engine:
  id: pi
  # Role for .github/pi/postconditions.cjs (installed by a pre-agent step).
  env:
    PI_ROLE: rework

pre-agent-steps:
  - name: Pre-fetch the review findings and the failing checks
    env:
      GH_TOKEN: ${{ github.token }}
      REPO: ${{ github.repository }}
      PR: ${{ github.event.inputs.pr }}
    run: |
      set -euo pipefail
      mkdir -p /tmp/gh-aw/agent
      # --paginate applies --jq per page, so slice after joining the pages.
      gh api "repos/$REPO/pulls/$PR/reviews" --paginate \
        --jq '.[] | {id, state, user: .user.login, body: .body[:4000]}' \
        | jq -s '.[-5:]' > /tmp/gh-aw/agent/reviews.json
      # Only findings still open, each with its thread id, so the agent can
      # reply to and resolve exactly the ones it fixed. REST has no thread ids.
      gh api graphql --paginate -F owner="${REPO%/*}" -F name="${REPO#*/}" -F pr="$PR" -f query='
        query($owner: String!, $name: String!, $pr: Int!, $endCursor: String) {
          repository(owner: $owner, name: $name) { pullRequest(number: $pr) {
            reviewThreads(first: 50, after: $endCursor) {
              pageInfo { hasNextPage endCursor }
              nodes { id isResolved path line originalLine
                      comments(first: 1) { nodes { databaseId body author { login } } } } } } } }' \
        --jq '.data.repository.pullRequest.reviewThreads.nodes[] | select(.isResolved | not)
              | {thread_id: .id, comment_id: .comments.nodes[0].databaseId, path,
                 line: (.line // .originalLine), body: .comments.nodes[0].body[:2000],
                 user: .comments.nodes[0].author.login}' \
        | jq -s '.' > /tmp/gh-aw/agent/review-comments.json
      gh pr view "$PR" --repo "$REPO" \
        --json number,title,body,headRefName,statusCheckRollup \
        > /tmp/gh-aw/agent/pr-meta.json
      echo "fetched $(jq length /tmp/gh-aw/agent/review-comments.json) open review threads"

tools:
  cli-proxy: true
  github:
    mode: gh-proxy
    min-integrity: approved
    # No `issues` toolset: the findings are pre-fetched, and adding it would
    # require issues: read on the agent job for nothing.
    toolsets: [pull_requests, repos]
  edit:
  # Pi rejects a bash allow-list (the compiler refuses one), so bash is
  # unrestricted inside the firewalled container.
  bash: ["*"]

safe-outputs:
  push-to-pull-request-branch:
    target: "triggering"
    required-labels: [agent]
    # No `allowed-files` here either (see unblock.md for why that pairs badly
    # with a role that can touch more than one file per round). fix-ci in
    # particular has no path restriction in the prompt, so a protected-file
    # edit is possible, not just theoretical. Same reasoning as unblock.md:
    # turn a silent refusal into a human-facing issue rather than weaken the
    # guard.
    protected-files: fallback-to-issue
    if-no-changes: error
    commit-title-suffix: " [rework]"
    # Skip the pre-push branch-protection lookup. It needs administration: read,
    # and with safe-outputs.github-app gh-aw REQUESTS that permission when minting
    # the token, so an App without it fails the whole job (run 35681365661) —
    # not the "warning and continue" the docs describe. GitHub still enforces
    # protection when the push lands, and rework only pushes to agent PR branches.
    check-branch-protection: false
  add-comment:
    max: 1
  # Close the loop per finding: say what changed on the finding itself, and mark
  # it resolved, so the next review sees only what is still open.
  # (safe-outputs-pull-requests.md.) Resolving can be refused to an App token;
  # gh-aw then skips it with a warning, and the reply still lands.
  reply-to-pull-request-review-comment:
    max: 10
  resolve-pull-request-review-thread:
    max: 10
  noop:

timeout-minutes: 20

evals:
  - id: addressed_findings
    question: Did the agent change code in response to the specific review findings or failing checks it was given, rather than making unrelated edits?
  - id: no_test_weakening
    question: Did the agent avoid making a test pass by weakening or deleting the test rather than fixing the code?
---

# Rework

Pull request #${{ github.event.inputs.pr }} in ${{ github.repository }}
came back. Your task this round is **${{ needs.pre_activation.outputs.task }}**
(round ${{ needs.pre_activation.outputs.round }}).

You are the same implementer that wrote this branch. Do the job in front of you.
Fix what came back; do not start over from the issue.

## Step 1: Read what came back

- `/tmp/gh-aw/agent/reviews.json` — the last five reviews, newest last. The most
  recent `CHANGES_REQUESTED` is the one you must answer.
- `/tmp/gh-aw/agent/review-comments.json` — the inline findings still open, each
  with `path`, `line`, `body`, `comment_id` and `thread_id`. These are the
  specific things to fix.
- `/tmp/gh-aw/agent/pr-meta.json` — the pull request and its check results.
- `/tmp/gh-aw/agent/requirements.md` — the rows the reviewer checks; a fix must
  keep every row met. `/tmp/gh-aw/agent/issue.json` is the issue they come from.
- `/tmp/gh-aw/agent/conventions.md` — the conventions for the paths this pull
  request touches. Fix the way they say (for sizes and colours: design tokens,
  not raw values).

## Step 2: Do the named task

**address-review** — fix every blocking finding in the most recent
`CHANGES_REQUESTED` review. A finding about a missing or weak test is a real
finding: add the test.

**fix-ci** — read the failing check, reproduce it with
`bash .github/scripts/verify.sh`, and fix the cause.

Whatever the task: **never make a check pass by weakening or deleting a test.**
If a test is genuinely wrong, say so in your comment and explain why.

## Step 3: Verify before you push

Run `bash .github/scripts/verify.sh` and fix everything it names until it
passes. It runs exactly the checks that gate the pull request, so a failure left
here comes back as another rejected review and another round — and this round
has already spent a strike. Commit, then push with
`push_to_pull_request_branch`, and post one `add_comment` saying what you changed
and which finding each change answers.

Then, for each inline finding your push fixed: `reply_to_pull_request_review_comment`
with its `comment_id` and one line saying what changed, and
`resolve_pull_request_review_thread` with its `thread_id`. Leave a finding you did
not fix unresolved, and say why in your comment. Do this only after the push
succeeded.

`push_to_pull_request_branch` runs the same checks itself before accepting. If
it answers **"BLOCKED by the pipeline"**, nothing was pushed: fix what it names,
commit, and push again. If it tells you to stop, call `report_incomplete` with
what still fails — do not keep trying.

## If you cannot do it

If the findings contradict each other, or fixing them properly needs a decision
you are not allowed to make, do not guess and do not push a partial fix. Call
`noop` with the reason, and say plainly in it that this needs a person. Stopping
with a reason is a valid ending.

Never finish without calling a safe-output tool.
