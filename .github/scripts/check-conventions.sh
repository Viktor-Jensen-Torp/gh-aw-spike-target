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
# comparing against nothing: that once reported a breach on a pull request that
# had none (review run 36143201406).
if ! git rev-parse -q --verify "$BASE^{commit}" >/dev/null; then
  echo "✗ cannot check conventions: base '$BASE' is not in this checkout."
  echo "  Fetch it first: git fetch origin +refs/heads/develop:refs/remotes/origin/develop"
  exit 2
fi

# What this change touches: committed and uncommitted, against where it forked
# from the base, plus files not yet added. Deleting code needs no new test.
MB=$(git merge-base "$BASE" HEAD)
CHANGED=$( { git diff --name-only --diff-filter=ACMR "$MB"; git ls-files --others --exclude-standard; } | sort -u)
features() { # tree-ish or "WORKTREE" -> one "workspace/feature" per line
  if [ "$1" = WORKTREE ]; then
    find apps -mindepth 4 -maxdepth 4 -type d -path 'apps/*/src/features/*' 2>/dev/null
  else
    git ls-tree -d --name-only "$1" apps/*/src/features/ 2>/dev/null
  fi | sed -E 's#^apps/([^/]+)/src/features/([^/]+).*#\1/\2#' | sort -u
}

# --- Code comes with tests ------------------------------------------------------
# chain/structure.md: a change to source files changes or adds a test that proves it.
SOURCE=$(grep -E '^(apps|packages)/[^/]+/src/.+\.(ts|tsx)$' <<<"$CHANGED" | grep -vE '\.test\.(ts|tsx)$' || true)
TESTS=$(grep -E '^(apps|packages)/[^/]+/(src/.+\.test\.(ts|tsx)|e2e/.+\.spec\.ts)$' <<<"$CHANGED" || true)
if [ -n "$SOURCE" ] && [ -z "$TESTS" ]; then
  echo "✗ Code comes with tests: these source files changed and no test did:"
  sed 's/^/    /' <<<"$SOURCE"
  echo "  Add or change the test that proves the change, next to the module"
  echo "  (*.test.ts / *.test.tsx) or as a browser test in apps/web/e2e/."
  echo "  Which test for which case: .github/conventions/chain/testing.md."
  FAILED=1
fi

# --- The map comes with features ------------------------------------------------
# chain/structure.md: adding, moving or removing a feature folder updates
# docs/architecture.md in the same change.
BEFORE=$(features "$MB"); AFTER=$(features WORKTREE)
if [ "$BEFORE" != "$AFTER" ] && ! grep -qx 'docs/architecture.md' <<<"$CHANGED"; then
  echo "✗ The map comes with features: feature folders changed, docs/architecture.md did not."
  diff <(echo "$BEFORE") <(echo "$AFTER") | grep -E '^[<>]' | sed 's/^</    removed:/; s/^>/    added:  /'
  echo "  Update the Features table in docs/architecture.md in this change."
  FAILED=1
fi

[ "$FAILED" -eq 0 ] && echo "✓ conventions met"
exit "$FAILED"
