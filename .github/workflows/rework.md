---
emoji: "🔧"
description: Sends a pull request back to the implementer once, carrying the named reason it came back.
intent: Close the loop from a rejected review to a corrected branch, with a bounded number of attempts before a person is called.

# `pull_request`, not `pull_request_target`: gh-aw refuses to compile
# `pull_request_target` with a checkout of the pull request's head ("extremely
# insecure"), and rework has to modify that head.
#
# Consequence: a conflicted pull request never fires this workflow (GitHub runs
# no `pull_request` workflows on one). Conflicts are unblock.md's job, sent by
# unblock-detect.yml and the sweeper.

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
      role: rework

on:
  pull_request:
    types: [labeled]
    names: [needs-rework]
  # The reviewer App applies the label, and a bot actor has no repository role.
  bots: [gh-aw-spike-reviewer]

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
  # The label writes below use GITHUB_TOKEN, deliberately, NOT an App token.
  # An App-applied label fires `pull_request labeled` again, and gh-aw's PR
  # concurrency group cancels the run in flight: on run 35556564292 the gate
  # added strike:1, that event started run 35556639139, and the second killed
  # the first before the agent did anything. github-actions[bot] labels do not
  # trigger workflows, which is exactly what a counter wants. Only the reviewer's
  # needs-rework label is meant to chain, and that one is applied by its App.
  steps:
    - name: Decide whether to rework, and what for
      id: gate
      env:
        GH_TOKEN: ${{ github.token }}
        REPO: ${{ github.repository }}
        PR: ${{ github.event.pull_request.number }}
        LABELLED_SHA: ${{ github.event.pull_request.head.sha }}
        LIMIT: "3"
        LABEL: ${{ github.event.label.name }}
        # gh-aw's own activation check, which runs just before this step. If it
        # refuses the run, the agent will not start, so no strike may be spent:
        # on PR #48 strikes were spent while the agent was blocked, and the pull
        # request was escalated on rounds that never happened.
        MEMBER: ${{ steps.check_membership.outputs.is_team_member }}
      run: |
        set -euo pipefail
        stop() { echo "$1"; echo "proceed=false" >> "$GITHUB_OUTPUT"; exit 0; }
        # REST, not `gh pr edit`: that goes through GraphQL and can fail on the
        # Projects (classic) deprecation in this repository.
        add_label()    { gh api -X POST "repos/$REPO/issues/$PR/labels" -f "labels[]=$1" --silent; }
        remove_label() { gh api -X DELETE "repos/$REPO/issues/$PR/labels/$1" --silent 2>/dev/null || true; }

        [ "$LABEL" = "needs-rework" ] || stop "Not our label ($LABEL); nothing to do."
        [ "$MEMBER" = "true" ] || stop "gh-aw will not activate this run (is_team_member=$MEMBER); no strike spent."
        PRJSON=$(gh pr view "$PR" --repo "$REPO" --json labels,mergeable,headRefOid,statusCheckRollup)
        LABELS=$(jq -r '.labels[].name' <<< "$PRJSON")
        CURRENT_SHA=$(jq -r '.headRefOid' <<< "$PRJSON")
        MERGEABLE=$(jq -r '.mergeable' <<< "$PRJSON")

        # Only the latest commit counts. If the branch moved after the label
        # went on, that commit has its own review and its own chain. Stop before
        # a strike is spent, and take the label off so the next one can fire.
        if [ "$CURRENT_SHA" != "$LABELLED_SHA" ]; then
          remove_label needs-rework
          stop "Stale: labelled $LABELLED_SHA, head is now $CURRENT_SHA."
        fi
        # A person holds it; the pipeline does not touch it.
        if grep -qx needs-human <<< "$LABELS"; then
          remove_label needs-rework
          stop "needs-human is on #$PR; a person owns it."
        fi
        # Unreachable in practice (a conflicted pull request runs no workflows),
        # but if it happens the fix is unblock.md, not a rework round.
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
          remove_label needs-rework
          gh api -X POST "repos/$REPO/issues/$PR/comments" --silent \
            -f body="Third consecutive $KIND. A human owns this now (ADR 0009)."
          stop "Third consecutive $KIND; escalated to a person."
        fi

        # The counter goes on before the agent runs, so a crashed run still
        # spends its round. needs-rework comes off here too: it is a one-shot
        # command, and leaving it on would re-fire this workflow on the push.
        add_label "$KIND:$N"
        remove_label needs-rework
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

# Never on a fork: this trigger carries repository credentials.
if: needs.pre_activation.outputs.proceed == 'true'
  && github.event.pull_request.head.repo.full_name == github.repository

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
      PR: ${{ github.event.pull_request.number }}
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

Pull request #${{ github.event.pull_request.number }} in ${{ github.repository }}
came back. Your task this round is **${{ needs.pre_activation.outputs.task }}**
(round ${{ needs.pre_activation.outputs.round }}).

You are the same implementer that wrote this branch. Do the job in front of you.
Do not re-read the issue and start again.

## Step 1: Read what came back

- `/tmp/gh-aw/agent/reviews.json` — the last five reviews, newest last. The most
  recent `CHANGES_REQUESTED` is the one you must answer.
- `/tmp/gh-aw/agent/review-comments.json` — the inline findings still open, each
  with `path`, `line`, `body`, `comment_id` and `thread_id`. These are the
  specific things to fix.
- `/tmp/gh-aw/agent/pr-meta.json` — the pull request and its check results.

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
