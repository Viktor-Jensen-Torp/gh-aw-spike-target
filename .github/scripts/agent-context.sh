#!/usr/bin/env bash
# Picks the conventions that apply to a change and writes them to one file, so
# an agent reads exactly those instead of working out its own reading list from
# .github/conventions/index.md. On review run 36602126236 the reviewer followed
# the index to two documents and skipped the four it lists under "Always".
#
# The choice follows index.md itself: every document under "Always", then each
# "By path" row whose pattern matches a path the change touches, and
# chain/design.md when the issue claims design parts ("when the issue claims
# design parts" in that row). A new row in index.md is picked up without a
# change here.
#
# Usage: agent-context.sh <paths.txt> <issue-body.md> <out.md>
#   paths.txt      paths the change touches, one per line: a pull request's
#                  changed files, or for a new change the paths its issue names
#   issue-body.md  the issue's body ("" if none)
# Run from the repository root. Exit 2 if index.md cannot be read.
set -euo pipefail

PATHS="${1:?usage: agent-context.sh paths.txt issue-body.md out.md}"
BODY="${2:?missing issue-body.md}"
OUT="${3:?missing out.md}"
IDX=.github/conventions/index.md
[ -f "$IDX" ] || { echo "agent-context.sh: no $IDX" >&2; exit 2; }
DIR=$(dirname "$IDX")

section() { awk -v h="## $1" '$0 == h {f=1; next} f && /^## /{exit} f' "$IDX"; }
links() { grep -oE '\]\([^)]+\.md\)' | sed -E 's/^\]\((.*)\)$/\1/'; }

CLAIMS=no
grep -qE '`[^` ]+\.pen#[A-Za-z0-9_-]+`' "$BODY" 2>/dev/null && CLAIMS=yes

PICKED=()   # "path<TAB>why"
add() { local p; p="$(cd "$DIR/$(dirname "$1")" && pwd)/$(basename "$1")"; p="${p#"$PWD"/}"
        for x in "${PICKED[@]:-}"; do [ "${x%%	*}" = "$p" ] && return 0; done
        PICKED+=("$p	$2"); }

while read -r L; do add "$L" "always"; done < <(section Always | links)

# "By path": | `glob` | [doc](doc), and [other](other) when … |
while IFS= read -r ROW; do
  GLOB=$(sed -nE 's/^\| `([^`]+)` \|.*/\1/p' <<<"$ROW"); [ -n "$GLOB" ] || continue
  RE="^$(sed -E 's/[.+^$(){}|[\]\\]/\\&/g; s/\*\*/@@/g; s/\*/[^\/]*/g; s/@@/.*/g' <<<"$GLOB")"
  grep -qE "$RE" "$PATHS" || continue
  CELL=$(awk -F'|' '{print $3}' <<<"$ROW")
  while read -r L; do
    if grep -qF "($L) when the issue claims design" <<<"$CELL"; then
      [ "$CLAIMS" = yes ] && add "$L" "the issue claims design parts"
    else
      add "$L" "touches \`$GLOB\`"
    fi
  done < <(links <<<"$CELL")
done < <(section "By path" | grep -E '^\| `')

{
  echo "# The conventions for this change"
  echo
  echo "Picked from \`.github/conventions/index.md\` for the paths this change touches."
  echo "They are the repository's rules: follow them, and cite them in findings."
  echo
  for P in "${PICKED[@]}"; do echo "- \`${P%%	*}\` (${P#*	})"; done
  for P in "${PICKED[@]}"; do
    F="${P%%	*}"
    echo; echo "---"; echo; echo "<!-- $F -->"
    # Frontmatter is for the bundle's index, not for the reader.
    awk 'NR==1 && /^---$/ {fm=1; next} fm && /^---$/ {fm=0; next} !fm' "$F"
  done
} > "$OUT"
echo "conventions: $(printf '%s\n' "${PICKED[@]}" | cut -f1 | tr '\n' ' ')($(wc -c < "$OUT" | tr -d ' ') bytes)"
