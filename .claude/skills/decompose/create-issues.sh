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
#     "assignee": "octocat",                                        # optional: who is responsible
#     "epic": { "title": "Todo lists", "body": "## Goal\n..." },   # or { "number": 70 }
#     "issues": [                                                   # may be empty: an epic for a later wave
#       { "key": "store", "title": "...", "body": "## What\n...",
#         "type": "Task", "priority": "High",                      # both optional
#         "labels": ["human"], "assignee": "someone",                # optional
#         "depends_on": [ { "key": "other", "why": "needs its store" },
#                         { "number": 12, "why": "..." } ] }        # optional
#     ]
#   }
#
# type: Feature, Task, Bug or Component. priority: High, Medium or Low, set only
# when the person decided it. Every issue is created with `needs-refinement`. Each dependency becomes a native "blocked by" link and a
# `Depends on #N — why` line under the issue's "## Details". Issues are created
# blockers first, each complete in one `gh issue create` (--type, --parent,
# --blocked-by), so nothing is patched afterwards.
#
# Design claims in a body (`design.pen#<id>`) are rendered with the pen.dev CLI
# and attached to the issue as images, below the claims (`gh issue create
# --attach`, gh 2.99+). Nothing is committed. Without a logged-in `pen`, the
# issue is created without images and the script says so.
set -euo pipefail

DRY=0
[ "${1:-}" = "--dry-run" ] && { DRY=1; shift; }
case "${1:-}" in -h|--help|"") awk 'NR > 1 && /^#/ { sub(/^# ?/, ""); print; next } NR > 1 { exit }' "$0"; exit 0 ;; esac
PLAN="$1"
REPO=$(gh repo view --json nameWithOwner --jq .nameWithOwner)
OWNER="${REPO%/*}"; NAME="${REPO#*/}"

# --- check the plan before writing anything --------------------------------
jq -e '(.issues | type == "array") and ((.issues | length) > 0 or (.epic.number | not))' "$PLAN" >/dev/null \
  || { echo "plan: no issues (an epic-only plan must create its epic)"; exit 1; }
jq -e '.epic.number or (.epic.title and .epic.body)' "$PLAN" >/dev/null || { echo "plan: epic needs a number, or a title and a body"; exit 1; }
DUP=$(jq -r '[.issues[].key] | group_by(.) | map(select(length > 1)[0]) | .[]' "$PLAN")
[ -z "$DUP" ] || { echo "plan: duplicate keys: $DUP"; exit 1; }
BAD=$(jq -r '[.issues[].key] as $k | .issues[] | .key as $me | (.depends_on // [])[]
             | select(.key and ((.key as $d | $k | index($d)) == null) or .key == $me) | "\($me) -> \(.key)"' "$PLAN")
[ -z "$BAD" ] || { echo "plan: dependencies on unknown keys or on themselves: $BAD"; exit 1; }
BADV=$(jq -r '.issues[] | select(((.type // "Task") as $t | ["Feature","Task","Bug","Component"] | index($t)) == null
                             or (.priority and ((.priority as $p | ["High","Medium","Low"] | index($p)) == null))) | .key' "$PLAN")
[ -z "$BADV" ] || { echo "plan: type must be Feature/Task/Bug/Component and priority High/Medium/Low: $BADV"; exit 1; }
# No cycles: peel off issues whose in-plan dependencies are all peeled, until
# none are left. The peeling order is also the creation order: blockers first,
# so every issue is created with its links already pointing at real numbers.
LEFT=$(jq -c '[.issues[] | {key, deps: [(.depends_on // [])[] | .key // empty]}]' "$PLAN")
ORDER=""
while [ "$(jq 'length' <<<"$LEFT")" -gt 0 ]; do
  READY=$(jq -r '.[] | select(.deps | length == 0) | .key' <<<"$LEFT")
  [ -n "$READY" ] || { echo "plan: dependency cycle among: $(jq -r '[.[].key] | join(", ")' <<<"$LEFT")"; exit 1; }
  ORDER="$ORDER $READY"
  LEFT=$(jq -c --arg r "$READY" '($r | split("\n")) as $done | map(select(.key as $k | $done | index($k) | not))
                                 | map(.deps |= map(select(. as $d | $done | index($d) | not)))' <<<"$LEFT")
done

if [ "$DRY" = 1 ]; then
  echo "Would create in $REPO:"
  jq -r 'if .epic.number then "  epic: existing #\(.epic.number)" else "  epic: \(.epic.title)" end' "$PLAN"
  jq -r '.issues[] | "    - [\(.key)] \(.title)  (\(.type // "Task")\(if .priority then ", \(.priority)" else "" end)\(if .labels then ", " + (.labels | join(",")) else "" end))"
                     + ((.depends_on // []) | map("\n        blocked by " + (if .key then "[\(.key)]" else "#\(.number)" end) + " — \(.why)") | join(""))' "$PLAN"
  exit 0
fi

# --- write ------------------------------------------------------------------
RENDERS=$(mktemp -d); trap 'rm -rf "$RENDERS"' EXIT
PEN_OK=0; command -v pen >/dev/null && pen status >/dev/null 2>&1 && PEN_OK=1
[ "$PEN_OK" = 1 ] || echo "  warning: pen CLI missing or not logged in; issues get no design images"
# render <pen file> <id>... : one PNG per id in $RENDERS, named <id>.png
render() {
  local file="$1"; shift
  local ids; ids=$(printf '"%s",' "$@"); ids="[${ids%,}]"
  printf '%s\n' "execute({ input: 'Export($ids, \"png\", \"$RENDERS\")' })" 'exit()' \
    | pen interactive --in "$file" --out "$RENDERS/scratch.pen" >/dev/null 2>&1 \
    || echo "  warning: could not render $file"
}
# create_issue <title> <body> [gh flags...]: prints the new issue's number.
# Claimed design parts get their image linked under the claim, then uploaded
# by --attach.
create_issue() {
  local title="$1" body="$2" claims file attach=(); shift 2
  claims=$(grep -oE '`[^` ]+\.pen#[A-Za-z0-9_-]+`' <<<"$body" | tr -d '`' | sort -u || true)
  if [ "$PEN_OK" = 1 ] && [ -n "$claims" ]; then
    for file in $(cut -d'#' -f1 <<<"$claims" | sort -u); do
      [ -f "$file" ] || { echo "  warning: $file not found; no images" >&2; continue; }
      render "$file" $(grep -F "$file#" <<<"$claims" | cut -d'#' -f2) >&2
    done
    for c in $claims; do
      local id="${c#*#}"
      [ -f "$RENDERS/$id.png" ] || continue
      # The image goes on the line after its claim; --attach rewrites the link.
      body=$(awk -v c="\`$c\`" -v img="![$id](./$id.png)" '{print} index($0, c) && !done[c]++ {print ""; print img; print ""}' <<<"$body")
      attach+=(--attach "./$id.png")
    done
  fi
  printf '%s' "$body" > "$RENDERS/body.md"
  ( cd "$RENDERS" && gh issue create --repo "$REPO" --title "$title" --body-file body.md ${attach[@]+"${attach[@]}"} "$@" ) | tail -1 | grep -oE '[0-9]+$'
}
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
    -f issue="$node" -f field="$(jq -r .field <<<"$opt")" -f option="$(jq -r .option <<<"$opt")" --silent \
    || echo "  warning: could not set Priority on #$1"
}

EPIC=$(jq -r '.epic.number // empty' "$PLAN")
if [ -z "$EPIC" ]; then
  ASSIGNEE=$(jq -r '.assignee // empty' "$PLAN")
  EPIC=$(create_issue "$(jq -r '.epic.title' "$PLAN")" "$(jq -r '.epic.body' "$PLAN")" ${ASSIGNEE:+--assignee "$ASSIGNEE"})
  echo "epic #$EPIC"
  set_type "$EPIC" Epic
fi

NUMS='{}'   # key -> issue number; JSON, not `declare -A`, which macOS's bash 3.2 lacks
num() { jq -r --arg k "$1" '.[$k]' <<<"$NUMS"; }
# with_depends <body> <lines>: the `Depends on` lines, first under "## Details".
with_depends() {
  [ -n "$2" ] || { printf '%s' "$1"; return; }
  if grep -q '^## Details' <<<"$1"; then
    local add; add=$(mktemp); printf '%s' "$2" > "$add"   # macOS awk refuses a multi-line -v value
    awk -v f="$add" '{print} /^## Details/ && !done {print ""; while ((getline l < f) > 0) print l; done=1}' <<<"$1"
    rm -f "$add"
  else
    printf '%s\n\n## Details\n\n%s' "$1" "$2"
  fi
}
for K in $ORDER; do
  ITEM=$(jq -c --arg k "$K" '.issues[] | select(.key == $k)' "$PLAN")
  BLOCKERS=""; LINES=""
  # One JSON object per line: tab-separated fields would collapse an empty one.
  while read -r DEP; do
    [ -n "$DEP" ] || continue
    B=$(jq -r '.number // empty' <<<"$DEP"); [ -n "$B" ] || B=$(num "$(jq -r '.key' <<<"$DEP")")
    BLOCKERS="${BLOCKERS:+$BLOCKERS,}$B"
    LINES+="Depends on #$B — $(jq -r '.why' <<<"$DEP")"$'\n'
  done < <(jq -c '(.depends_on // [])[]' <<<"$ITEM")
  WHO=$(jq -r --arg d "$(jq -r '.assignee // empty' "$PLAN")" '.assignee // $d' <<<"$ITEM")
  # Every issue asks for refinement: the person approved the plan, so the
  # refiner may shape it; they confirm `ready` afterwards.
  LABELS=$(jq -r '(.labels // []) + ["needs-refinement"] | unique | join(",")' <<<"$ITEM")
  N=$(create_issue "$(jq -r .title <<<"$ITEM")" "$(with_depends "$(jq -r .body <<<"$ITEM")" "$LINES")" \
        --type "$(jq -r '.type // "Task"' <<<"$ITEM")" --parent "$EPIC" ${BLOCKERS:+--blocked-by "$BLOCKERS"} \
        ${WHO:+--assignee "$WHO"} ${LABELS:+--label "$LABELS"})
  NUMS=$(jq -c --arg k "$K" --argjson n "$N" '. + {($k): $n}' <<<"$NUMS")
  echo "  #$N [$K] $(jq -r .title <<<"$ITEM")${BLOCKERS:+, blocked by #${BLOCKERS//,/, #}}"
  P=$(jq -r '.priority // empty' <<<"$ITEM"); [ -z "$P" ] || set_priority "$N" "$P"
done

echo "Done: https://github.com/$REPO/issues/$EPIC"
