#!/usr/bin/env bash
# Checks a review's per-requirement verdict against the rules the pipeline
# enforces, so the reviewer's own word is not the last word. Called by review.md's
# routing step; no network, so it is tested on recorded reviews
# (.github/scripts/test/).
#
# Usage: review-rows.sh <data.json> <requirements.md> <changed-files.txt>
#   data.json          the review's "Structured data" ({requirements:[{id,status,evidence}]})
#   requirements.md    .github/conventions/chain/requirements/<type>.md, from the base
#   changed-files.txt  the pull request's changed files, one per line
# Prints one "ID: status" line per row: C1, then every row of the file. A row
# passes only as `met` or `n/a`. Exit 2 when the requirements file has no rows.
set -euo pipefail

DATA="${1:?usage: review-rows.sh data.json requirements.md changed-files.txt}"
REQ="${2:?missing requirements.md}"
FILES="${3:?missing changed-files.txt}"

IDS=$(sed -nE 's/^\| *([A-Z][0-9]+) *\|.*/\1/p' "$REQ")
[ -n "$IDS" ] || { echo "review-rows.sh: no requirement rows in $REQ" >&2; exit 2; }
# Rows whose last column says `yes` may be answered `n/a` (the issue names no
# boundaries, claims no design); on any other row n/a blocks.
NA_OK=$(sed -nE 's/^\| *([A-Z][0-9]+) *\|.*\| *yes *\|$/\1/p' "$REQ")

# A path the evidence names proves something only if this pull request changed
# it: a changed file, or a folder holding one (#136's U6 named
# `apps/web/src/components/Button/`). On #118 "architecture.md updated" passed
# as proof.
names_a_changed_file() { # <evidence>
  local p
  while read -r p; do
    [ -n "$p" ] || continue
    p="${p%/}"
    grep -qxF "$p" "$FILES" && return 0
    awk -v dir="$p/" 'index($0, dir) == 1 { found = 1 } END { exit !found }' "$FILES" && return 0
  done < <(grep -oE '[A-Za-z0-9_.@-]+(/[A-Za-z0-9_.@-]+)+/?' <<<"$1" | sed -E 's/[.:]+$//' | sort -u)
  return 1
}

for ID in C1 $IDS; do
  S=$(jq -r --arg id "$ID" '[.requirements[] | select(.id == $id)] | last | .status // "missing"' "$DATA")
  E=$(jq -r --arg id "$ID" '[.requirements[] | select(.id == $id)] | last | .evidence // ""' "$DATA")
  # C1 is exempt: its proof of "no defect" is "none found".
  if [ "$S" = met ] && [ "$ID" != C1 ] && ! names_a_changed_file "$E"; then
    S="met-without-a-changed-file"
  fi
  if [ "$S" = "n/a" ] && ! grep -qx "$ID" <<<"$NA_OK"; then
    S="n/a-not-allowed"
  fi
  echo "$ID: $S"
done
