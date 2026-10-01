---
emoji: "✏️"
description: Refines the issues a person marked `needs-refinement` until they are clear enough to start and small enough to review, and marks them `refined` for a person to confirm as `ready`.
intent: Let a person write an issue the way they think, ask for it to be refined, and find it implementable by morning, without a person rewriting it.


inlined-imports: true

imports:
  - shared/model.md
  - shared/budget.md
  - shared/threat-detection.md
  - shared/graders.md
  - uses: shared/postconditions.md
    with:
      role: refine

on:
  # Fuzzy `daily` rather than a fixed cron: the compiler warns that a fixed
  # time contributes to load spikes, and scheduled runs are dropped — not
  # merely delayed — when GitHub is busy, which is worst on the hour.
  schedule: daily
  # "Run workflow": refine one issue (or an epic's pieces) now, without waiting
  # for tonight; or the whole backlog with a different settling period.
  workflow_dispatch:
    inputs:
      issue:
        description: "Refine only this issue, or this epic's pieces. Empty: the backlog."
        required: false
        default: ""
      settle_hours:
        description: "Override the settling period, in hours. 0 considers every issue, however recently edited. For testing the role without waiting a night."
        required: false
        default: ""
      design_since:
        description: "A design change sent these issues back: the commit before it, so the refiner sees what changed (back-to-refinement.yml)."
        required: false
        default: ""
  # No event triggers. Refinement is batch work over a backlog that changes
  # slowly; an event trigger would re-run the role over unchanged issues.
  # Pre-activation search, so an empty backlog costs no agent time at all.
  # Deliberately broad. A narrower query would also gate a run asked for one
  # issue, so asking for an issue already marked `ready` would silently do
  # nothing — and "I asked and nothing happened" is worse than one cheap no-op
  # run on a settled backlog. The deterministic step below does the real
  # filtering.
  skip-if-no-match: "is:issue is:open"

# Without a discriminator every dispatch shares one conclusion concurrency slot,
# so a second dispatch cancels the first — the shape that once killed a rework
# run mid-flight.
concurrency:
  job-discriminator: ${{ github.run_id }}

permissions:
  contents: read
  issues: read

# The current sprint lives on the Project (`Sprint` iteration field), which
# GITHUB_TOKEN cannot read. This job reads it with a token limited to reading
# projects and hands on only the issue numbers, so no App credential reaches the
# agent's job and the refiner still cannot start anything ("No github-app"
# below). The agent job waits for custom jobs.
jobs:
  sprint:
    runs-on: ubuntu-latest
    permissions:
      contents: read
    outputs:
      issues: ${{ steps.sprint.outputs.issues }}
    steps:
      - uses: actions/checkout@v7.0.1
        with:
          sparse-checkout: .github/scripts
          persist-credentials: false
      - uses: actions/create-github-app-token@v3.2.0
        id: token
        with:
          client-id: ${{ vars.REVIEWER_CLIENT_ID }}
          private-key: ${{ secrets.REVIEWER_APP_PRIVATE_KEY }}
          permission-organization-projects: read
      - name: The current sprint's issues
        id: sprint
        env:
          GH_TOKEN: ${{ steps.token.outputs.token }}
          REPO: ${{ github.repository }}
        run: |
          set -euo pipefail
          CUR=$(bash .github/scripts/current-sprint.sh "${REPO%/*}" 2)
          echo "current sprint: $(jq -c . <<<"$CUR")"
          echo "issues=$(jq -c .issues <<<"$CUR")" >> "$GITHUB_OUTPUT"

engine:
  id: pi
  env:
    PI_ROLE: refine

pre-agent-steps:

  # Which issues are candidates is a filter, not a judgement, so it is decided
  # here. The cap keeps a growing backlog from becoming a context-window failure
  # and makes the cost of a run predictable.
  - name: Choose the candidates
    env:
      GH_TOKEN: ${{ github.token }}
      # The current sprint's issue numbers, from the `sprint` job below.
      IN_SPRINT: ${{ needs.sprint.outputs.issues }}
      REPO: ${{ github.repository }}
      # Must stay equal to the safe-output `max` values below. gh-aw drops
      # output beyond `max` silently (established for review comments), so a
      # candidate the agent works on but cannot write is work
      # thrown away with no error anywhere.
      MAX_ISSUES: "15"
      # Leave an issue alone until its author has stopped typing. Rewriting a
      # body someone is still working on is worse than leaving it rough; an
      # edit puts `needs-refinement` back on (back-to-refinement.yml) while the
      # person may still be mid-thought.
      SETTLE_HOURS: ${{ inputs.settle_hours || '4' }}
      TRIGGERING_ISSUE: ${{ github.event.inputs.issue }}
    run: |
      set -euo pipefail
      mkdir -p /tmp/gh-aw/agent

      # Issue types are not in `gh issue list --json`; read them from REST once.
      gh api --paginate "repos/$REPO/issues?state=open&per_page=100" \
        --jq '.[] | select(has("pull_request") | not) | {(.number | tostring): (.type.name // "")}' \
        | jq -s 'add // {}' > /tmp/gh-aw/agent/issue-types.json
      IN_SPRINT="${IN_SPRINT:-[]}"
      echo "current sprint's issues: $IN_SPRINT"
      add_types() { jq --slurpfile t /tmp/gh-aw/agent/issue-types.json --argjson s "$IN_SPRINT" \
                      'map(. + {type: ($t[0][(.number | tostring)] // ""), sprint: (.number as $n | $s | index($n) != null)})'; }

      one() { gh issue view "$1" --repo "$REPO" \
                --json number,title,body,labels,createdAt,comments \
                --jq "{number, title, body: (.body // \"\")[0:4000],
                       labels: [.labels[].name], createdAt, comments}"; }

      # Asked for by name: refine exactly that issue, and skip every filter.
      # The settling period and the stage labels exist to decide what to touch
      # on a schedule. A person asking for an issue has already decided.
      #
      # Asked for on an epic: refine the epic's pieces, which is what "refine
      # this epic" means (an epic itself is never ready). The epic comes first,
      # as their context. Pieces already refined, ready, merged, paused or being worked are
      # left alone; the cap still holds, so a larger epic needs a second run.
      if [ -n "${TRIGGERING_ISSUE:-}" ] && [ "$TRIGGERING_ISSUE" != "0" ]; then
        if [ "$(jq -r --arg n "$TRIGGERING_ISSUE" '.[$n] // ""' /tmp/gh-aw/agent/issue-types.json)" = "Epic" ]; then
          PIECES=$(gh api --paginate "repos/$REPO/issues/$TRIGGERING_ISSUE/sub_issues" \
            --jq '.[] | select(.state == "open")
                  | select([.labels[].name] |  any(. == "ready" or . == "refined" or . == "merged"
                      or . == "agent" or . == "needs-human" or . == "paused") | not) | .number' | head -n $((MAX_ISSUES - 1)))
          { one "$TRIGGERING_ISSUE"; for N in $PIECES; do one "$N"; done; } | jq -s '.' \
            | add_types > /tmp/gh-aw/agent/refine-candidates.json
          echo "asked for epic #$TRIGGERING_ISSUE: the epic and $(printf '%s\n' $PIECES | grep -c . || true) piece(s)"
        else
          one "$TRIGGERING_ISSUE" | jq -s '.' | add_types > /tmp/gh-aw/agent/refine-candidates.json
          echo "asked for #$TRIGGERING_ISSUE"
        fi
        jq -r '.[] | "  #\(.number) \(.title)"' /tmp/gh-aw/agent/refine-candidates.json
        exit 0
      fi

      CUTOFF=$(date -u -d "-${SETTLE_HOURS} hours" +%Y-%m-%dT%H:%M:%SZ)
      # Only what a person asked for: `needs-refinement`, put on by them or by
      # back-to-refinement.yml when something the issue rests on changed. An
      # issue with no stage label is a draft and is left alone. Opt-in on
      # purpose (2026-09-28): people decide what is worth refining and confirm
      # `ready` themselves; the board's "Draft" column shows what nobody has
      # asked for yet, so nothing starves unseen. The settling period covers the
      # author who is still typing. `paused` is a person's stop button.
      # The current sprint's issues first (people committed to those), then the
      # rest, newest first within each.
      gh issue list --repo "$REPO" --state open --limit 100 --label needs-refinement \
        --json number,title,body,labels,createdAt,updatedAt,comments \
        --jq "[ .[]
                | select([.labels[].name] | any(. == \"agent\"
                    or . == \"needs-human\" or . == \"merged\" or . == \"paused\") | not)
                | select(.title | startswith(\"[aw]\") | not)
                | select(.updatedAt < \"$CUTOFF\")
                | {number, title, body: (.body // \"\")[0:4000],
                   labels: [.labels[].name], createdAt, comments} ]" \
        | add_types \
        | jq --argjson max "$MAX_ISSUES" \
            '(map(select(.sprint)) | sort_by(.createdAt) | reverse)
             + (map(select(.sprint | not)) | sort_by(.createdAt) | reverse) | .[0:$max]' \
        > /tmp/gh-aw/agent/refine-candidates.json
      echo "candidates (settled before $CUTOFF): $(jq 'length' /tmp/gh-aw/agent/refine-candidates.json)"
      jq -r '.[] | "  #\(.number) \(.title)\(if .type != "" then " [\(.type)]" else "" end)\(if .sprint then " (sprint)" else "" end)"' \
        /tmp/gh-aw/agent/refine-candidates.json

  # "Out of scope" names nearby work by the issue that owns it
  # (chain/issues.md, "Boundaries"), and the refiner cannot name siblings it
  # never sees: a run on an epic leaves out pieces already ready, and a daily
  # run sees no siblings at all (#227). So each candidate gets its neighbours:
  # the other sub-issues of its epic, and the issues it blocks.
  - name: List each candidate's neighbours
    env:
      GH_TOKEN: ${{ github.token }}
      REPO: ${{ github.repository }}
    run: |
      set -euo pipefail
      DIR=/tmp/gh-aw/agent
      what() { jq '{number, title, state, labels: [.labels[].name],
                    what: ((.body // "") | capture("## What\\s*\\n+(?<w>[^#]*)").w? // "" | .[0:300])}'; }
      for N in $(jq -r '.[].number' "$DIR/refine-candidates.json"); do
        EPIC=$(gh api "repos/$REPO/issues/$N" --jq '.parent_issue_url // "" | split("/") | last')
        SIBS='[]'
        if [ -n "$EPIC" ]; then
          SIBS=$(gh api --paginate "repos/$REPO/issues/$EPIC/sub_issues" --jq '.[]' \
                   | what | jq -s --argjson n "$N" 'map(select(.number != $n))')
        fi
        BLOCKS=$(gh api "repos/$REPO/issues/$N/dependencies/blocking" --jq '[.[].number]' 2>/dev/null || echo '[]')
        jq -n --argjson n "$N" --arg e "$EPIC" --argjson s "$SIBS" --argjson b "$BLOCKS" \
          '{issue: $n, epic: ($e | tonumber? // null), blocks: $b, siblings: $s}'
      done | jq -s '.' > "$DIR/refine-neighbours.json"
      echo "neighbours: $(jq -r 'map("#\(.issue): \(.siblings | length) siblings, blocks \(.blocks | length)") | join("; ")' "$DIR/refine-neighbours.json")"

  # The refiner rewrites issues that claim design parts, so it must see them
  # (#259): before, it imported no design input at all. The design is read
  # from develop, where it lands; this checkout is main, which has it only
  # after a release. For each candidate: the claimed parts' JSON with their
  # components resolved (design-part.sh), the tokens, and, when a design change
  # sent the issue back (input design_since), what changed inside its claims.
  # An index of the file's frames and components lets it re-point a claim whose
  # part was removed.
  - name: Give the refiner the design its candidates claim
    env:
      GH_TOKEN: ${{ github.token }}
      REPO: ${{ github.repository }}
      SINCE: ${{ github.event.inputs.design_since }}
    run: |
      set -euo pipefail
      DIR=/tmp/gh-aw/agent/design; mkdir -p "$DIR"
      CANDS=/tmp/gh-aw/agent/refine-candidates.json
      PENS=$(jq -r '.[].body' "$CANDS" | grep -oE '`[^` ]+\.pen#' | tr -d '`#' | sort -u || true)
      [ -n "$PENS" ] || { echo "no candidate claims design parts"; exit 0; }
      raw() { gh api -H "Accept: application/vnd.github.raw" "repos/$REPO/contents/$1?ref=$2"; }
      for PEN in $PENS; do
        SLUG=$(tr '/' '_' <<<"$PEN")
        raw "$PEN" develop > "$DIR/$SLUG"
        jq '.variables // {}' "$DIR/$SLUG" > "$DIR/${SLUG%.pen}.variables.json"
        jq -r '(.children // [])[] | "\(.id)\t\(.name)\t\(if .reusable then "component" else "frame" end)"' "$DIR/$SLUG" \
          > "$DIR/${SLUG%.pen}.index.tsv"
        for N in $(jq -r '.[].number' "$CANDS"); do
          for ID in $(jq -r --argjson n "$N" '.[] | select(.number == $n) | .body' "$CANDS" \
                        | { grep -oE "\`$PEN#[A-Za-z0-9_-]+\`" || true; } | sed -E 's/.*#([A-Za-z0-9_-]+)`/\1/' | sort -u); do
            mkdir -p "$DIR/$N"
            bash .github/scripts/design-part.sh "$DIR/$SLUG" "$ID" > "$DIR/$N/$ID.json" 2>/dev/null \
              || { rm -f "$DIR/$N/$ID.json"; echo "$ID" >> "$DIR/$N/removed.txt"; }
          done
        done
        if [ -n "${SINCE:-}" ]; then
          raw "$PEN" "$SINCE" > "$DIR/old.pen" 2>/dev/null || echo '{"children": []}' > "$DIR/old.pen"
          jq '[.[] | {number, title, state: "open", body}]' "$CANDS" > "$DIR/cands.json"
          bash .github/scripts/design-impact.sh "$PEN" "$DIR/old.pen" "$DIR/$SLUG" "$DIR/cands.json" > "$DIR/${SLUG%.pen}.changes.json"
          rm -f "$DIR/old.pen" "$DIR/cands.json"
        fi
      done
      echo "design for: $(ls -d "$DIR"/[0-9]* 2>/dev/null | xargs -n1 basename | sed 's/^/#/' | tr '\n' ' ')"
      cat "$DIR"/*/removed.txt 2>/dev/null | sed 's/^/claim no longer in the design: /' || true

tools:
  cli-proxy: true
  github:
    mode: gh-proxy
    min-integrity: approved
    toolsets: [issues, repos]
  bash: ["*"]
  timeout: 300

safe-outputs:
  # No run-status comments. On a label-triggered run gh-aw posts "✅ Refine
  # completed successfully!" onto the triggering issue, and on #24 the agent's
  # own text was folded into it — so the author got a report about a question
  # instead of the question. This role's only visible output should be the
  # question itself; the run's own page is the place for run status.
  activation-comments: false

  # No github-app, deliberately, and this is a safety property rather than a
  # shortcut. Writes made with GITHUB_TOKEN trigger no workflows, and this role
  # has no dispatch output, so nothing the refiner does can start an
  # implementation — the one thing this role must never do.
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
    # Never `ready`: that is a person's confirmation of `refined`.
    allowed: [refined, needs-shape, needs-split]
  # The request is answered once the issue is refined, questioned or split.
  remove-labels:
    max: 15
    target: "*"
    allowed: [needs-refinement]
  # What kind of work this is. The org defines Task, Bug, Feature and Component; an issue
  # type is a typed field, unlike a label, so it is the better home for a
  # classification the pipeline may later read.
  set-issue-type:
    max: 15
    target: "*"
    allowed: [Task, Bug, Feature, Component]
  # Priority and Effort are org-level issue FIELDS — typed, and set on the issue
  # itself rather than on a board. That is the whole reason no part of this
  # pipeline needs Projects access: a Project is a view over issues, so a field
  # set here shows up on any board that displays it, and GITHUB_TOKEN cannot
  # touch Projects at all (../pi-github-test ADR 0016).
  set-issue-field:
    max: 15
    target: "*"
    allowed-fields: [Priority, Effort]
  # A typed record of what the role decided about each issue, alongside the
  # writes. Modelled on gh-aw's own issue-triage-agent. The point is ADR 0018's:
  # a decision derived from named fields cannot be quietly inconsistent with
  # itself the way a decision buried in prose can.
  data:
    issue_number: integer
    outcome: string
    reason: string
  # A quiet night must write nothing. gh-aw's default opens an "[aw] No-Op Runs"
  # issue every time a run no-ops, which for a nightly role that legitimately
  # has nothing to do most nights is a new issue most nights — and each one then
  # shows up in the backlog this role reads. Run 35777771038 created #23 that
  # way. The run's own summary is the record.
  noop:
    report-as-issue: false

# Fifteen candidates read properly against the codebase needs more than the
# 15-20 minutes the other roles get.
timeout-minutes: 25
---

# Refine

You are preparing this repository's backlog so that an implementing agent can
start on an issue tomorrow without asking anyone a question.

**Read `.github/conventions/chain/issues.md` first.** It says what refined
means and how every heading of an issue is filled in: "Done when", boundaries,
design claims, dependencies, type, effort and priority. The headings themselves
are in `.github/ISSUE_TEMPLATE/work-item.md` (`epic.md` for an epic). The same
rules are used by `/decompose`, so follow them rather than your own. When
nothing settles a boundary, that is a question for the author (`needs-shape`),
not a case to make up.

## Step 1: Read the candidates

`/tmp/gh-aw/agent/refine-candidates.json` holds the issues to consider this run,
already filtered, capped, and ordered: the current sprint's issues come first.
Each has its body, labels, comments, `type` and `sprint` (whether it is in the
current sprint), so there is nothing to fetch again. Nothing outside that file is your business.

**An issue that was refined or ready before** has a comment starting "Back to
refinement:" naming what changed (an edit, a changed source file, a closed
spike). Read that change first and judge the issue against it. If the issue
still holds, it is already refined. If the change follows clearly from the sources (a rename, a
decision the spike made), rewrite the issue to match. If the direction itself
changed and the issue may no longer be wanted, it needs a person.

`/tmp/gh-aw/agent/refine-neighbours.json` lists, for each candidate, the
other sub-issues of its epic (number, title, stage labels, the start of "What")
and the issues it blocks. Use it for "Out of scope": name the nearby work each
neighbour owns, by number, as `issues.md` ("Boundaries") says. An issue whose
"Out of scope" names no neighbour it plausibly overlaps is not refined yet.

`/tmp/gh-aw/agent/design/` holds the design for candidates that claim parts
(`.github/conventions/chain/design.md` says how a pen file is built):
`<issue>/<id>.json` is each claimed part with its components resolved;
`<issue>/removed.txt` lists claims whose part no longer exists; `*.index.tsv`
lists the file's frames and components (id, name, kind); `*.variables.json` is
its tokens; `*.changes.json`, when present, is what a design change altered
inside each candidate's claims. An issue describes behaviour and claims parts;
it does not copy sizes, colours or text from them (`issues.md`, "Design
claims"). So when the design changed:
- If the change is only visual, the issue still holds: mark it `refined` and
  remove any design values it copied.
- If behaviour changed (a state added or removed, an element gone), rewrite what
  the issue asks for to match.
- Re-point a removed claim to the part that replaced it (same name, or found in
  the index). If none clearly did, ask the author.

**When the run was asked for on an epic,** the candidates are that epic and its
pieces that are not refined or ready yet. Read the epic first: its goal, sources and "Out
of scope" apply to every piece.

**An issue of type `Epic`** is never built itself; its sub-issues are. Check it
against `.github/ISSUE_TEMPLATE/epic.md` instead of `work-item.md`, rewrite it
into that shape or ask its author, and **never mark an epic `refined`**.

Use `gh` and the repository's files read-only to understand what an issue is
asking for — read `docs/architecture.md` and the code it points to, to see what
already exists, so you do not
ask for something that is already there or describe it in the wrong terms.

## Step 2: For each candidate, do exactly one of these

**Make it refined.** If the issue is nearly there and you can close the gap from
what is already in the repository, rewrite it into the template's shape with
`update_issue` and add `refined` with `add_labels`. **Replace the body — do not
append to it:** pass `"operation": "replace"` in the `update_issue` payload.
gh-aw appends when it is missing, and the pipeline refuses a body without it.
The new body is the whole issue, written as `issues.md` says. Leaving the
original text above your version doubles the issue and makes an implementer
read two specifications and guess which one counts; the edit history keeps what
was there before. The body must pass `.github/scripts/check-issue.sh`; the
pipeline runs it on every `update_issue`, refuses a body that fails, and tells
you why, so you need not run it yourself.
Do not link issues yourself: the linker reads the `Depends on #N — why` lines
and records the links.

**It is already refined.** Add `refined` and change nothing. This is a common
and correct outcome.

**It needs a person to decide something.** Add `needs-shape` and one comment
**addressed to the author, whose body is the question itself**. Use this when
the gap is a decision only the author can make, not when it is detail you could
have looked up.

Write what you would say to them: what you need to know, why it matters, and —
where it helps — the two or three answers you can see, so they can reply with
one word. Never write a report about what you did. "Marked needs-shape:
requires author decision on rounding" tells the author nothing they can answer;
"Should rounding change the existing functions, live in a new helper, or happen
at display time?" does. Pass the issue number as `item_number`, and never use
`target: status` — that edits the run's own status comment instead of speaking
to the author.

**It is too large.** Add `needs-split` and one comment proposing how it divides
— the pieces, in the order they would be built. **Do not split it yourself.**
Noticing that an issue is too big is much easier than dividing it well, and
dividing it is the author's call.

**Whichever of these you do, remove `needs-refinement`** with `remove_labels`:
the person's request is answered, by a refined issue, a question or a proposed
split.

## Step 3: Classify what you touched

For every issue you mark `refined`, also set its type with `set_issue_type`
and its `Effort` (and `Priority`, only with evidence) with `set_issue_field`,
as `issues.md` says. The type says what kind of work it is; add no topic
labels. The field names differ between these tools:

```json
{"issue_number": 125, "issue_type": "Component"}
{"issue_number": 125, "field_name": "Effort", "value": "Medium"}
{"item_number": 125, "labels": ["refined"]}
```

(`set_issue_type`, `set_issue_field`, `add_labels`, in that order.)

## Step 4: Record what you decided

Emit one `data` record per issue you considered, with `issue_number`, `outcome`
— exactly one of `refined`, `rewritten`, `question`, `too-big` — and a one-line
`reason`. Name the outcome you actually took; a record that disagrees with what
you did is worse than no record.

## Step 5: A quiet night writes nothing

If every candidate is already refined and correctly labelled, or there are no
candidates, call `noop` with a one-line reason. An agent asked to improve a
clean backlog will improve it anyway, and that churn lands in the edit history
that is this role's only audit trail.

## What you must never do

- **Never label an issue `ready`.** `ready` is a person's confirmation that a
  refined issue can be started, and this role does not make it. (You could not
  if you tried: your labels are restricted, and your writes cannot start a
  workflow.)
- Never close an issue, never edit code, never touch a pull request.
- Never edit an issue that is not in the candidates file.
