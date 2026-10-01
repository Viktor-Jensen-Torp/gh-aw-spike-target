#!/usr/bin/env bash
# Starts a pipeline workflow for one issue or pull request. The one way a
# workflow hands work to the next: labels show state and start nothing.
#
# Why dispatch: a `workflow_dispatch` made with GITHUB_TOKEN starts a run (unblock
# run 35814539944), where a label written with it does not; and gh-aw reads the
# item from `aw_context`, so a dispatched run is "about" that issue or pull
# request: its `target: triggering` outputs resolve to it and its checkout is the
# pull request's branch (invocation_context_helpers.cjs, checkout_pr_branch.cjs).
# `event_type` must be the native event name, or gh-aw sees no issue or pull
# request context (safe_output_helpers.cjs, resolveTarget).
#
# Usage (REPO=owner/name, GH_TOKEN with actions: write):
#   dispatch.sh <workflow.lock.yml> issue <n> [input=value ...]
#   dispatch.sh <workflow.lock.yml> pr    <n> [input=value ...]
# The workflow must declare `issue` or `pr` as an input. It runs from `main`,
# whose .github/ equals develop's (config-drift.yml). DRY_RUN=1 prints the call.
set -euo pipefail

WF="${1:?usage: dispatch.sh <workflow.lock.yml> issue|pr <n> [input=value ...]}"
KIND="${2:?missing issue|pr}"
N="${3:?missing number}"
shift 3
[[ "$N" =~ ^[0-9]+$ ]] || { echo "dispatch.sh: '$N' is not a number" >&2; exit 2; }

case "$KIND" in
  issue) TYPE=issue;        EVENT=issues;       INPUT=issue ;;
  pr)    TYPE=pull_request; EVENT=pull_request; INPUT=pr ;;
  *) echo "dispatch.sh: kind must be issue or pr, not '$KIND'" >&2; exit 2 ;;
esac

# gh-aw keeps aw_context only with repo, run_id and workflow_id present
# (generate_aw_info.cjs:185, v0.89.21): without them activation logged "Ignoring
# aw_context", comment memory was skipped and replies lost the thread (#248).
# They name the dispatching run, as gh-aw's own buildAwContext does; empty when
# a person runs this from a terminal.
CONTEXT=$(jq -cn --arg t "$TYPE" --arg n "$N" --arg e "$EVENT" --arg r "$REPO" \
  --arg run "${GITHUB_RUN_ID:-}" --arg att "${GITHUB_RUN_ATTEMPT:-}" --arg wf "${GITHUB_WORKFLOW_REF:-}" \
  '{item_type: $t, item_number: $n, event_type: $e, repo: $r, run_id: $run, run_attempt: $att, workflow_id: $wf}')
ARGS=(workflow run "$WF" --repo "$REPO" --ref main -f "$INPUT=$N" -f "aw_context=$CONTEXT")
for KV in "$@"; do ARGS+=(-f "$KV"); done

if [ "${DRY_RUN:-}" = 1 ]; then
  printf '%q ' gh "${ARGS[@]}"; echo
else
  gh "${ARGS[@]}"
  echo "dispatched $WF for $KIND #$N"
fi
