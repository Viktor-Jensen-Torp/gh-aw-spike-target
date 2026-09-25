#!/usr/bin/env bash
# Checks the conventions in .github/conventions/ that can be checked
# mechanically.
#
# Called from TWO places on purpose, and it is one script so the two cannot
# disagree:
#   1. the implementer, before it opens a pull request — where a breach costs
#      nothing to fix, because the run is already paying for itself;
#   2. .github/workflows/conventions.yml, as the backstop that makes the rule
#      true rather than aspirational.
#
# Catching a breach after the push instead costs a review, a rework and a
# re-review — roughly 15-20 AI credits and three runs. Before the push: zero.
#
# Usage: check-conventions.sh [base-ref]   (default: origin/develop)
# Exit 0 = conventions met. Exit 1 = a breach, described on stdout.
# Exit 2 = the base cannot be read, so nothing could be checked.
set -uo pipefail

BASE="${1:-origin/develop}"
FAILED=0

# Without the base there is nothing to compare against. Say so, rather than
# comparing against nothing: that once reported a function "added" to
# src/index.js on a pull request that added none (review run 36143201406).
if ! git rev-parse -q --verify "$BASE^{commit}" >/dev/null; then
  echo "✗ cannot check conventions: base '$BASE' is not in this checkout."
  echo "  Fetch it first: git fetch origin +refs/heads/develop:refs/remotes/origin/develop"
  exit 2
fi

# --- One helper, one file -----------------------------------------------------
# src/index.js is the old barrel: it may shrink, never grow. Growing it means a
# new function in it, or a new name on its export line (a re-export counts: it
# rebuilds the shared line this rule removes). See .github/conventions/javascript.md.
exports_of() { # file contents on stdin -> one exported name per line
  grep -E '^module\.exports *=' | sed -E 's/.*\{(.*)\}.*/\1/' | tr ',' '\n' \
    | sed -E 's/[[:space:]]//g; s/:.*//' | grep -v '^$' | sort -u
}
BASE_SRC=$(git show "$BASE:src/index.js" 2>/dev/null || true)
HEAD_SRC=$(cat src/index.js 2>/dev/null || true)

NEW_FUNCTIONS=$(comm -13 <(grep -oE '^function [A-Za-z0-9_]+' <<<"$BASE_SRC" | sort -u) \
                         <(grep -oE '^function [A-Za-z0-9_]+' <<<"$HEAD_SRC" | sort -u) \
                | sed 's/^function //' | tr '\n' ' ')
NEW_EXPORTS=$(comm -13 <(exports_of <<<"$BASE_SRC") <(exports_of <<<"$HEAD_SRC") | tr '\n' ' ')
ADDED=$(printf '%s %s' "$NEW_FUNCTIONS" "$NEW_EXPORTS" | tr ' ' '\n' | grep -v '^$' | sort -u | tr '\n' ' ')

if [ -n "${ADDED// /}" ]; then
  echo "✗ One helper, one file: \`${ADDED% }\` was added to src/index.js."
  echo "  Put each exported helper in its own file — src/<name>.js, with"
  echo "  test/<name>.test.js alongside — and leave src/index.js as it is."
  echo "  Do not re-export new files from src/index.js either."
  echo "  Why: src/index.js ends with one line listing every export, so two"
  echo "  changes that both add a helper both edit that line and collide."
  echo "  See .github/conventions/javascript.md."
  FAILED=1
fi

if [ "$FAILED" -eq 0 ]; then
  echo "✓ conventions met"
fi
exit "$FAILED"
