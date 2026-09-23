#!/usr/bin/env bash
# Works out which pull requests are in this merge group, then checks one thing
# about each of them. Shared by both jobs in merge-group-gate.yml so the
# membership logic exists once: a rule stated in two places is a rule that will
# eventually disagree with itself.
#
# Usage: merge-group-members.sh hold|review
set -euo pipefail

MODE="${1:?usage: merge-group-members.sh hold|review}"
BASE_REF="${BASE##refs/heads/}"
HEAD_REF="${HEAD:-${GITHUB_REF_NAME:-}}"

# Which pull requests are in this group, from the queue's branch name.
#
# GitHub documents only the `gh-readonly-queue/{base_branch}` prefix and says
# nothing about the rest, so this was established by observation: run
# 35807427496 built
#   gh-readonly-queue/develop/pr-36-715d5de64a40597c5a176c1faa7ebbd6a3ca2b83
# Every `pr-<number>-` in the ref is a member, so a batch of several is handled
# by taking them all.
#
# Ancestry was the first attempt and does not work: the queue's merge method is
# SQUASH, so the group's commit is a squash and the pull request's own commits
# are not ancestors of it. That version found no members and failed closed,
# which ejected a good pull request from the queue.
MEMBERS=$(printf '%s\n' "$HEAD_REF" | grep -oE 'pr-[0-9]+-' | grep -oE '[0-9]+' | sort -un | tr '\n' ' ')

# Ancestry as a second opinion, for a merge method that preserves commits.
if [ -z "$(echo "$MEMBERS" | xargs)" ]; then
  git fetch -q origin "$BASE_REF"
  for ROW in $(gh pr list --repo "$REPO" --base "$BASE_REF" --state open --limit 50 \
                 --json number,headRefOid --jq '.[] | "\(.number):\(.headRefOid)"'); do
    PR="${ROW%%:*}"; SHA="${ROW##*:}"
    git cat-file -e "$SHA^{commit}" 2>/dev/null || continue
    if git merge-base --is-ancestor "$SHA" HEAD 2>/dev/null; then
      MEMBERS="$MEMBERS $PR"
    fi
  done
fi
MEMBERS="$(echo "$MEMBERS" | xargs || true)"

if [ -z "$MEMBERS" ]; then
  # Fail closed. A group whose members cannot be identified is a group nothing
  # has verified, and waving it through is precisely what this file exists to
  # prevent.
  echo "::error::Could not identify which pull requests are in this merge group."
  echo "Nothing was verified, so this check cannot pass."
  exit 1
fi
echo "merge group contains: $(for M in $MEMBERS; do printf '#%s ' "$M"; done)"

FAILED=0
for PR in $MEMBERS; do
  case "$MODE" in
    hold)
      # The gap the pull-request-side check cannot cover: a person applying
      # `needs-human` AFTER the pull request was queued. A merge group carries
      # no labels, so ask the pull request itself.
      LABELS=$(gh pr view "$PR" --repo "$REPO" --json labels --jq '[.labels[].name] | join(",")')
      case ",$LABELS," in
        *,needs-human,*)
          echo "::error::#$PR is held by a person (needs-human); it must not merge."
          FAILED=1 ;;
        *) echo "#$PR: not held" ;;
      esac ;;
    review)
      SHA=$(gh pr view "$PR" --repo "$REPO" --json headRefOid --jq .headRefOid)
      VERDICT=$(gh api "repos/$REPO/commits/$SHA/check-runs" \
        --jq '[.check_runs[] | select(.name == "Agent review")]
              | sort_by(.completed_at) | last | .conclusion // "none"')
      if [ "$VERDICT" = "success" ]; then
        echo "#$PR: reviewed and passed on ${SHA:0:8}"
      else
        echo "::error::#$PR has no passing Agent review on ${SHA:0:8} (found: $VERDICT)."
        FAILED=1
      fi ;;
  esac
done

exit "$FAILED"
