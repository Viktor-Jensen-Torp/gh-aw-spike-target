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
set -uo pipefail

BASE="${1:-origin/develop}"
FAILED=0

# --- One helper, one file -----------------------------------------------------
# src/index.js ends with a single line listing every export, so two changes that
# both add a helper both edit that line and collide every time. See
# .github/conventions/javascript.md.
BEFORE=$(git show "$BASE:src/index.js" 2>/dev/null | grep -c '^function ' || true)
AFTER=$(grep -c '^function ' src/index.js 2>/dev/null || true)

if [ "${AFTER:-0}" -gt "${BEFORE:-0}" ]; then
  ADDED=$(git diff "$BASE"...HEAD -- src/index.js 2>/dev/null \
          | grep '^+function ' | sed 's/^+function \([a-zA-Z0-9_]*\).*/\1/' | tr '\n' ' ')
  [ -n "${ADDED// /}" ] || ADDED="(a new function)"
  echo "✗ One helper, one file: \`$ADDED\` was added to src/index.js."
  echo "  Put each exported helper in its own file — src/<name>.js, with"
  echo "  test/<name>.test.js alongside — and leave src/index.js as it is."
  echo "  Why: src/index.js ends with one line listing every export, so two"
  echo "  changes that both add a helper both edit that line and collide."
  echo "  See .github/conventions/javascript.md."
  FAILED=1
fi

if [ "$FAILED" -eq 0 ]; then
  echo "✓ conventions met"
fi
exit "$FAILED"
