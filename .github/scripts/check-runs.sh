#!/usr/bin/env bash
# Reads a commit's check runs. The one place the pipeline asks "what did check X
# say on this commit", so every caller reads all of them.
#
# GitHub returns check runs 30 to a page. Each agentic run posts eight jobs as
# check runs, so an agent pull request passes 30 fast: #136's head commit
# c113cac1 had 121, with `Agent review` on page 3. Reading one page, the sweeper
# saw no verdict and called a person (2026-09-29, 05:02).
#
# Usage (REPO=owner/name, GH_TOKEN set):
#   check-runs.sh latest  <sha> <name> [app-slug]  newest run's conclusion, "" if none
#   check-runs.sh failing <sha> <name>...          how many runs of these names failed
set -euo pipefail

MODE="${1:?usage: check-runs.sh latest|failing <sha> <name>...}"
SHA="${2:?missing sha}"
shift 2
[ $# -ge 1 ] || { echo "check-runs.sh: missing check name" >&2; exit 2; }

all_runs() { # every check run on $SHA, as one JSON array
  gh api --paginate "repos/$REPO/commits/$SHA/check-runs?per_page=100" --jq '.check_runs[]' | jq -s .
}

case "$MODE" in
  latest)
    all_runs | jq -r --arg name "$1" --arg app "${2:-}" \
      '[.[] | select(.name == $name and ($app == "" or .app.slug == $app))]
       | sort_by(.completed_at) | last | .conclusion // ""' ;;
  failing)
    all_runs | jq -r --args \
      '[.[] | select(.name as $n | $ARGS.positional | index($n)) | select(.conclusion == "failure")] | length' "$@" ;;
  *) echo "check-runs.sh: unknown mode '$MODE'" >&2; exit 2 ;;
esac
