#!/usr/bin/env bash
# Looks up every repository path a review's evidence cites, so review-rows.sh
# can refuse a `met` row whose proof points at nothing. On #213 a review cited
# lines 260 and 300 of a 215-line file, copied from the pull request's body,
# and routing passed it (review 36707098843; #244).
#
# Usage: cited-lines.sh <data.json>
#   data.json   the review's {"requirements": [{id, status, evidence}]}
#   CITED_FROM  fs (default): read the files under ROOT (default: the cwd);
#               api: read them at REPO@SHA through the GitHub API (routing,
#               which checks out no pull request files)
# Prints one "path<TAB>lines" line per cited path: its line count, "dir" for
# a folder, or "absent". review-rows.sh reads it as its fourth argument.
set -euo pipefail

DATA="${1:?usage: cited-lines.sh data.json}"
FROM="${CITED_FROM:-fs}"
ROOT="${ROOT:-.}"

paths() {
  jq -r '.requirements[]? | select(.status == "met") | .evidence // ""' "$DATA" \
    | grep -oE '[A-Za-z0-9_.@-]+(/[A-Za-z0-9_.@-]+)+/?' | sed -E 's/[.:]+$//; s#/$##' | sort -u
}

lines_of() { # <path> -> lines | dir | absent
  local p="$1" json
  if [ "$FROM" = api ]; then
    if ! json=$(gh api "repos/${REPO:?}/contents/$p?ref=${SHA:?}" 2>/dev/null); then echo absent; return; fi
    if jq -e 'type == "array"' <<<"$json" >/dev/null; then echo dir; return; fi
    jq -r '.content' <<<"$json" | base64 -d | awk 'END { print NR }'
  else
    if [ -d "$ROOT/$p" ]; then echo dir
    elif [ -f "$ROOT/$p" ]; then awk 'END { print NR }' "$ROOT/$p"
    else echo absent; fi
  fi
}

paths | while read -r P; do
  [ -n "$P" ] || continue
  printf '%s\t%s\n' "$P" "$(lines_of "$P")"
done
