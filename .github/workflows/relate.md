---
emoji: "🔗"
description: Records which open issues block which, so nobody starts work that cannot finish.
intent: Give the backlog the relationships a per-issue reader cannot see, so nobody starts work that cannot finish.


inlined-imports: true

imports:
  - shared/model.md
  - shared/budget.md
  - shared/threat-detection.md
  - shared/graders.md
  - uses: shared/postconditions.md
    with:
      role: relate

on:
  # Daily, and offset from the refiner: this role reads issues the refiner has
  # already rewritten, so it is worth running after it rather than beside it.
  schedule: daily
  workflow_dispatch:
  # Cheap when the backlog is small; skipped entirely when there is nothing open.
  skip-if-no-match: "is:issue is:open"

# Without a discriminator every dispatch shares one conclusion concurrency slot,
# so a second dispatch cancels the first.
concurrency:
  job-discriminator: ${{ github.run_id }}

permissions:
  contents: read
  issues: read

engine:
  id: pi
  env:
    PI_ROLE: relate

# Declared dependencies are facts, not judgements: an issue that says
# `Depends on #N` (the refiner writes these under Details) is linked by this job,
# deterministically, before the agent runs. gh-aw runs custom jobs before the
# agent (reference/steps-jobs.md), so the agent then sees them as existing links.
jobs:
  link_declared:
    runs-on: ubuntu-latest
    permissions:
      issues: write
    steps:
      - name: Link every "Depends on #N" line
        env:
          GH_TOKEN: ${{ github.token }}
          REPO: ${{ github.repository }}
        run: |
          set -euo pipefail
          gh api --paginate "repos/$REPO/issues?state=open&per_page=100" \
            --jq '.[] | select(has("pull_request") | not) | [.number, (.body // "")] | @json' \
          | while read -r ROW; do
              N=$(jq -r '.[0]' <<<"$ROW")
              for B in $(jq -r '.[1]' <<<"$ROW" | { grep -oiE '^[[:space:]*-]*depends on #[0-9]+' | grep -oE '[0-9]+' || true; } | sort -u); do
                [ "$B" != "$N" ] || continue
                INFO=$(gh api "repos/$REPO/issues/$B" --jq '{id, state}' 2>/dev/null) || { echo "#$N: #$B not readable"; continue; }
                [ "$(jq -r '.state' <<<"$INFO")" = "open" ] || { echo "#$N: #$B is closed (done)"; continue; }
                if gh api "repos/$REPO/issues/$N/dependencies/blocked_by" --jq '.[].number' | grep -qx "$B"; then
                  continue
                fi
                if ERR=$(gh api -X POST "repos/$REPO/issues/$N/dependencies/blocked_by" \
                           -F issue_id="$(jq -r '.id' <<<"$INFO")" --silent 2>&1); then
                  echo "#$N is blocked by #$B (declared)"
                else
                  echo "#$N: could not link #$B: $ERR"
                fi
              done
            done

pre-agent-steps:

  # The whole open backlog in one file, with the relationships that already
  # exist. This role's judgement is about the SET, so unlike the refiner it must
  # see all of it at once — and it must see what is already linked, or it will
  # propose edges that are already there every single night.
  - name: Fetch the backlog and its existing relationships
    env:
      GH_TOKEN: ${{ github.token }}
      REPO: ${{ github.repository }}
      MAX_ISSUES: "60"
    run: |
      set -euo pipefail
      mkdir -p /tmp/gh-aw/agent
      gh issue list --repo "$REPO" --state open --limit "$MAX_ISSUES" \
        --json number,title,body,labels,createdAt \
        --jq "[ .[]
                | select([.labels[].name] | any(. == \"agentic-workflows\" or . == \"merged\") | not)
                | select(.title | startswith(\"[aw]\") | not)
                | {number, title, labels: [.labels[].name],
                   body: (.body // \"\")[0:1200]} ]" \
        > /tmp/gh-aw/agent/backlog.json

      # Each existing edge, with who added it (GitHub's timeline records the
      # actor: `github-actions` is this pipeline, anyone else is a person) and
      # whether the issue declares it with a `Depends on #N` line.
      # Fail rather than assume "no links": an unreadable edge list would make
      # the agent propose edges that already exist.
      : > /tmp/gh-aw/agent/existing-links.jsonl
      for N in $(jq -r '.[].number' /tmp/gh-aw/agent/backlog.json); do
        BLOCKERS=$(gh api "repos/$REPO/issues/$N/dependencies/blocked_by" --jq '[.[].number]')
        [ "$BLOCKERS" != "[]" ] || continue
        ADDED=$(gh api graphql -F owner="${REPO%/*}" -F name="${REPO#*/}" -F n="$N" -f query='
          query($owner: String!, $name: String!, $n: Int!) { repository(owner: $owner, name: $name) {
            issue(number: $n) { timelineItems(itemTypes: [BLOCKED_BY_ADDED_EVENT], last: 100) {
              nodes { ... on BlockedByAddedEvent { actor { login } blockingIssue { number } } } } } } }' \
          --jq '[.data.repository.issue.timelineItems.nodes[] | {key: (.blockingIssue.number | tostring), value: (.actor.login // "")}] | from_entries')
        DECLARED=$(jq -r --argjson n "$N" '.[] | select(.number == $n) | .body' /tmp/gh-aw/agent/backlog.json \
          | { grep -oiE '^[[:space:]*-]*depends on #[0-9]+' | grep -oE '[0-9]+' || true; } | jq -R 'tonumber' | jq -s '.')
        jq -nc --argjson n "$N" --argjson b "$BLOCKERS" --argjson a "$ADDED" --argjson d "$DECLARED" \
          '{issue: $n, blocked_by: [$b[] | {number: ., added_by: (if ($a[tostring] // "") == "github-actions" then "pipeline" else "person" end), declared: (. as $x | $d | index($x) != null)}]}' \
          >> /tmp/gh-aw/agent/existing-links.jsonl
      done

      echo "backlog: $(jq 'length' /tmp/gh-aw/agent/backlog.json) open issue(s)"
      echo "already linked: $(wc -l < /tmp/gh-aw/agent/existing-links.jsonl) issue(s) with blockers"

tools:
  cli-proxy: true
  github:
    mode: gh-proxy
    min-integrity: approved
    toolsets: [issues, repos]
  bash: ["*"]
  timeout: 300

safe-outputs:
  # No github-app, for the same reason as the refiner: writes made with
  # GITHUB_TOKEN start no workflows, so this role cannot put work into the
  # pipeline. It only describes the backlog it is given.
  add-comment:
    # The prompt allows one summary comment per run.
    max: 1
    target: "*"
  noop:
    report-as-issue: false

  # gh-aw has no blocked-by safe output — `link-sub-issue` is its only
  # relationship output, and that is parent/child. GitHub's REST API does have
  # dependencies, so this is a custom safe-output job: the agent declares an
  # edge with typed fields, and this deterministic step is the only thing that
  # writes one. Established by hand first: the endpoint is
  # POST /repos/{o}/{r}/issues/{blocked}/dependencies/blocked_by and it takes
  # the blocker's internal `id`, NOT its issue number.
  jobs:
    link_blocked_by:
      name: "Record a blocked-by dependency"
      description: "Record that one issue cannot start until another is finished. `blocked` is the issue that must wait; `blocker` is the issue it waits for. Both are issue numbers, without the #."
      runs-on: ubuntu-latest
      max: 20
      permissions:
        issues: write
      inputs:
        blocked:
          description: "Number of the issue that cannot start yet"
          required: true
          type: string
        blocker:
          description: "Number of the issue it is waiting for"
          required: true
          type: string
        reason:
          description: "One sentence: what the blocked issue needs from the blocker"
          required: true
          type: string
      output: "Recorded the blocked-by edges."
      steps:
        - name: Write the dependencies
          env:
            GH_TOKEN: ${{ github.token }}
            REPO: ${{ github.repository }}
          run: |
            set -euo pipefail
            [ -f "$GH_AW_AGENT_OUTPUT" ] || { echo "no agent output"; exit 0; }
            COUNT=0
            while IFS=$'\t' read -r BLOCKED BLOCKER REASON; do
              [ -n "$BLOCKED" ] || continue
              # Self-edges and non-numbers are the two ways this becomes
              # nonsense, and both are cheaper to refuse than to explain.
              case "$BLOCKED$BLOCKER" in *[!0-9]*) echo "skip: non-numeric ($BLOCKED, $BLOCKER)"; continue;; esac
              [ "$BLOCKED" != "$BLOCKER" ] || { echo "skip: #$BLOCKED cannot block itself"; continue; }
              BLOCKER_ID=$(gh api "repos/$REPO/issues/$BLOCKER" --jq '.id' 2>&1) || {
                echo "skip: #$BLOCKER not readable: $BLOCKER_ID"; continue; }
              # Print GitHub's own reason on failure rather than guessing one.
              if ERR=$(gh api -X POST "repos/$REPO/issues/$BLOCKED/dependencies/blocked_by" \
                   -F issue_id="$BLOCKER_ID" --silent 2>&1); then
                echo "#$BLOCKED is blocked by #$BLOCKER — $REASON"
                COUNT=$((COUNT+1))
              else
                echo "skip: could not link #$BLOCKED to #$BLOCKER: $ERR"
              fi
            done < <(jq -r '.items[] | select(.type == "link_blocked_by")
                            | [.blocked, .blocker, .reason] | @tsv' "$GH_AW_AGENT_OUTPUT")
            echo "linked $COUNT dependency edge(s)" >> "$GITHUB_STEP_SUMMARY"

    # Removing an edge is only ever the pipeline undoing its own work. The job,
    # not the agent, decides what happens: an edge the pipeline added is
    # removed; an edge the issue declares (`Depends on #N`) stays, because the
    # issue text is the source; an edge a person added gets a comment proposing
    # removal, and the person decides.
    unlink_blocked_by:
      name: "Remove a blocked-by dependency that no longer holds"
      description: "Say that an existing edge is wrong: `blocked` no longer needs to wait for `blocker`. Both are issue numbers, without the #. The pipeline removes the edge only if it added it; otherwise it asks the person who did."
      runs-on: ubuntu-latest
      max: 10
      permissions:
        issues: write
      inputs:
        blocked:
          description: "Number of the issue that is waiting"
          required: true
          type: string
        blocker:
          description: "Number of the issue it no longer needs to wait for"
          required: true
          type: string
        reason:
          description: "One sentence: why the wait no longer holds"
          required: true
          type: string
      output: "Handled the edges that no longer hold."
      steps:
        - name: Remove or propose
          env:
            GH_TOKEN: ${{ github.token }}
            REPO: ${{ github.repository }}
          run: |
            set -euo pipefail
            [ -f "$GH_AW_AGENT_OUTPUT" ] || { echo "no agent output"; exit 0; }
            while IFS=$'\t' read -r BLOCKED BLOCKER REASON; do
              case "$BLOCKED$BLOCKER" in *[!0-9]*|"") echo "skip: non-numeric ($BLOCKED, $BLOCKER)"; continue;; esac
              gh api "repos/$REPO/issues/$BLOCKED/dependencies/blocked_by" --jq '.[].number' | grep -qx "$BLOCKER" \
                || { echo "skip: #$BLOCKED is not blocked by #$BLOCKER"; continue; }
              if gh api "repos/$REPO/issues/$BLOCKED" --jq '.body // ""' \
                   | grep -oiE '^[[:space:]*-]*depends on #[0-9]+' | grep -qE "#$BLOCKER\$"; then
                echo "kept: #$BLOCKED declares 'Depends on #$BLOCKER'; the issue text decides"; continue
              fi
              ACTOR=$(gh api graphql -F owner="${REPO%/*}" -F name="${REPO#*/}" -F n="$BLOCKED" -f query='
                query($owner: String!, $name: String!, $n: Int!) { repository(owner: $owner, name: $name) {
                  issue(number: $n) { timelineItems(itemTypes: [BLOCKED_BY_ADDED_EVENT], last: 100) {
                    nodes { ... on BlockedByAddedEvent { actor { login } blockingIssue { number } } } } } } }' \
                --jq "[.data.repository.issue.timelineItems.nodes[] | select(.blockingIssue.number == $BLOCKER)] | last | .actor.login // \"\"")
              if [ "$ACTOR" = "github-actions" ]; then
                ID=$(gh api "repos/$REPO/issues/$BLOCKER" --jq '.id')
                if ERR=$(gh api -X DELETE "repos/$REPO/issues/$BLOCKED/dependencies/blocked_by/$ID" --silent 2>&1); then
                  echo "#$BLOCKED no longer blocked by #$BLOCKER — $REASON"
                else
                  echo "could not unlink #$BLOCKED from #$BLOCKER: $ERR"
                fi
              else
                gh api -X POST "repos/$REPO/issues/$BLOCKED/comments" --silent -f body="The linker thinks #$BLOCKER no longer blocks this: $REASON @$ACTOR added the link; remove it if you agree."
                echo "proposed to @$ACTOR: unlink #$BLOCKED from #$BLOCKER"
              fi
            done < <(jq -r '.items[] | select(.type == "unlink_blocked_by")
                            | [.blocked, .blocker, .reason] | @tsv' "$GH_AW_AGENT_OUTPUT")


timeout-minutes: 20
---

# Relate

You are describing how this repository's open issues depend on each other. You
do not judge whether any single issue is good — that is the refiner's job, and
it has already run. Your question is about the **set**.

## Step 1: Read the backlog

- `/tmp/gh-aw/agent/backlog.json` — every open issue not yet merged: number,
  title, labels, and the first part of the body. Merged issues are already on
  `develop`; they are not work to wait for, so they are left out.
- `/tmp/gh-aw/agent/existing-links.jsonl` — the blocked-by edges that already
  exist, each with `added_by` (`pipeline` or `person`) and `declared` (the issue
  says `Depends on #N`, and those were linked for you before this run).
  **Anything already recorded there is done. Do not propose it again.**

Read `src/` and `test/` if you need to know what exists today.

## Step 2: Find the dependencies that are real

Record an edge with `link_blocked_by` when one issue genuinely **cannot be
finished until another is**, for a reason you can state in one sentence:

- it needs a function, file or behaviour that the other issue creates;
- it changes something the other issue is replacing, so doing it first wastes
  the work;
- it asks for a decision the other issue settles.

**Do not record an edge for issues that are merely related, similar, or in the
same area.** "These both touch the dashboard" is not a dependency. A backlog
where everything blocks something is a backlog nobody can start, and an edge is
a claim that work must wait — the most expensive thing you can say about an
issue. When you are unsure, say nothing.

Never claim an issue blocks itself, and never record a cycle: if A waits for B,
B cannot wait for A. Before recording, check the edge you are about to add
against the ones you have already added this run.

## Step 3: Remove what no longer holds

An existing edge is wrong when its reason no longer holds: the blocked issue was
rewritten and no longer needs the blocker, or the blocker's scope changed so it
no longer provides what was needed. Call `unlink_blocked_by` with the reason.
The pipeline removes the edge only if it added it; for an edge a person added it
asks them instead. Leave `declared` edges alone: the issue text decides those.
Be as careful as when adding: when unsure, leave the edge.

## Step 4: Say what is now blocked, once

If you recorded or removed any edges, add **one** comment with `add_comment`, on the issue
that ended up with the most blockers, summarising what now waits on what and
why. One comment per run, not one per edge: the edges are visible on the issues
themselves, and this is for whoever reads the backlog next.

## Step 5: Nothing to change is the usual answer

Most runs over a settled backlog should find nothing new. Call `noop` with a
one-line reason. A role that invents a relationship in order to have done
something makes the backlog worse than leaving it alone.

## What you must never do

- Never edit an issue's title or body — that is the refiner's job and yours
  would overwrite it.
- Never add or remove labels, close an issue, or touch a pull request.
- Never record an edge that is already in `existing-links.jsonl`.
