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
      role: unblock

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
  env:
    PI_ROLE: unblock

pre-agent-steps:

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

# The implementer App, because a push must come from the App that opened the
# pull request or gh-aw's confused-deputy guard silently skips the re-review
# that follows (FINDINGS). Set via shared/github-app.md above.
safe-outputs:
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
    #   - gh-aw's `protected-files` guard still catches lockfiles, CODEOWNERS
    #     and the rest — see `protected-files` below for what happens then;
    #   - the App has no `workflows: write`, so the agent cannot introduce a
    #     workflow change. A clean merge that merely CARRIES the base's workflow
    #     files is fine — GitHub documents the exemption: "Workflow files can be
    #     committed without this scope if the same file (with both the same path
    #     and contents) exists on another branch in the same repository."
    #     A workflow file the agent had to RESOLVE matches no branch, so the
    #     exemption lapses and the push fails — which is the right outcome, and
    #     the role escalates.
    #
    # PR #53's real resolution was blocked exactly this way — a merge patch
    # containing .github/workflows/unblock.*. Before this line, the only
    # trace was "Cannot push to pull request branch: patch modifies protected
    # files" in a job log; the pull request just sat, and #53 was finished by
    # hand (FINDINGS.md). fallback-to-issue turns that into a human-facing
    # issue with the patch and instructions to apply or reject it manually,
    # without weakening the guard itself — no protected file gets pushed
    # either way.
    protected-files: fallback-to-issue
    if-no-changes: error
    commit-title-suffix: " [unblock]"
    # Without this gh-aw REQUESTS `administration: read` when minting the App
    # token, and an App that lacks it fails the whole safe_outputs job — which
    # is exactly how run 35796425852 died. Already recorded in FINDINGS and
    # already fixed in rework.md; repeated here anyway.
    check-branch-protection: false
  add-labels:
    max: 2
    target: "*"
    # `recheck` asks the reviewer to look again. It is needed because the push
    # this role makes can never trigger a review by itself: a merge commit
    # forces the unsigned push path, which authenticates as github-actions[bot],
    # and gh-aw denies a `synchronize` whose actor is a bot that did not open
    # the pull request. A `labeled` event is exempt by design.
    allowed: [needs-human, recheck]
  add-comment:
    max: 1
    target: "*"
  noop:
    report-as-issue: false

timeout-minutes: 20

evals:
  - id: preserved_both_intents
    question: Does the resolution keep what both sides were trying to do, rather than dropping one side's work?
  - id: no_reversal
    question: Does the resolution avoid reversing any change that was already merged on the base branch?
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
`push_to_pull_request_branch` with `pull_request_number` ${{ inputs.pr }}, then
`add_labels` with `recheck`, and stop. Nothing needs deciding.

## Step 2: Resolve, keeping both sides' intent

For each conflicted file, the two sides are both wanted: one is this pull
request's work, the other is work that has already been accepted onto the base
branch. **Neither side is a mistake.** Keep what each side was *trying to do*.

**A side's intent is the change it made, which may be a removal.** Work out what
each side did to the conflicting lines before you decide what they should say.

**Comparing the two sides to each other cannot tell you this**, and reaching for
`git show HEAD:<file>` and `git show origin/develop:<file>` is the trap: two end
states differ in the same way whether a name was added on one side or deleted on
the other. You must diff each side against their common ancestor:

```bash
BASE=$(git merge-base HEAD MERGE_HEAD)
git diff "$BASE" HEAD       -- <file>   # what THIS pull request did
git diff "$BASE" MERGE_HEAD -- <file>   # what the base branch did
```

Read those two diffs before you write anything. A `-` line is a removal and a
`+` line is an addition; that is the only reliable way to tell them apart. On
run 35938215027 the agent skipped this, compared the two end states, and
concluded that the pull request was *adding* the very function the base branch
had just moved out — exactly backwards — then escalated on that reasoning.

With both diffs in hand:

- Both sides **added** something — keep both additions. Two functions in the
  same place, two names on the same export list, two cases in the same test
  file.
- Both sides **removed** something — keep both removals. If one side deleted a
  name from a list and the other deleted a different name, the answer has
  **neither** name in it. Putting either one back reverses work that was
  reviewed and merged.
- One added and one removed — keep the addition and the removal. They are not
  in competition unless they touch the same name.

The common case is two additions, so "keep both" is a reflex worth distrusting:
check the diff, do not assume. **Re-adding something a side deleted is the most
likely way to get this wrong, and the least likely to be noticed** — the tests
that covered it still pass, because putting it back is exactly what they were
written against.

Rules:

- **Never reverse work that is already on the base branch.** It is merged; it
  passed review. That includes its deletions: if the base branch removed a
  function, a name or a test, it stays removed. If honouring both sides is
  impossible, that is the escalation in Step 4, not a licence to undo one.
- **Never leave conflict markers** (`<<<<<<<`, `=======`, `>>>>>>>`) in a file.
  A file containing them is broken, not resolved.
- **Never resolve a conflict inside `.github/`.** Carrying the base branch's
  copy through untouched is fine and expected; editing one is not, and the push
  will be refused. If a conflict lands there, that is Step 4.
- Keep the file's existing order and style — alphabetical if it was
  alphabetical, declaration order if it was that.

Then `git add` each resolved file and `git commit --no-edit`.

## Step 3: Prove it still works

Run `bash .github/scripts/verify.sh` — the checks that gate the pull request. If
it fails, fix the cause if the fix is obvious from the conflict you just
resolved — a missed export, a duplicated name. If it still fails, do **not**
push: that is Step 4.

`push_to_pull_request_branch` runs the same checks itself before accepting. If
it answers **"BLOCKED by the pipeline"**, nothing was pushed: fix what it names,
commit, and push again. If it tells you to stop, go to Step 4.

Then call `push_to_pull_request_branch` with `pull_request_number`
${{ inputs.pr }}, **and then `add_labels` with `recheck`** on the same pull
request. The push alone will not get this reviewed — a review cannot be
triggered by a push from this role — and the label is what asks for one. A
resolution nobody reviews cannot merge, so both calls are required.

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
