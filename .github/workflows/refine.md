---
emoji: "✏️"
description: Moves open issues toward ready — clear enough to start without asking a question, small enough to review.
intent: Let a person write an issue the way they think, and have it be implementable by morning, without a person rewriting it.

on:
  # Fuzzy `daily` rather than a fixed cron: the compiler warns that a fixed
  # time contributes to load spikes, and scheduled runs are dropped — not
  # merely delayed — when GitHub is busy, which is worst on the hour.
  schedule: daily
  workflow_dispatch:
    inputs:
      settle_hours:
        description: "Override the settling period, in hours. 0 considers every issue, however recently edited. For testing the role without waiting a night."
        required: false
        default: ""
  # No event triggers. Refinement is batch work over a backlog that changes
  # slowly; an event trigger would re-run the role over unchanged issues.
  # Pre-activation search, so an empty backlog costs no agent time at all.
  skip-if-no-match: "is:issue is:open -label:refined -label:implement -label:agent -label:agentic-workflows -label:draft"

  stop-after: +30d

# Without a discriminator every dispatch shares one conclusion concurrency slot,
# so a second dispatch cancels the first — the shape that once killed a rework
# run mid-flight (FINDINGS).
concurrency:
  job-discriminator: ${{ github.run_id }}

permissions:
  contents: read
  issues: read

engine:
  id: pi
  model: anthropic/claude-haiku-4-5-20251001
  env:
    PI_ROLE: refine

pre-agent-steps:
  - name: Install role postconditions extension
    run: |
      set -euo pipefail
      mkdir -p /tmp/gh-aw/pi-agent-dir/extensions
      cp .github/pi/postconditions.cjs /tmp/gh-aw/pi-agent-dir/extensions/postconditions.js
      echo "installed: $(wc -c < /tmp/gh-aw/pi-agent-dir/extensions/postconditions.js) bytes, role=$PI_ROLE"
    env:
      PI_ROLE: refine

  # Which issues are candidates is a filter, not a judgement, so it is decided
  # here. The cap keeps a growing backlog from becoming a context-window failure
  # and makes the cost of a run predictable.
  - name: Choose the candidates
    env:
      GH_TOKEN: ${{ github.token }}
      REPO: ${{ github.repository }}
      # Must stay equal to the safe-output `max` values below. gh-aw drops
      # output beyond `max` silently (established for review comments in
      # FINDINGS), so a candidate the agent works on but cannot write is work
      # thrown away with no error anywhere.
      MAX_ISSUES: "15"
      # Leave an issue alone until its author has stopped typing. Rewriting a
      # body someone is still working on is worse than leaving it rough, and a
      # settling period buys that without asking anyone to remember a label —
      # an issue nobody remembers to mark would simply never be refined.
      SETTLE_HOURS: ${{ inputs.settle_hours || '4' }}
    run: |
      set -euo pipefail
      mkdir -p /tmp/gh-aw/agent
      CUTOFF=$(date -u -d "-${SETTLE_HOURS} hours" +%Y-%m-%dT%H:%M:%SZ)
      # Skip anything a person or an agent is already working from, anything a
      # previous night judged ready, anything parked on a human decision, and
      # gh-aw's own bookkeeping issues — a failure report is not backlog.
      #
      # `draft` is the author's own opt-out: a half-written reminder they intend
      # to finish later. It is opt-OUT rather than an opt-IN "ready to refine"
      # label on purpose — with opt-in, an issue nobody remembers to mark is an
      # issue that is never refined, and silent starvation is this pipeline's
      # recurring failure shape. The settling period below covers the author who
      # is still typing; `draft` covers the one who has deliberately stopped.
      gh issue list --repo "$REPO" --state open --limit 100 \
        --json number,title,body,labels,createdAt,updatedAt,comments \
        --jq "[ .[]
                | select([.labels[].name] | any(. == \"refined\" or . == \"implement\"
                    or . == \"agent\" or . == \"needs-human\" or . == \"needs-split\"
                    or . == \"needs-shape\" or . == \"agentic-workflows\"
                    or . == \"draft\") | not)
                | select(.title | startswith(\"[aw]\") | not)
                | select(.updatedAt < \"$CUTOFF\")
                | {number, title, body: (.body // \"\")[0:4000],
                   labels: [.labels[].name], createdAt, comments} ]
              | sort_by(.createdAt) | reverse | .[0:${MAX_ISSUES}]" \
        > /tmp/gh-aw/agent/refine-candidates.json
      echo "candidates (settled before $CUTOFF): $(jq 'length' /tmp/gh-aw/agent/refine-candidates.json)"
      jq -r '.[] | "  #\(.number) \(.title)"' /tmp/gh-aw/agent/refine-candidates.json

tools:
  cli-proxy: true
  github:
    mode: gh-proxy
    min-integrity: approved
    toolsets: [issues, repos]
  bash: ["*"]
  timeout: 300

safe-outputs:
  # No github-app, deliberately, and this is a safety property rather than a
  # shortcut. Writes made with GITHUB_TOKEN trigger no workflows, so nothing the
  # refiner does can start an implementation — it is mechanically incapable of
  # putting work into the pipeline, which is the one thing this role must never
  # do. Every other role here needs an App precisely because its writes must
  # cascade.
  # These three caps and MAX_ISSUES above are one number in three places. Raise
  # or lower them together.
  update-issue:
    max: 15
    # Not the triggering issue: a scheduled run has none.
    target: "*"
    # `title:` with no value is how gh-aw enables a field — the key's presence
    # is the permission. A boolean here fails to compile.
    title:
    body: true
  add-comment:
    max: 15
    target: "*"
  add-labels:
    max: 15
    # A scheduled run has no triggering issue, so the default `triggering`
    # target would have nothing to act on.
    target: "*"
    allowed: [refined, needs-shape, needs-split, bug, enhancement, documentation]
  # What kind of work this is. The org defines Task, Bug and Feature; an issue
  # type is a typed field, unlike a label, so it is the better home for a
  # classification the pipeline may later read.
  set-issue-type:
    max: 15
    target: "*"
    allowed: [Task, Bug, Feature]
  # Existing milestones only — no `auto_create`. Deciding that a release exists
  # and what goes in it is planning, and planning stays with people for the same
  # reason decomposition does (../pi-github-test ADR 0015). With no milestones
  # defined, this output simply never fires.
  assign-milestone:
    max: 15
    target: "*"
  # A typed record of what the role decided about each issue, alongside the
  # writes. Modelled on gh-aw's own issue-triage-agent. The point is ADR 0018's:
  # a decision derived from named fields cannot be quietly inconsistent with
  # itself the way a decision buried in prose can.
  data:
    issue_number: integer
    outcome: string
    reason: string
  noop:
  threat-detection:
    engine:
      id: claude
      model: claude-haiku-4-5-20251001
    continue-on-error: false
    retries: 2

# Fifteen candidates read properly against the codebase needs more than the
# 15 minutes the other roles get.
timeout-minutes: 25
---

# Refine

You are preparing this repository's backlog so that an implementing agent can
start on an issue tomorrow without asking anyone a question.

**Ready** means two things at once:

- **Clear** — someone could start without asking a question. The behaviour
  wanted is stated, including what should happen at the edges, and it says how
  anyone would know it works.
- **Small** — one pull request's worth, reviewable in one sitting.

**The shape of a ready issue is defined in `.github/ISSUE_TEMPLATE/work-item.md`
— read that file first and use exactly its headings.** It is the single
definition of ready; do not invent your own structure, and if it changes, follow
it. Keep a heading the author left empty only if you genuinely cannot fill it,
and say why under it.

## Step 1: Read the candidates

`/tmp/gh-aw/agent/refine-candidates.json` holds the issues to consider this run,
already filtered and capped. Nothing outside that file is your business.

Use `gh` and the repository's files read-only to understand what an issue is
asking for — read `src/` and `test/` to see what already exists, so you do not
ask for something that is already there or describe it in the wrong terms.

## Step 2: For each candidate, do exactly one of these

**Make it ready.** If the issue is nearly there and you can close the gap from
what is already in the repository, rewrite it into the template's shape with
`update_issue` and add `refined` with `add_labels`. Keep the author's intent and their words where you
can; you are filling in what an implementer would otherwise have to ask, not
rewriting their request into your own. State the behaviour wanted, what happens
at the boundaries, and how anyone would know it works. Do not invent a
requirement the author did not ask for — if a decision is genuinely the
author's, that is the next case, not a guess.

**It is already ready.** Add `refined` and change nothing. This is a common and
correct outcome.

**It needs a person to decide something.** Add `needs-shape` and one comment
naming the question, in one or two sentences. Use this when the gap is a
decision only the author can make, not when it is detail you could have looked
up.

**It is too large.** Add `needs-split` and one comment proposing how it divides
— the pieces, in the order they would be built. **Do not split it yourself.**
Noticing that an issue is too big is much easier than dividing it well, and
dividing it is the author's call.

## Step 3: Classify what you touched

For every issue you mark `refined`, also:

- **Set its type** with `set_issue_type`: `Bug` for something behaving wrongly,
  `Feature` for new behaviour, `Task` for everything else. One of the three
  always applies; this is not a judgement call to agonise over.
- **Add at most one topic label** — `bug`, `enhancement` or `documentation` —
  and only when it is obvious. A label nobody filters on is noise.
- **Assign a milestone** with `assign_milestone` only if an existing milestone
  clearly covers this work. Never invent one: deciding that a release exists,
  and what goes in it, is a person's call. If no milestone fits, assign none.

## Step 4: Record what you decided

Emit one `data` record per issue you considered, with `issue_number`, `outcome`
— exactly one of `ready`, `rewritten`, `question`, `too-big` — and a one-line
`reason`. Name the outcome you actually took; a record that disagrees with what
you did is worse than no record.

## Step 5: A quiet night writes nothing

If every candidate is already ready and correctly labelled, or there are no
candidates, call `noop` with a one-line reason. An agent asked to improve a
clean backlog will improve it anyway, and that churn lands in the edit history
that is this role's only audit trail.

## What you must never do

- **Never label an issue `implement`.** That label starts an implementing agent.
  Deciding that work should begin is a person's call, and this role does not
  make it. (You could not do it if you tried: your labels are restricted, and
  your writes cannot start a workflow.)
- Never close an issue, never edit code, never touch a pull request.
- Never edit an issue that is not in the candidates file.
