---
emoji: "🔗"
description: Records how open issues relate to each other — what blocks what, and what belongs under what.
intent: Give the backlog the relationships a per-issue reader cannot see, so nobody starts work that cannot finish.

on:
  # Daily, and offset from the refiner: this role reads issues the refiner has
  # already rewritten, so it is worth running after it rather than beside it.
  schedule: daily
  workflow_dispatch:
  # Cheap when the backlog is small; skipped entirely when there is nothing open.
  skip-if-no-match: "is:issue is:open"
  stop-after: +30d

# Without a discriminator every dispatch shares one conclusion concurrency slot,
# so a second dispatch cancels the first (FINDINGS).
concurrency:
  job-discriminator: ${{ github.run_id }}

permissions:
  contents: read
  issues: read

engine:
  id: pi
  model: anthropic/claude-haiku-4-5-20251001
  env:
    PI_ROLE: relate

pre-agent-steps:
  - name: Install role postconditions extension
    run: |
      set -euo pipefail
      mkdir -p /tmp/gh-aw/pi-agent-dir/extensions
      cp .github/pi/postconditions.cjs /tmp/gh-aw/pi-agent-dir/extensions/postconditions.js
      echo "installed: $(wc -c < /tmp/gh-aw/pi-agent-dir/extensions/postconditions.js) bytes, role=$PI_ROLE"
    env:
      PI_ROLE: relate

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
                | select([.labels[].name] | any(. == \"agentic-workflows\") | not)
                | select(.title | startswith(\"[aw]\") | not)
                | {number, title, labels: [.labels[].name],
                   body: (.body // \"\")[0:1200]} ]" \
        > /tmp/gh-aw/agent/backlog.json

      # `blocked_by` edges are written from the blocked issue and read the same
      # way; there is no bulk endpoint, so this is one call per issue.
      : > /tmp/gh-aw/agent/existing-links.jsonl
      for N in $(jq -r '.[].number' /tmp/gh-aw/agent/backlog.json); do
        BLOCKERS=$(gh api "repos/$REPO/issues/$N/dependencies/blocked_by" \
                     --jq '[.[].number]' 2>/dev/null || echo '[]')
        [ "$BLOCKERS" = "[]" ] || echo "{\"issue\":$N,\"blocked_by\":$BLOCKERS}" \
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
    max: 10
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
              BLOCKER_ID=$(gh api "repos/$REPO/issues/$BLOCKER" --jq '.id' 2>/dev/null) || {
                echo "skip: #$BLOCKER not readable"; continue; }
              if gh api -X POST "repos/$REPO/issues/$BLOCKED/dependencies/blocked_by" \
                   -F issue_id="$BLOCKER_ID" --silent 2>/dev/null; then
                echo "#$BLOCKED is blocked by #$BLOCKER — $REASON"
                COUNT=$((COUNT+1))
              else
                echo "skip: could not link #$BLOCKED to #$BLOCKER (already linked, or closed)"
              fi
            done < <(jq -r '.items[] | select(.type == "link_blocked_by")
                            | [.blocked, .blocker, .reason] | @tsv' "$GH_AW_AGENT_OUTPUT")
            echo "linked $COUNT dependency edge(s)" >> "$GITHUB_STEP_SUMMARY"

  threat-detection:
    engine:
      id: claude
      model: claude-haiku-4-5-20251001
    continue-on-error: false
    retries: 2

timeout-minutes: 20
---

# Relate

You are describing how this repository's open issues depend on each other. You
do not judge whether any single issue is good — that is the refiner's job, and
it has already run. Your question is about the **set**.

## Step 1: Read the backlog

- `/tmp/gh-aw/agent/backlog.json` — every open issue: number, title, labels, and
  the first part of the body.
- `/tmp/gh-aw/agent/existing-links.jsonl` — the blocked-by edges that already
  exist. **Anything already recorded there is done. Do not propose it again.**

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

## Step 3: Say what is now blocked, once

If you recorded any edges, add **one** comment with `add_comment`, on the issue
that ended up with the most blockers, summarising what now waits on what and
why. One comment per run, not one per edge: the edges are visible on the issues
themselves, and this is for whoever reads the backlog next.

## Step 4: Nothing to link is the usual answer

Most runs over a settled backlog should find nothing new. Call `noop` with a
one-line reason. A role that invents a relationship in order to have done
something makes the backlog worse than leaving it alone.

## What you must never do

- Never edit an issue's title or body — that is the refiner's job and yours
  would overwrite it.
- Never add or remove labels, close an issue, or touch a pull request.
- Never record an edge that is already in `existing-links.jsonl`.
