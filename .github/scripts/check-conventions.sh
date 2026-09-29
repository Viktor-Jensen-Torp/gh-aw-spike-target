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
# Exit 2 = the base cannot be read, or shares no history with HEAD, so nothing
# could be checked.
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
# A shallow checkout has no fork point, and comparing against nothing reported
# the base's own feature folders as added by the change: it refused both rework
# pushes on #136 (runs 36473378915, 36500339583). Checkouts take full history
# (shared/postconditions.md); this says so if one does not.
if ! MB=$(git merge-base "$BASE" HEAD 2>/dev/null) || [ -z "$MB" ]; then
  echo "✗ cannot check conventions: no common history with $BASE in this checkout."
  echo "  The clone is too shallow to find where this change forked. Nothing was checked."
  exit 2
fi
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
SOURCE=$(grep -E '^(apps|packages)/[^/]+/src/.+\.(ts|tsx)$' <<<"$CHANGED" | grep -vE '\.(test\.(ts|tsx)|stories\.tsx)$' || true)
# A story is a test too: every story runs as one, in a real browser (components.md).
TESTS=$(grep -E '^(apps|packages)/[^/]+/(src/.+\.(test\.(ts|tsx)|stories\.tsx)|e2e/.+\.spec\.ts)$' <<<"$CHANGED" || true)
if [ -n "$SOURCE" ] && [ -z "$TESTS" ]; then
  echo "✗ Code comes with tests: these source files changed and no test did:"
  sed 's/^/    /' <<<"$SOURCE"
  echo "  Add or change the test that proves the change, next to the module"
  echo "  (*.test.ts / *.test.tsx; *.stories.tsx for a shared component) or as a"
  echo "  browser test in apps/web/e2e/."
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

# --- Documents point at things that exist ------------------------------------
# chain/principles.md: a document that names a path that does not exist has
# drifted. Checked: repository paths in backticks, and relative links. Patterns
# (`*`, `<feature>`, `…`) and URLs are not paths.
DOCS=$( { find .github/conventions docs -name '*.md' 2>/dev/null; } | sort)
MISSING=""
for DOC in $DOCS; do
  while IFS=: read -r LINE TEXT; do
    for P in $(grep -oE '`(apps|packages|docs|design|\.github)/[^` ]*`' <<<"$TEXT" | tr -d '`'); do
      case "$P" in *'*'*|*'<'*|*'>'*|*'…'*|*'{'*) continue ;; esac
      P="${P%%#*}"; P="${P%[.,;:)]}"
      [ -e "$P" ] || MISSING+="    $DOC:$LINE: \`$P\`"$'\n'
    done
    for L in $(grep -oE '\]\([^)#: ]+(#[^)]*)?\)' <<<"$TEXT" | sed -E 's/^\]\(([^)#]+).*/\1/'); do
      [ -e "$(dirname "$DOC")/$L" ] || MISSING+="    $DOC:$LINE: link $L"$'\n'
    done
  done < <(grep -n -E '`(apps|packages|docs|design|\.github)/|\]\([^)#: ]+' "$DOC" || true)
done
if [ -n "$MISSING" ]; then
  echo "✗ Documents point at things that exist: these do not:"
  printf '%s' "$MISSING"
  echo "  Correct the path, or delete the sentence if the thing is gone."
  FAILED=1
fi

[ "$FAILED" -eq 0 ] && echo "✓ conventions met"
exit "$FAILED"
