#!/usr/bin/env bash
# Which issues a design change touches, open or closed (#259).
#
#   design-impact.sh <pen path in the repo> <old.pen> <new.pen> <issues.json>
#
# issues.json: [{number, title, state, body}], every issue that may claim parts
# of this file. An issue claims parts as `path#id` under "## Design". A change
# touches a claim when it sits inside the claimed part, or inside a component
# the part uses: a screen holds `ref`s to its components, so a change to the
# Text field must reach every screen built with it, not only the component's
# own issue. Components are found with design-part.sh, in both versions.
#
# Prints JSON:
#   {"changes": <n>,
#    "hits": [{"number", "title", "state", "parts": ["changed Input", …],
#              "unowned": [same, for a closed issue: the parts no open issue
#                          covers, which a follow-up is needed for]}],
#    "uncovered": [{"name", "count"}]}   changes no issue claims, by top frame
# Token (variable) changes are not elements and are not reported here: the
# theme test fails until apps/web/src/index.css matches them.
set -euo pipefail

PEN="${1:?usage: design-impact.sh pen-path old.pen new.pen issues.json}"
OLD="${2:?missing old.pen}"; NEW="${3:?missing new.pen}"; ISSUES="${4:?missing issues.json}"
HERE="$(cd "$(dirname "$0")" && pwd)"

CHANGES=$(bash "$HERE/design-diff.sh" "$OLD" "$NEW")

# The ids a claim covers: the part itself and every component it uses.
covers() { # <id> -> one id per line
  echo "$1"
  for F in "$OLD" "$NEW"; do
    bash "$HERE/design-part.sh" "$F" "$1" 2>/dev/null | jq -r '.. | objects | .component?.id // empty' || true
  done | sort -u
}

HITS='[]'; ALL='[]'
while IFS=$'\t' read -r N STATE TITLE; do
  [ -n "$N" ] || continue
  IDS=$(jq -r --argjson n "$N" '.[] | select(.number == $n) | .body // ""' "$ISSUES" \
          | { grep -oE '`[^` ]+#[A-Za-z0-9_-]+`' | grep -F "\`$PEN#" || true; } \
          | sed -E 's/.*#([A-Za-z0-9_-]+)`/\1/' | sort -u)
  [ -n "$IDS" ] || continue
  COVER=$(for I in $IDS; do covers "$I"; done | sort -u | jq -R . | jq -sc '.')
  ALL=$(jq -c --argjson a "$ALL" --argjson b "$COVER" -n '$a + $b | unique')
  IDX=$(jq -c --argjson ids "$COVER" '[to_entries[] | select(any(.value.within[]; . as $w | $ids | index($w))) | .key]' <<<"$CHANGES")
  [ "$IDX" != "[]" ] || continue
  HITS=$(jq -c --argjson h "$HITS" --argjson n "$N" --arg s "$STATE" --arg t "$TITLE" --argjson i "$IDX" -n \
           '$h + [{number: $n, title: $t, state: $s, idx: $i}]')
done < <(jq -r '.[] | [.number, .state, .title] | @tsv' "$ISSUES")

# A change an open issue covers is that issue's; a closed issue needs a
# follow-up only for the rest.
jq -n --argjson c "$CHANGES" --argjson h "$HITS" --argjson all "$ALL" '
  def names($i): [$i[] | $c[.] | "\(.change) \(.name)"] | unique;
  ([$h[] | select(.state == "open") | .idx[]] | unique) as $owned
  | {
  changes: ($c | length),
  hits: [$h[] | {number, title, state, parts: names(.idx)}
               + (if .state == "open" then {} else {unowned: names([.idx[] | select(. as $x | $owned | index($x) | not)])} end)],
  uncovered: ([$c[] | select(any(.within[]; . as $w | $all | index($w)) | not) | (.path[0] // .name)]
              | group_by(.) | map({name: .[0], count: length}))
}'
