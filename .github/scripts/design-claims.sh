#!/usr/bin/env bash
# Which parts of a pen design file are already covered by an issue.
#
#   design-claims.sh <path/to/design.pen> [depth]     (depth: default 2)
#
# An issue claims a part of the design by naming it as `path#id` in its body
# (work-item.md, "## Design"). This lists every frame down to `depth` levels,
# each with the issues (open or closed) whose claim covers it: the frame itself
# or anything it sits inside. A frame with no claim, and no claim inside it, is
# not yet an issue: that is new work. Run from the repository root, with `gh`.
set -euo pipefail
[ $# -ge 1 ] || { sed -n '2,10p' "$0" | sed 's/^# \{0,1\}//'; exit 2; }
PEN="$1"; DEPTH="${2:-2}"

# Every claim on this file: [{issue, state, id}]
CLAIMS=$(gh issue list --state all --limit 1000 --json number,state,body \
  --jq '.[] | {number, state, body: (.body // "")}' \
  | jq -c --arg p "$PEN" '. as $i | ($i.body | [scan("`" + ($p | gsub("\\."; "\\.")) + "#([A-Za-z0-9_-]+)`")[]] | unique[])
                             | {issue: $i.number, state: ($i.state | ascii_downcase), id: .}' \
  | jq -sc '.')

jq -r --argjson claims "$CLAIMS" --argjson depth "$DEPTH" '
  def frames($within; $level):
    (.children // [])[] | select(type == "object" and .type == "frame") | . as $f
    | {id: $f.id, name: ($f.name // "frame"), level: $level, within: ($within + [$f.id]),
       inside: [$f | .. | objects | .id? // empty]},
      (if $level < $depth then ($f | frames($within + [$f.id]; $level + 1)) else empty end);
  frames([]; 1)
  | . as $fr
  | ([$claims[] | select(.id as $c | $fr.within | index($c))] | map("#\(.issue) (\(.state))") | unique) as $by
  | ([$claims[] | select(.id as $c | ($fr.inside | index($c)) and ($fr.within | index($c) | not))] | map("#\(.issue)") | unique) as $part
  | ("  " * (.level - 1)) + "\(.id)  \(.name)  — "
    + (if ($by | length) > 0 then "claimed by " + ($by | join(", "))
       elif ($part | length) > 0 then "partly, inside: " + ($part | join(", "))
       else "UNCLAIMED" end)' "$PEN"
