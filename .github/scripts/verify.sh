#!/usr/bin/env bash
# The checks a change must pass, in one place.
#
# Called from two places, so they cannot disagree:
#   1. CI — each required check runs one step (`--only test`, `--only
#      conventions`, `--only lint`), so the gate is exactly this list; `test`
#      is typecheck, unit and component tests, and browser tests;
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
if [ "${1:-}" = "--only" ]; then
  [ $# -ge 2 ] || { echo "verify.sh: --only needs a step name"; exit 2; }
  ONLY="$2"; shift 2
fi
BASE="${1:-origin/develop}"

# Playwright's browser lives inside node_modules, so the agent's container,
# which shares the workspace but cannot download anything, finds the one the
# runner installed before the agent started (shared/node-runtime.md).
# Always this one, whatever the caller set: gh-aw's browser tool sets its own
# PLAYWRIGHT_BROWSERS_PATH for the agent step, which holds a different build,
# and the tests then found no browser (implement run 36461849454: "Executable
# doesn't exist … chromium_headless_shell-1243"). The export stays inside this
# script, so the agent's browser tool keeps its own.
export PLAYWRIGHT_BROWSERS_PATH=0

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
has_script() { node -e "process.exit(require('./package.json').scripts?.['$1'] ? 0 : 1)" 2>/dev/null; }

# Dependencies, if this checkout has none yet (a fresh CI runner; the agent's
# checkout when the pre-agent install failed). --ignore-scripts, as gh-aw does
# for its own installs: no dependency's install script runs, anywhere.
# Only when there are none: `npm ci` empties node_modules, and with it the
# Playwright browser the runner put there, which an agent cannot download again.
ensure_deps() {
  [ -d node_modules/.bin ] && return 0
  npm ci --ignore-scripts --no-audit --no-fund --loglevel=error >/dev/null || { echo "npm ci failed"; return 1; }
}

# Typecheck, unit and component tests, and browser tests: package.json's `test`.
test_step() {
  ensure_deps || return 1
  npm test
}

lint_step() {
  if ! has_script lint; then
    echo "no \`lint\` script in package.json on this branch — skipped"
    return 0
  fi
  ensure_deps || return 1
  if ! npm run --silent lint; then
    echo "Formatting problems fix themselves with: npm run format"
    return 1
  fi
}

run_step() {
  case "$1" in
    test)        test_step ;;
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
