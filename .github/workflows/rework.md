---
emoji: "🔧"
description: Sends a pull request back to the implementer once, carrying the named reason it came back.
intent: Close the loop from a rejected review to a corrected branch, with a bounded number of attempts before a person is called.

# `pull_request`, although `pull_request_target` would be the better trigger.
#
# A `pull_request` workflow does not run at all when the pull request has a
# merge conflict, which is one of the reasons rework exists, and it runs the
# pull request's own copy of this file. `pull_request_target` fixes both, but
# gh-aw refuses to compile `pull_request_target` together with a checkout:
# "pull_request_target trigger with checkout enabled is extremely insecure",
# and it only offers checking out the BASE commit. Rework has to check out and
# modify the pull request's head, so that guard rules the combination out.
#
# Consequence: the `resolve-conflict` door below is
# unreachable from this trigger. A conflicted pull request never fires it.
# This is very likely why gh-aw's own pr-sous-chef is a scheduled sweeper
# rather than an event-driven rework agent.

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

  # Outer backstop: a chain that is still going two days later is a runaway.
  stop-after: +48h

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
      run: |
        set -euo pipefail
        if [ "$LABEL" != "needs-rework" ]; then
          echo "Not our label ($LABEL); nothing to do."
          echo "proceed=false" >> "$GITHUB_OUTPUT"
          exit 0
        fi
        PRJSON=$(gh pr view "$PR" --repo "$REPO" --json labels,mergeable,headRefOid,statusCheckRollup)
        LABELS=$(jq -r '.labels[].name' <<< "$PRJSON")
        CURRENT_SHA=$(jq -r '.headRefOid' <<< "$PRJSON")
        MERGEABLE=$(jq -r '.mergeable' <<< "$PRJSON")

        # Only the latest commit counts. If the branch moved after the label
        # went on, that commit has its own review and its own chain. Stop before
        # a strike is spent, and take the label off so the next one can fire.
        if [ "$CURRENT_SHA" != "$LABELLED_SHA" ]; then
          echo "Stale: labelled $LABELLED_SHA, head is now $CURRENT_SHA."
          gh pr edit "$PR" --repo "$REPO" --remove-label needs-rework || true
          echo "proceed=false" >> "$GITHUB_OUTPUT"
          exit 0
        fi

        # Whose fault is it? A conflict is someone else's work landing first,
        # not the implementer getting it wrong, so it spends its own budget.
        # Otherwise: red CI first, because a failing build is a more concrete
        # task than a review finding, and the reviewer reads built code anyway.
        FAILED_CI=$(jq -r '[.statusCheckRollup[]? | select(.name != "Agent review")
                            | select(.conclusion == "FAILURE")] | length' <<< "$PRJSON")
        if [ "$MERGEABLE" = "CONFLICTING" ]; then
          KIND=conflict; TASK=resolve-conflict
        elif [ "${FAILED_CI:-0}" -gt 0 ]; then
          KIND=strike;   TASK=fix-ci
        else
          KIND=strike;   TASK=address-review
        fi

        N=0
        for i in 1 2 3 4 5; do
          grep -qx "$KIND:$i" <<< "$LABELS" && N=$i
        done
        N=$((N + 1))

        if [ "$N" -ge "$LIMIT" ]; then
          gh pr edit "$PR" --repo "$REPO" --add-label needs-human --remove-label needs-rework
          gh pr comment "$PR" --repo "$REPO" --body \
            "Third consecutive $KIND. A human owns this now (ADR 0009)."
          echo "proceed=false" >> "$GITHUB_OUTPUT"
          exit 0
        fi

        # The counter goes on before the agent runs, so a crashed run still
        # spends its round. needs-rework comes off here too: it is a one-shot
        # command, and leaving it on would re-fire this workflow on the push.
        gh pr edit "$PR" --repo "$REPO" --add-label "$KIND:$N" --remove-label needs-rework
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

# Outer backstops. The strike counter bounds one pull request; these bound the
# workflow. gh-aw's own first line of defence — that agentic writes do not
# trigger workflows — is switched off here by design, because the chain depends
# on one agent starting the next.
max-daily-ai-credits: 500

pre-agent-steps:
  - name: Pre-fetch the review findings and the failing checks
    env:
      GH_TOKEN: ${{ github.token }}
      REPO: ${{ github.repository }}
      PR: ${{ github.event.pull_request.number }}
    run: |
      set -euo pipefail
      mkdir -p /tmp/gh-aw/agent
      gh api "repos/$REPO/pulls/$PR/reviews" --paginate \
        --jq '[.[] | {id, state, user: .user.login, body: .body[:4000]}] | .[-5:]' \
        > /tmp/gh-aw/agent/reviews.json
      gh api "repos/$REPO/pulls/$PR/comments" --paginate \
        --jq '[.[] | {id, path, line: (.line // .original_line), body: .body[:2000], user: .user.login}]' \
        > /tmp/gh-aw/agent/review-comments.json
      gh pr view "$PR" --repo "$REPO" \
        --json number,title,body,headRefName,statusCheckRollup \
        > /tmp/gh-aw/agent/pr-meta.json
      echo "fetched $(jq length /tmp/gh-aw/agent/review-comments.json) review comments"

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
- `/tmp/gh-aw/agent/review-comments.json` — the inline findings, each with
  `path`, `line` and `body`. These are the specific things to fix.
- `/tmp/gh-aw/agent/pr-meta.json` — the pull request and its check results.

## Step 2: Do the named task

**address-review** — fix every blocking finding in the most recent
`CHANGES_REQUESTED` review. A finding about a missing or weak test is a real
finding: add the test.

**fix-ci** — read the failing check, reproduce it with
`bash .github/scripts/verify.sh`, and fix the cause.

**resolve-conflict** — rebase onto the base branch and resolve the conflict.
Keep both sides' intent; do not drop someone else's change to make yours apply.

Whatever the task: **never make a check pass by weakening or deleting a test.**
If a test is genuinely wrong, say so in your comment and explain why.

## Step 3: Verify before you push

Run `bash .github/scripts/verify.sh` and fix everything it names until it
passes. It runs exactly the checks that gate the pull request, so a failure left
here comes back as another rejected review and another round — and this round
has already spent a strike. Commit, then push with
`push_to_pull_request_branch`, and post one `add_comment` saying what you changed
and which finding each change answers.

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
