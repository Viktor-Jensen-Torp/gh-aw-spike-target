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

STEPS=(test conventions)
case "$ONLY" in
  "") ;;
  test|conventions) STEPS=("$ONLY") ;;
  *) echo "verify.sh: unknown step '$ONLY' (known: test, conventions)"; exit 2 ;;
esac

run_step() {
  case "$1" in
    test)        npm test ;;
    conventions) bash "$HERE/check-conventions.sh" "$BASE" ;;
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
