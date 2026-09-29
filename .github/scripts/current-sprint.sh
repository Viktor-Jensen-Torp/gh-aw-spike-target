#!/usr/bin/env bash
# The current sprint and its issues, read from the Project's `Sprint` iteration
# field. Sprints are iterations, not milestones: GitHub models a sprint as an
# iteration (dates that roll on by themselves); milestones stay for releases
# (planning review, 2026-09-29). Organisation issue fields offer no iteration
# type, so the field lives on the Project.
#
# Usage (GH_TOKEN able to read the organisation's projects, e.g. the reviewer
# App's token; GITHUB_TOKEN cannot):
#   current-sprint.sh <org> <project-number>
# Prints JSON: {"title": "Sprint 1", "start": "2026-09-28", "end": "2026-10-11",
#               "issues": [83, 86, ...]}, or {"title": "", "issues": []} when no
# iteration covers today.
# Tests: SPRINT_DATA=<file> reads the Project data from a file instead of the
# API; SPRINT_TODAY=YYYY-MM-DD fixes the date.
set -euo pipefail

ORG="${1:?usage: current-sprint.sh <org> <project-number>}"
N="${2:?missing project number}"
TODAY="${SPRINT_TODAY:-$(date -u +%Y-%m-%d)}"

if [ -n "${SPRINT_DATA:-}" ]; then
  DATA=$(cat "$SPRINT_DATA")
else
  FIELD=$(gh api graphql -f query='
    query($org: String!, $n: Int!) { organization(login: $org) { projectV2(number: $n) {
      field(name: "Sprint") { ... on ProjectV2IterationField {
        configuration { iterations { id title startDate duration } } } } } } }' \
    -f org="$ORG" -F n="$N" --jq '.data.organization.projectV2.field.configuration.iterations // []')
  ITEMS=$(gh api graphql --paginate -f query='
    query($org: String!, $n: Int!, $endCursor: String) { organization(login: $org) { projectV2(number: $n) {
      items(first: 100, after: $endCursor) { pageInfo { hasNextPage endCursor } nodes {
        sprint: fieldValueByName(name: "Sprint") { ... on ProjectV2ItemFieldIterationValue { iterationId } }
        content { ... on Issue { number state } } } } } } }' \
    -f org="$ORG" -F n="$N" \
    --jq '.data.organization.projectV2.items.nodes[]
          | select(.content.number != null and .content.state == "OPEN" and .sprint != null)
          | {number: .content.number, iterationId: .sprint.iterationId}' | jq -s .)
  DATA=$(jq -n --argjson i "$FIELD" --argjson t "$ITEMS" '{iterations: $i, items: $t}')
fi

# An iteration covers today when start <= today < start + duration days.
jq --arg today "$TODAY" '
  def plus($d; $days): ($d + "T00:00:00Z" | fromdateiso8601) + ($days * 86400) | strftime("%Y-%m-%d");
  ([.iterations[] | select(.startDate <= $today and $today < plus(.startDate; .duration))] | first) as $s
  | if $s == null then {title: "", issues: []}
    else {title: $s.title, start: $s.startDate, end: plus($s.startDate; $s.duration - 1),
          issues: ([.items[] | select(.iterationId == $s.id) | .number] | sort)}
    end' <<<"$DATA"
