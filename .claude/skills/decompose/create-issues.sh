#!/usr/bin/env bash
# Creates an epic and its sub-issues from an approved plan, as the person
# running it (their `gh` login). Deterministic: the agent drafts the plan, this
# writes it.
#
#   bash create-issues.sh --dry-run plan.json   # print what would be created
#   bash create-issues.sh plan.json             # create it
#
# plan.json:
#   {
#     "epic": { "title": "Todo lists", "body": "## Goal\n..." },   # or { "number": 70 }
#     "issues": [
#       { "key": "store", "title": "...", "body": "## What\n...",
#         "type": "Task", "priority": "High",                      # both optional
#         "depends_on": [ { "key": "other", "why": "needs its store" },
#                         { "number": 12, "why": "..." } ] }        # optional
#     ]
#   }
#
# type: Feature, Task or Bug. priority: High, Medium or Low, set only when the
# person decided it. Each dependency becomes a native "blocked by" link and a
# `Depends on #N — why` line under the issue's "## Details".
set -euo pipefail

DRY=0
[ "${1:-}" = "--dry-run" ] && { DRY=1; shift; }
case "${1:-}" in -h|--help|"") sed -n '2,23p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;; esac
PLAN="$1"
REPO=$(gh repo view --json nameWithOwner --jq .nameWithOwner)
OWNER="${REPO%/*}"; NAME="${REPO#*/}"

# --- check the plan before writing anything --------------------------------
jq -e '.issues | type == "array" and length > 0' "$PLAN" >/dev/null || { echo "plan: no issues"; exit 1; }
jq -e '.epic.number or (.epic.title and .epic.body)' "$PLAN" >/dev/null || { echo "plan: epic needs a number, or a title and a body"; exit 1; }
DUP=$(jq -r '[.issues[].key] | group_by(.) | map(select(length > 1)[0]) | .[]' "$PLAN")
[ -z "$DUP" ] || { echo "plan: duplicate keys: $DUP"; exit 1; }
BAD=$(jq -r '[.issues[].key] as $k | .issues[] | .key as $me | (.depends_on // [])[]
             | select(.key and ((.key as $d | $k | index($d)) == null) or .key == $me) | "\($me) -> \(.key)"' "$PLAN")
[ -z "$BAD" ] || { echo "plan: dependencies on unknown keys or on themselves: $BAD"; exit 1; }
BADV=$(jq -r '.issues[] | select(((.type // "Task") as $t | ["Feature","Task","Bug"] | index($t)) == null
                             or (.priority and ((.priority as $p | ["High","Medium","Low"] | index($p)) == null))) | .key' "$PLAN")
[ -z "$BADV" ] || { echo "plan: type must be Feature/Task/Bug and priority High/Medium/Low: $BADV"; exit 1; }
# No cycles: peel off issues whose in-plan dependencies are all peeled, until none are left.
LEFT=$(jq -c '[.issues[] | {key, deps: [(.depends_on // [])[] | .key // empty]}]' "$PLAN")
while [ "$(jq 'length' <<<"$LEFT")" -gt 0 ]; do
  NEXT=$(jq -c '[.[].key] as $keys | map(.deps |= map(select(. as $d | $keys | index($d))))
                | map(select(.deps | length > 0))' <<<"$LEFT")
  [ "$(jq 'length' <<<"$NEXT")" -lt "$(jq 'length' <<<"$LEFT")" ] || { echo "plan: dependency cycle among: $(jq -r '[.[].key] | join(", ")' <<<"$LEFT")"; exit 1; }
  LEFT="$NEXT"
done

if [ "$DRY" = 1 ]; then
  echo "Would create in $REPO:"
  jq -r 'if .epic.number then "  epic: existing #\(.epic.number)" else "  epic: \(.epic.title)" end' "$PLAN"
  jq -r '.issues[] | "    - [\(.key)] \(.title)  (\(.type // "Task")\(if .priority then ", \(.priority)" else "" end))"
                     + ((.depends_on // []) | map("\n        blocked by " + (if .key then "[\(.key)]" else "#\(.number)" end) + " — \(.why)") | join(""))' "$PLAN"
  exit 0
fi

# --- write ------------------------------------------------------------------
issue_id() { gh api "repos/$REPO/issues/$1" --jq .id; }
set_type() { gh api -X PATCH "repos/$REPO/issues/$1" -f type="$2" --silent 2>/dev/null \
               || echo "  warning: could not set type $2 on #$1 (does the org have that issue type?)"; }
set_priority() {
  local node opt
  opt=$(gh api graphql -F owner="$OWNER" -F name="$NAME" -f query='
    query($owner: String!, $name: String!) { repository(owner: $owner, name: $name) {
      issueFields(first: 100) { nodes { ... on IssueFieldSingleSelect { id name options { id name } } } } } }' \
    --jq "[.data.repository.issueFields.nodes[] | select(.name == \"Priority\")][0] | {field: .id, option: ([.options[] | select(.name == \"$2\")][0].id)}")
  if [ -z "$(jq -r '.option // empty' <<<"$opt")" ]; then echo "  warning: no Priority option $2"; return 0; fi
  node=$(gh api "repos/$REPO/issues/$1" --jq .node_id)
  gh api graphql -f query='mutation($issue: ID!, $field: ID!, $option: ID!) {
      setIssueFieldValue(input: {issueId: $issue, issueFields: [{fieldId: $field, singleSelectOptionId: $option}]}) { issue { id } } }' \
    -F issue="$node" -F field="$(jq -r .field <<<"$opt")" -F option="$(jq -r .option <<<"$opt")" --silent \
    || echo "  warning: could not set Priority on #$1"
}

EPIC=$(jq -r '.epic.number // empty' "$PLAN")
if [ -z "$EPIC" ]; then
  EPIC=$(jq -n --slurpfile p "$PLAN" '{title: $p[0].epic.title, body: $p[0].epic.body}' \
         | gh api -X POST "repos/$REPO/issues" --input - --jq .number)
  echo "epic #$EPIC"
  set_type "$EPIC" Epic
fi

NUMS='{}'   # key -> issue number; JSON, not `declare -A`, which macOS's bash 3.2 lacks
num() { jq -r --arg k "$1" '.[$k]' <<<"$NUMS"; }
for K in $(jq -r '.issues[].key' "$PLAN"); do
  ITEM=$(jq -c --arg k "$K" '.issues[] | select(.key == $k)' "$PLAN")
  N=$(jq '{title, body}' <<<"$ITEM" | gh api -X POST "repos/$REPO/issues" --input - --jq .number)
  NUMS=$(jq -c --arg k "$K" --argjson n "$N" '. + {($k): $n}' <<<"$NUMS")
  echo "  #$N [$K] $(jq -r .title <<<"$ITEM")"
  set_type "$N" "$(jq -r '.type // "Task"' <<<"$ITEM")"
  P=$(jq -r '.priority // empty' <<<"$ITEM"); [ -z "$P" ] || set_priority "$N" "$P"
  gh api -X POST "repos/$REPO/issues/$EPIC/sub_issues" -F sub_issue_id="$(issue_id "$N")" --silent \
    || echo "  warning: could not add #$N as a sub-issue of #$EPIC"
done

# Dependencies last, once every issue has a number.
for K in $(jq -r '.issues[].key' "$PLAN"); do
  N=$(num "$K")
  LINES=""
  # One JSON object per line: tab-separated fields would collapse an empty one.
  while read -r DEP; do
    [ -n "$DEP" ] || continue
    WHY=$(jq -r '.why' <<<"$DEP")
    B=$(jq -r '.number // empty' <<<"$DEP"); [ -n "$B" ] || B=$(num "$(jq -r '.key' <<<"$DEP")")
    gh api -X POST "repos/$REPO/issues/$N/dependencies/blocked_by" -F issue_id="$(issue_id "$B")" --silent \
      && echo "  #$N blocked by #$B" || echo "  warning: could not link #$N blocked by #$B"
    LINES+="Depends on #$B — $WHY"$'\n'
  done < <(jq -c --arg k "$K" '.issues[] | select(.key == $k) | (.depends_on // [])[]' "$PLAN")
  [ -n "$LINES" ] || continue
  BODY=$(gh api "repos/$REPO/issues/$N" --jq '.body // ""')
  if grep -q '^## Details' <<<"$BODY"; then
    # From a file: macOS awk refuses a multi-line -v value.
    ADD=$(mktemp); printf '%s' "$LINES" > "$ADD"
    BODY=$(awk -v f="$ADD" '{print} /^## Details/ && !done {print ""; while ((getline l < f) > 0) print l; done=1}' <<<"$BODY")
    rm -f "$ADD"
  else
    BODY="$BODY"$'\n\n## Details\n\n'"$LINES"
  fi
  jq -n --arg b "$BODY" '{body: $b}' | gh api -X PATCH "repos/$REPO/issues/$N" --input - --silent
done

echo "Done: https://github.com/$REPO/issues/$EPIC"
