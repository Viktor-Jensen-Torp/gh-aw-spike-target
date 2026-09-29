---
description: >
  Gives the agent the exact design of what its issue claims. An issue names the
  design parts it builds as `path#id` under "## Design"; this step copies each
  part's JSON out of the design file in the checkout, with the file's variables,
  so the agent builds to exact sizes, colours and text. People see the same
  parts as images in the issue; the agent gets the source, which is more precise
  for code and needs no image support (gh-aw declares Pi's model text-only).

pre-agent-steps:
  - name: Extract the design parts the issue claims
    env:
      GH_TOKEN: ${{ github.token }}
      REPO: ${{ github.repository }}
      # From the event, or from the dispatch (.github/scripts/dispatch.sh).
      ISSUE: ${{ github.event.issue.number || github.event.inputs.issue }}
      PR: ${{ github.event.pull_request.number || github.event.inputs.pr }}
      PR_BODY: ${{ github.event.pull_request.body }}
    run: |
      set -euo pipefail
      OUT=/tmp/gh-aw/agent/design
      # The issue: the triggering one, or the one a pull request fixes.
      N="${ISSUE:-}"
      # A dispatched run has the pull request's number but not its body.
      if [ -z "$N" ] && [ -z "${PR_BODY:-}" ] && [ -n "${PR:-}" ]; then
        PR_BODY=$(gh api "repos/$REPO/pulls/$PR" --jq '.body // ""')
      fi
      if [ -z "$N" ]; then
        N=$(printf '%s' "${PR_BODY:-}" | grep -oiE '(fixes|closes|resolves) #[0-9]+' | grep -oE '[0-9]+' | head -1 || true)
      fi
      [ -n "$N" ] || { echo "No issue to read design claims from."; exit 0; }
      CLAIMS=$(gh api "repos/$REPO/issues/$N" --jq '.body // ""' \
                 | { grep -oE '`[^` ]+\.pen#[A-Za-z0-9_-]+`' || true; } | tr -d '`' | sort -u)
      [ -n "$CLAIMS" ] || { echo "#$N claims no design parts."; exit 0; }
      mkdir -p "$OUT"
      for C in $CLAIMS; do
        FILE="${C%%#*}"; ID="${C#*#}"
        [ -f "$FILE" ] || { echo "::warning::#$N claims $C, but $FILE is not in the checkout"; continue; }
        jq --arg id "$ID" '[.. | objects | select(.id? == $id)][0] // empty' "$FILE" > "$OUT/$ID.json"
        [ -s "$OUT/$ID.json" ] || { rm -f "$OUT/$ID.json"; echo "::warning::$C not found in $FILE"; continue; }
        jq '.variables // {}' "$FILE" > "$OUT/variables.json"
        echo "- \`$ID.json\`: $(jq -r '.name // .type' "$OUT/$ID.json") (from \`$FILE\`)" >> "$OUT/index.md"
      done
      echo "design parts for #$N:"; cat "$OUT/index.md" 2>/dev/null || echo "  none found"
---

## The design

If `/tmp/gh-aw/agent/design/index.md` exists, the issue claims parts of a design
file, and that folder holds each part's exact JSON (`<id>.json`) plus the file's
`variables.json` (values such as `$accent` refer to it). These are the
specification for layout, sizes, colours and text: build and judge against them,
reading them with `jq`. Each element's `name` says what it is.
