#!/usr/bin/env bash
# What needs a person now, as markdown: the body of the rolling "What needs you"
# issue (needs-you.yml). gh-aw's maintainer guidance asks for exactly this: one
# human-facing summary, pending actions first, finished entries removed rather
# than kept (.github/aw/maintainer.md, "Maintain a human-facing summary").
# Deterministic: it reads labels, links and the Sprint field; it judges nothing.
#
# Usage (REPO=owner/name; GH_TOKEN able to read the organisation's projects):
#   needs-you.sh > body.md
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
URL="https://github.com/$REPO"

issues() { gh issue list --repo "$REPO" --state open --limit 200 "$@" --json number,title,labels \
             --jq '.[] | select([.labels[].name] | index("merged") | not) | "\(.number)\t\(.title)"'; }
merged_issues() { gh issue list --repo "$REPO" --state open --limit 200 --label merged --json number,title \
                    --jq '.[] | "\(.number)\t\(.title)"'; }
line() { printf -- '- [#%s](%s/issues/%s) %s\n' "$1" "$URL" "$1" "$2"; }

SPRINT=$(bash "$HERE/current-sprint.sh" "${REPO%/*}" "${PROJECT:-2}")
SPRINT_NAME=$(jq -r '.title' <<<"$SPRINT")
IN_SPRINT=$(jq -r '.issues[]' <<<"$SPRINT")
in_sprint() { grep -qx "$1" <<<"$IN_SPRINT"; }

SECTIONS=""
section() { # <heading> <what to do> <lines>
  [ -n "$3" ] || return 0
  SECTIONS+=$(printf '### %s\n\n%s\n\n%s\n\n' "$1" "$2" "$3")$'\n\n'
}

# 1. Agent work a person holds: the pipeline stopped and handed it over.
HELD=$(gh pr list --repo "$REPO" --state open --label needs-human --json number,title \
         --jq '.[] | "\(.number)\t\(.title)"' | while IFS=$'\t' read -r N T; do
         printf -- '- [#%s](%s/pull/%s) %s\n' "$N" "$URL" "$N" "$T"; done)
section "Pull requests handed to you" \
  "The pipeline stopped on these (\`needs-human\`); the latest comment on each says why. Fix it, then remove the label." "$HELD"

# 2. Refined, waiting for your yes. Sprint issues first.
REFINED=$(issues --label refined | sort -n | while IFS=$'\t' read -r N T; do
  if in_sprint "$N"; then line "$N" "$T **(in ${SPRINT_NAME})**"; fi; done
  issues --label refined | sort -n | while IFS=$'\t' read -r N T; do
  if ! in_sprint "$N"; then line "$N" "$T"; fi; done)
section "Waiting for your \`ready\`" \
  "The refiner shaped these. Read each; if it is right, add \`ready\` (and put it in a sprint to have it built)." "$REFINED"

# 3. The refiner could not finish: a question, or too big.
ASKED=$(issues --label needs-shape | sort -n | while IFS=$'\t' read -r N T; do line "$N" "$T — needs your answer"; done
        issues --label needs-split | sort -n | while IFS=$'\t' read -r N T; do line "$N" "$T — too big; split it"; done)
section "Questions from the refiner" \
  "Answer in a comment or edit the issue; the refiner looks again tonight." "$ASKED"

# 4. The current sprint's issues that cannot start, and why.
if [ -n "$SPRINT_NAME" ] && [ -n "$IN_SPRINT" ]; then
  STUCK=""
  for N in $IN_SPRINT; do
    J=$(gh api graphql -F n="$N" -f owner="${REPO%/*}" -f name="${REPO#*/}" -f query='
      query($owner: String!, $name: String!, $n: Int!) { repository(owner: $owner, name: $name) {
        issue(number: $n) { title labels(first: 20) { nodes { name } }
          blockedBy(first: 20) { nodes { number state labels(first: 20) { nodes { name } } } } } } }' \
      --jq '.data.repository.issue | {title, labels: [.labels.nodes[].name],
             waiting: [.blockedBy.nodes[] | select(.state == "OPEN" and ([.labels.nodes[].name] | index("merged") | not)) | .number]}')
    T=$(jq -r .title <<<"$J"); L=$(jq -r '.labels | join(",")' <<<"$J"); W=$(jq -r '.waiting | map("#\(.)") | join(", ")' <<<"$J")
    case ",$L," in
      *,merged,*|*,human,*|*,paused,*) continue ;;   # done here, a person's own, or deliberately stopped
      *,refined,*|*,needs-shape,*|*,needs-split,*) continue ;;   # already listed above
    esac
    if [ -n "$W" ]; then STUCK+=$(line "$N" "$T — blocked by $W")$'\n'
    elif [[ ",$L," != *,ready,* ]]; then STUCK+=$(line "$N" "$T — not refined yet; add \`needs-refinement\`")$'\n'
    fi
  done
  section "In ${SPRINT_NAME} but cannot start" \
    "The dispatcher skips these. Blocked ones start by themselves once their blockers merge." "${STUCK%$'\n'}"
fi

# 5. The pipeline's own failures, filed by gh-aw ("[aw] … failed", "… reported
#    incomplete result"). Its grouping parents ("[aw] … Runs") and reports are not.
FAILED=$(issues --label agentic-workflows | sort -n | grep -E '^[0-9]+	\[aw\] .*(failed|incomplete)' \
         | while IFS=$'\t' read -r N T; do line "$N" "$T"; done)
section "Pipeline failures" \
  "gh-aw filed these when a run failed. Look at the run each links; close the issue once it is understood." "$FAILED"

# 6. Merged into develop, waiting for a release to main.
MERGED=$(merged_issues | grep -c . || true)
[ "$MERGED" = 0 ] || section "Ready to release" \
  "$MERGED merged issue(s) are on \`develop\` and not on \`main\` yet. Run the [Release](${URL}/actions/workflows/release.yml) workflow when you want them released." \
  "$(merged_issues | sort -n | while IFS=$'\t' read -r N T; do line "$N" "$T"; done)"

echo "<!-- needs-you -->"
echo "Updated by [needs-you.yml](${URL}/blob/main/.github/workflows/needs-you.yml) on $(date -u '+%Y-%m-%d %H:%M UTC'). Everything here waits on a person; nothing is listed that the pipeline is still working on."
echo
if [ -n "$SECTIONS" ]; then printf '%s' "$SECTIONS"; else echo "**Nothing needs you right now.**"; fi
