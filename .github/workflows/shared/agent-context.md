---
description: >
  Gives the agent, as files: its issue, the requirements for the issue's type,
  and the conventions that apply to the change.
  The issue is fetched here because gh-aw's `steps.sanitized.outputs.text` is
  blank when the actor lacks write permission (compute_text.cjs): on #113 the
  implementer got "" and built from the title alone. The conventions are picked
  by .github/scripts/agent-context.sh: left to follow conventions/index.md
  itself, the reviewer on run 36602126236 skipped the four documents it lists
  under "Always". A missing issue, body or requirements file stops the run,
  visibly, before any agent time is spent.

import-schema:
  required:
    type: boolean
    default: true
    description: >
      Whether a run without a linked issue must stop. True for agent work. The
      reviewer sets false: a person's pull request may link no issue, and is
      then reviewed without requirements.

pre-agent-steps:
  - name: Write the issue, its requirements and the conventions to files
    env:
      GH_TOKEN: ${{ github.token }}
      REPO: ${{ github.repository }}
      # From the event, or from the dispatch (.github/scripts/dispatch.sh).
      ISSUE: ${{ github.event.issue.number || github.event.inputs.issue }}
      PR: ${{ github.event.pull_request.number || github.event.inputs.pr }}
      PR_BODY: ${{ github.event.pull_request.body }}
      REQUIRED: ${{ github.aw.import-inputs.required }}
    run: |
      set -euo pipefail
      DIR=/tmp/gh-aw/agent
      mkdir -p "$DIR"
      # The issue: the triggering one, or the one a pull request fixes.
      N="${ISSUE:-}"
      # A dispatched run has the pull request's number but not its body.
      if [ -z "$N" ] && [ -z "${PR_BODY:-}" ] && [ -n "${PR:-}" ]; then
        PR_BODY=$(gh api "repos/$REPO/pulls/$PR" --jq '.body // ""')
      fi
      if [ -z "$N" ]; then
        N=$(printf '%s' "${PR_BODY:-}" | grep -oiE '(fixes|closes|resolves) #[0-9]+' | grep -oE '[0-9]+' | head -1 || true)
      fi
      # The paths the change touches, for the conventions: a pull request's
      # changed files, or for a new change the paths its issue names.
      conventions() { # <issue body> [issue type]
        TMP=$(mktemp -d)
        if [ -n "${PR:-}" ]; then
          gh api "repos/$REPO/pulls/$PR/files" --paginate --jq '.[].filename' > "$TMP/paths.txt"
        else
          printf '%s' "$1" | grep -oE '`(apps|packages|docs)/[^` ]+`' | tr -d '`' | sort -u > "$TMP/paths.txt" || true
        fi
        printf '%s' "$1" > "$TMP/issue-body.md"
        # A new change also passes the issue's type, so its conventions follow
        # where the change will land, not only the paths the body names (#249).
        NEW_CHANGE_TYPE=""; [ -n "${PR:-}" ] || NEW_CHANGE_TYPE="${2:-none}"
        bash .github/scripts/agent-context.sh "$TMP/paths.txt" "$TMP/issue-body.md" "$DIR/conventions.md" $NEW_CHANGE_TYPE
        rm -rf "$TMP"
      }
      if [ -z "$N" ]; then
        if [ "$REQUIRED" = "false" ]; then
          conventions ""
          echo "No linked issue; reviewing without requirements."; exit 0
        fi
        echo "::error::No issue: not an issue event, and the pull request names none with 'Fixes #N'."; exit 1
      fi
      gh api "repos/$REPO/issues/$N" \
        --jq '{number, title, type: (.type.name // null), labels: [.labels[].name], body: (.body // "")}' > "$DIR/issue.json"
      jq -e '.body | test("\\S")' "$DIR/issue.json" >/dev/null \
        || { echo "::error::#$N has no body; there is nothing to build or check against."; exit 1; }
      # The requirements for the issue's type. .github/ is the base branch's
      # copy here (restore_base_github_folders.sh), so a pull request cannot
      # change the bar it is judged by.
      TYPE=$(jq -r '.type // ""' "$DIR/issue.json" | tr '[:upper:]' '[:lower:]')
      REQ=".github/conventions/chain/requirements/$TYPE.md"
      [ -n "$TYPE" ] && [ -f "$REQ" ] \
        || { echo "::error::#$N has type '${TYPE:-none}', and there is no $REQ for it."; exit 1; }
      cp "$REQ" "$DIR/requirements.md"
      jq -r '"#\(.number) (\(.type)): \(.title) — \(.body | length) characters"' "$DIR/issue.json"
      echo "requirements: $REQ ($(grep -cE '^\| *[A-Z][0-9]+ *\|' "$REQ") rows)"
      conventions "$(jq -r .body "$DIR/issue.json")" "$(jq -r '.type // ""' "$DIR/issue.json")"
---
