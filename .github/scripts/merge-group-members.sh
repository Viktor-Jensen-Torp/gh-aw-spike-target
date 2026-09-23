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

git fetch -q origin "$BASE_REF"

# A pull request is in this group when the commit it offered is an ancestor of
# the group's head. Derived from ancestry rather than the temporary branch's
# name, which GitHub does not document beyond its prefix.
MEMBERS=""
for ROW in $(gh pr list --repo "$REPO" --base "$BASE_REF" --state open --limit 50 \
               --json number,headRefOid --jq '.[] | "\(.number):\(.headRefOid)"'); do
  PR="${ROW%%:*}"; SHA="${ROW##*:}"
  git cat-file -e "$SHA^{commit}" 2>/dev/null || continue
  if git merge-base --is-ancestor "$SHA" HEAD 2>/dev/null; then
    MEMBERS="$MEMBERS $PR"
  fi
done
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
