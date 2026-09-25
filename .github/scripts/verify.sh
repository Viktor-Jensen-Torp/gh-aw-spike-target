#!/usr/bin/env bash
# The checks a change must pass, in one place.
#
# Called from two places, so they cannot disagree:
#   1. CI — each required check runs one step (`--only test`, `--only
#      conventions`), so the gate is exactly this list;
#   2. the agent, before its work leaves the run — .github/pi/postconditions.cjs
#      runs all steps when an implement/rework/unblock agent calls
#      create_pull_request or push_to_pull_request_branch, and refuses the call
#      if any step fails. That call is the agent's `git push`: gh-aw freezes the
#      pull request's contents at that moment, so this is the pre-push hook.
#
# Adding a check (lint, targeted mutation tests, ...) means: a step here, a CI
# job that runs `--only <step>`, and making that job a required check.
#
# Usage: verify.sh [--only <step>] [base-ref]   (base-ref default: origin/develop)
# Exit 0 = every step passed. Otherwise the failing steps' output is on stdout.
set -uo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
ONLY=""
if [ "${1:-}" = "--only" ]; then ONLY="${2:-}"; shift 2; fi
BASE="${1:-origin/develop}"

STEPS=(test conventions lint)
case "$ONLY" in
  "") ;;
  test|conventions|lint) STEPS=("$ONLY") ;;
  *) echo "verify.sh: unknown step '$ONLY' (known: test, conventions, lint)"; exit 2 ;;
esac

# ESLint + Prettier (.github/lint/), through package.json's `lint` script.
# Skipped where package.json has no `lint` script: .github/ is identical on main
# and develop, but package.json reaches main only with a release, so main runs
# this before its package.json knows about lint. Where the script exists, the
# tools are installed if missing (the agent's checkout and a fresh CI runner
# start without node_modules).
lint_step() {
  if ! node -e 'process.exit(require("./package.json").scripts?.lint ? 0 : 1)' 2>/dev/null; then
    echo "no \`lint\` script in package.json on this branch — skipped"
    return 0
  fi
  if [ ! -x node_modules/.bin/eslint ] || [ ! -x node_modules/.bin/prettier ]; then
    # --ignore-scripts, as gh-aw does for its own installs: no dependency's
    # install script runs, inside the agent's container or on CI.
    npm ci --ignore-scripts --no-audit --no-fund --loglevel=error >/dev/null || { echo "npm ci failed"; return 1; }
  fi
  if ! npm run --silent lint; then
    echo "Formatting problems fix themselves with: npm run format"
    return 1
  fi
}

run_step() {
  case "$1" in
    test)        npm test ;;
    conventions) bash "$HERE/check-conventions.sh" "$BASE" ;;
    lint)        lint_step ;;
  esac
}

FAILED=()
for step in "${STEPS[@]}"; do
  echo "── $step"
  if ! run_step "$step"; then FAILED+=("$step"); fi
done

if [ ${#FAILED[@]} -eq 0 ]; then
  echo "✓ verify: all checks passed (${STEPS[*]})"
  exit 0
fi
echo "✗ verify: failed: ${FAILED[*]}"
exit 1
