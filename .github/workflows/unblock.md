---
emoji: "🪛"
description: Merges the integration branch into a conflicted agent pull request and resolves the conflicts.
intent: Get a pull request that collided with someone else's merge moving again, without a person unpicking it.

# `workflow_dispatch` only, and that is the whole point. GitHub documents that
# "workflows will not run on `pull_request` activity if the pull request has a
# merge conflict" — because a `pull_request` run needs `refs/pull/N/merge`,
# which cannot exist while the pull request conflicts. So the one role whose job
# IS the conflict cannot be triggered by the pull request it is fixing. It is
# handed the number instead, by unblock.yml, which runs on the push that caused
# the conflict. See FINDINGS.md.
on:
  workflow_dispatch:
    inputs:
      pr:
        description: "Number of the conflicted pull request to unblock"
        required: true
        type: string

# One run per pull request; two runs racing on one branch would fight over the
# same merge.
concurrency:
  job-discriminator: ${{ inputs.pr }}

# Full history, because this role MERGES. gh-aw's default checkout is a shallow
# clone (`fetch-depth: 1`), which has no commit in common with the branch being
# merged in — git then refuses with "fatal: refusing to merge unrelated
# histories" and the role escalates a conflict it could have resolved (run
# 35798391185). Every other role only reads or appends, so this is the first
# place depth has mattered.
checkout:
  fetch-depth: 0

permissions:
  contents: read
  pull-requests: read

engine:
  id: pi
  model: anthropic/claude-haiku-4-5-20251001
  env:
    PI_ROLE: unblock

network:
  allowed:
    - defaults
    - node

runtimes:
  node:
    version: "24"

pre-agent-steps:
  - name: Install role postconditions extension
    run: |
      set -euo pipefail
      mkdir -p /tmp/gh-aw/pi-agent-dir/extensions
      cp .github/pi/postconditions.cjs /tmp/gh-aw/pi-agent-dir/extensions/postconditions.js
      echo "installed, role=$PI_ROLE"
    env:
      PI_ROLE: unblock

  # The merge itself is mechanical and is done here, not by the agent. The agent
  # is left with exactly one job: decide what the conflicting hunks should say.
  - name: Check out the pull request branch and attempt the merge
    env:
      GH_TOKEN: ${{ github.token }}
      REPO: ${{ github.repository }}
      PR: ${{ inputs.pr }}
    run: |
      set -euo pipefail
      mkdir -p /tmp/gh-aw/agent

      META=$(gh pr view "$PR" --repo "$REPO" --json headRefName,baseRefName,state,labels,mergeable)
      STATE=$(jq -r .state <<<"$META")
      BASE=$(jq -r .baseRefName <<<"$META")
      HEAD=$(jq -r .headRefName <<<"$META")
      LABELS=$(jq -r '[.labels[].name] | join(",")' <<<"$META")
      echo "#$PR $STATE $HEAD -> $BASE [$LABELS]"

      # Refuse anything that is not an open agent pull request. This role
      # rewrites someone's branch; it must never touch a branch that is not the
      # pipeline's own.
      [ "$STATE" = "OPEN" ] || { echo "not open"; exit 1; }
      case ",$LABELS," in *,agent,*) ;; *) echo "not an agent pull request"; exit 1;; esac

      git config user.name "gh-aw-spike-implementer[bot]"
      git config user.email "gh-aw-spike-implementer[bot]@users.noreply.github.com"
      # --unshallow as a belt to the frontmatter's braces: it errors on a repo
      # that is already complete, so fall back to a plain fetch.
      git fetch -q --unshallow origin 2>/dev/null || true
      git fetch -q origin "$BASE" "refs/pull/$PR/head:pr-head"
      git checkout -q pr-head

      if git merge --no-edit "origin/$BASE" > /tmp/gh-aw/agent/merge.log 2>&1; then
        echo "clean" > /tmp/gh-aw/agent/merge-state.txt
        echo "merged cleanly; nothing for the agent to decide"
      else
        echo "conflicted" > /tmp/gh-aw/agent/merge-state.txt
        git diff --name-only --diff-filter=U > /tmp/gh-aw/agent/conflicts.txt || true
        echo "conflicted files:"; cat /tmp/gh-aw/agent/conflicts.txt
        echo "--- git said ---"; cat /tmp/gh-aw/agent/merge.log
      fi
      printf '%s\n' "$BASE" > /tmp/gh-aw/agent/base.txt

tools:
  cli-proxy: true
  github:
    mode: gh-proxy
    min-integrity: approved
    toolsets: [pull_requests, repos]
  bash: ["*"]
  timeout: 300

safe-outputs:
  # The implementer App, because a push must come from the App that opened the
  # pull request or gh-aw's confused-deputy guard silently skips the re-review
  # that follows (FINDINGS).
  github-app:
    client-id: ${{ vars.IMPLEMENTER_CLIENT_ID }}
    private-key: ${{ secrets.IMPLEMENTER_APP_PRIVATE_KEY }}
  push-to-pull-request-branch:
    # Dispatched, so there is no triggering pull request.
    target: "*"
    # Only ever the pipeline's own branches.
    required-labels: [agent]
    # A resolution IS a merge commit, and gh-aw's signed-commit path refuses
    # one outright ("merge commit detected, refusing unsigned push fallback").
    signed-commits: false
    # No `allowed-files`, and that is forced rather than chosen. The allowlist is
    # evaluated against the WHOLE patch, and a merge patch legitimately contains
    # everything the base branch changed — so `[src/**, test/**]` rejected a
    # correct resolution that had touched nothing else (run 35800087449
    # resolved both files and passed all 25 tests, then could not push).
    # `allowed-files` and merging are incompatible; this is not configurable
    # around.
    #
    # What still guards the push, none of it weakened:
    #   - `required-labels: [agent]` — only the pipeline's own pull requests;
    #   - the pre-agent step refuses anything not open and not `agent`;
    #   - gh-aw's `protected-files` default still blocks lockfiles, CODEOWNERS
    #     and the rest;
    #   - the App has no `workflows: write`, so the agent cannot introduce a
    #     workflow change. A clean merge that merely CARRIES the base's workflow
    #     files is fine — GitHub documents the exemption: "Workflow files can be
    #     committed without this scope if the same file (with both the same path
    #     and contents) exists on another branch in the same repository."
    #     A workflow file the agent had to RESOLVE matches no branch, so the
    #     exemption lapses and the push fails — which is the right outcome, and
    #     the role escalates.
    if-no-changes: error
    commit-title-suffix: " [unblock]"
    # Without this gh-aw REQUESTS `administration: read` when minting the App
    # token, and an App that lacks it fails the whole safe_outputs job — which
    # is exactly how run 35796425852 died. Already recorded in FINDINGS and
    # already fixed in rework.md; repeated here anyway.
    check-branch-protection: false
  add-labels:
    max: 1
    target: "*"
    allowed: [needs-human]
  add-comment:
    max: 1
    target: "*"
  noop:
    report-as-issue: false
  threat-detection:
    engine:
      id: claude
      model: claude-haiku-4-5-20251001
    continue-on-error: false
    retries: 2

timeout-minutes: 20
---

# Unblock

Pull request #${{ inputs.pr }} collided with work that reached its base branch
first. The merge has already been attempted for you. Your only job is to decide
what the conflicting lines should say.

## Step 1: Read what happened

- `/tmp/gh-aw/agent/merge-state.txt` — `clean` or `conflicted`.
- `/tmp/gh-aw/agent/conflicts.txt` — the files with conflicts, if any.
- `/tmp/gh-aw/agent/merge.log` — git's own output.

You are on the pull request's branch with the merge in progress. `git status`,
`git diff` and reading the files all work normally.

**If the state is `clean`**, the branch merged with no conflicts. Call
`push_to_pull_request_branch` with `pull_request_number`
${{ inputs.pr }} and stop. Nothing needs deciding.

## Step 2: Resolve, keeping both sides' intent

For each conflicted file, the two sides are both wanted: one is this pull
request's work, the other is work that has already been accepted onto the base
branch. **Neither side is a mistake.** Almost always the answer is to keep both
— two functions added in the same place, two names added to the same export
list, two cases added to the same test file.

Rules:

- **Never delete work that is already on the base branch.** It is merged; it
  passed review. If keeping both is impossible, that is the escalation in
  Step 4, not a licence to drop one.
- **Never leave conflict markers** (`<<<<<<<`, `=======`, `>>>>>>>`) in a file.
  A file containing them is broken, not resolved.
- **Never resolve a conflict inside `.github/`.** Carrying the base branch's
  copy through untouched is fine and expected; editing one is not, and the push
  will be refused. If a conflict lands there, that is Step 4.
- Keep the file's existing order and style — alphabetical if it was
  alphabetical, declaration order if it was that.

Then `git add` each resolved file and `git commit --no-edit`.

## Step 3: Prove it still works

Run `npm test`. If it fails, fix the cause if the fix is obvious from the
conflict you just resolved — a missed export, a duplicated name. If it still
fails, do **not** push: that is Step 4.

Then call `push_to_pull_request_branch` with `pull_request_number`
${{ inputs.pr }}. Pushing re-fires CI and the reviewer on the merged result,
which is what should judge this work now.

## Step 4: When you cannot

Add `needs-human` with `add_labels` and one comment with `add_comment` on
#${{ inputs.pr }} saying, in two or three sentences: which files conflicted,
what the two sides each wanted, and what you could not decide. A person needs
to know what the disagreement *was*, not that there was one.

Use this when the two sides genuinely contradict each other — they changed the
same behaviour in different directions — or when tests still fail after your
resolution. Do not use it merely because the conflict looked awkward.

Never finish without calling one of `push_to_pull_request_branch`, `add_labels`
or `noop`.
