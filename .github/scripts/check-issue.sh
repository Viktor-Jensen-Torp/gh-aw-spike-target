#!/usr/bin/env bash
# Checks an issue body against its template: the headings the template requires,
# in its order, and a "Done when" that is a table or scenarios. One check for
# everything that writes issues (the refiner, /decompose), so they cannot
# disagree; the headings are read from the template, so changing the template
# changes the check. The rules for filling the headings in are in
# .github/conventions/chain/issues.md.
#
# Usage: check-issue.sh [--epic] [body-file]   (default: stdin)
# Exit 0 = the body has the template's shape. Exit 1 = it does not, and why.
set -uo pipefail

ROOT="${CHECK_ISSUE_ROOT:-$(cd "$(dirname "$0")/../.." && pwd)}"
TEMPLATE="$ROOT/.github/ISSUE_TEMPLATE/work-item.md"
if [ "${1:-}" = "--epic" ]; then TEMPLATE="$ROOT/.github/ISSUE_TEMPLATE/epic.md"; shift; fi
BODY=$(cat "${1:-/dev/stdin}")

# Required headings: every `## ` heading whose first paragraph does not start
# with "Optional".
REQUIRED=$(awk '
  /^## / { if (h != "" && !opt) print h; h = substr($0, 4); opt = 0; first = 1; next }
  h != "" && first && NF { opt = ($1 ~ /^Optional/); first = 0 }
  END { if (h != "" && !opt) print h }' "$TEMPLATE")
FOUND=$(grep -E '^## ' <<<"$BODY" | sed 's/^## //')

FAILED=0
LAST=0
while IFS= read -r H; do
  [ -n "$H" ] || continue
  AT=$(grep -nxF "$H" <<<"$FOUND" | head -1 | cut -d: -f1)
  if [ -z "$AT" ]; then
    echo "✗ missing heading: ## $H"; FAILED=1
  elif [ "$AT" -lt "$LAST" ]; then
    echo "✗ out of order: ## $H comes before a heading the template puts first"; FAILED=1
  else
    LAST=$AT
  fi
done <<<"$REQUIRED"

# "Done when": a table (Given | Expect) or scenarios (Given / When / Then).
if grep -qxF "Done when" <<<"$REQUIRED"; then
  DONE=$(awk '/^## /{f=($0=="## Done when")} f' <<<"$BODY")
  if ! grep -qE '^\|.*\|' <<<"$DONE" && ! grep -qE '^[[:space:]]*(Given|When|Then) ' <<<"$DONE"; then
    echo "✗ \"Done when\" has no table and no Given/When/Then scenario"; FAILED=1
  fi
fi

# "Out of scope" on a work item names nearby work by the issue that owns it, or
# says there is none (issues.md, "Boundaries"). The implementer sees only its
# own issue; #168 had no such line and built #176's and #177's routes (#211).
if [ "$(basename "$TEMPLATE")" = "work-item.md" ] && grep -qxF "Out of scope" <<<"$FOUND"; then
  OOS=$(awk '/^## /{f=($0=="## Out of scope")} f' <<<"$BODY")
  if ! grep -qE '#[0-9]+' <<<"$OOS" && ! grep -qi 'nothing nearby' <<<"$OOS"; then
    echo "✗ \"Out of scope\" names no issue (#N) for nearby work and does not say \"Nothing nearby.\""; FAILED=1
  fi
fi

[ "$FAILED" = 0 ] && echo "✓ matches $(basename "$TEMPLATE")"
exit "$FAILED"
