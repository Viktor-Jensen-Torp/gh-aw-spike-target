---
description: >
  Gives the agent its issue as a file. gh-aw's `steps.sanitized.outputs.text`
  is blank when the actor lacks write permission (compute_text.cjs), which is
  every run the dispatcher starts as the reviewer App: on #113 the implementer
  got "" and built from the title alone. `github.event.issue.body` is not an
  allowed prompt expression, so the issue is fetched here instead, the way
  gh-aw's own guides pre-fetch data (DataOps). An issue without a body stops
  the run, visibly, before any agent time is spent.

pre-agent-steps:
  - name: Write the issue to a file
    env:
      GH_TOKEN: ${{ github.token }}
      REPO: ${{ github.repository }}
      ISSUE: ${{ github.event.issue.number }}
      PR_BODY: ${{ github.event.pull_request.body }}
    run: |
      set -euo pipefail
      OUT=/tmp/gh-aw/agent/issue.json
      # The issue: the triggering one, or the one a pull request fixes.
      N="${ISSUE:-}"
      if [ -z "$N" ]; then
        N=$(printf '%s' "${PR_BODY:-}" | grep -oiE '(fixes|closes|resolves) #[0-9]+' | grep -oE '[0-9]+' | head -1 || true)
      fi
      [ -n "$N" ] || { echo "::error::No issue: not an issue event, and the pull request names none with 'Fixes #N'."; exit 1; }
      mkdir -p "$(dirname "$OUT")"
      gh api "repos/$REPO/issues/$N" \
        --jq '{number, title, type: (.type.name // null), labels: [.labels[].name], body: (.body // "")}' > "$OUT"
      jq -e '.body | test("\\S")' "$OUT" >/dev/null \
        || { echo "::error::#$N has no body; there is nothing to build or check against."; exit 1; }
      jq -r '"#\(.number) (\(.type // "no type")): \(.title) — \(.body | length) characters"' "$OUT"
---
