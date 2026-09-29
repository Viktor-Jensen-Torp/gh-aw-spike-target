#!/usr/bin/env bash
# What one agent role is given, and when: a map generated from the files the
# runs use, so it cannot drift from them. Read-only; prints markdown.
#
# Usage: agent-inputs.sh <role>      (implement, review, rework, refine, relate,
#                                      unblock, release-review)
#        agent-inputs.sh --all
#
# Sources: the compiled lock (our prompt sections, in the order the agent reads
# them), the workflow and its imports (files prepared before the run),
# .github/pi/postconditions.cjs (guard refusals and nudges) and
# shared/budget.md (gh-aw's budget warnings). gh-aw's own fixed text is not in
# the lock; a run's `aw-prompts/prompt.txt` (gh aw audit <run>) shows it all.
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$HERE/../.." && pwd)"
WF="$ROOT/.github/workflows"

map() {
  local ROLE="$1" MD="$WF/$1.md" LOCK="$WF/$1.lock.yml"
  [ -f "$MD" ] && [ -f "$LOCK" ] || { echo "agent-inputs.sh: no workflow '$1'" >&2; return 2; }

  echo "# $ROLE"
  echo
  echo "## 1. At the start: the prompt (first user message; compaction can summarise it)"
  echo
  echo "gh-aw's fixed text (security, safe-output and GitHub-context rules) comes first; then ours:"
  echo
  echo "| Section | Bytes | From |"
  echo "|---|---|---|"
  # Each chunk is a YAML double-quoted string; JSON decodes it. Our sections
  # follow gh-aw's </system> chunk.
  local after=0 CHUNK TEXT HEAD FROM F
  while IFS= read -r CHUNK; do
    TEXT=$(jq -r . <<<"$CHUNK" 2>/dev/null || printf '%s' "$CHUNK")
    if [ "$after" = 0 ]; then [[ "$TEXT" == *"</system>"* ]] && after=1; continue; fi
    HEAD=$(printf '%s\n' "$TEXT" | grep -m1 -E '^#{1,3} ' || true)
    [ -n "$HEAD" ] || continue
    FROM="$ROLE.md"
    for F in "$WF"/shared/*.md; do grep -qxF -- "$HEAD" "$F" && FROM="shared/$(basename "$F")" && break; done
    printf '| %s | %s | %s |\n' "${HEAD//|/\\|}" "$(printf '%s' "$TEXT" | wc -c | tr -d ' ')" "$FROM"
  done < <(grep -oE 'GH_AW_PROMPT_CONTENT_[0-9]+: ".*"$' "$LOCK" | sed -E 's/^GH_AW_PROMPT_CONTENT_[0-9]+: //')
  echo

  echo "## 2. At the start: files prepared before the agent runs"
  echo
  local SOURCES=("$MD") IMP
  for IMP in $(awk '/^imports:/{f=1;next} f&&/^[a-z]/{exit} f' "$MD" | grep -oE 'shared/[a-z0-9-]+\.md' | sort -u); do
    SOURCES+=("$WF/$IMP")
  done
  echo "| Step | Writes | From |"
  echo "|---|---|---|"
  for F in "${SOURCES[@]}"; do
    awk '/^(pre-agent-steps|steps):/{f=1;next} f&&/^[a-z-]+:/{f=0} f' "$F" \
      | awk -v src="$(basename "$F")" '
          # Files written through a variable (DIR=/tmp/gh-aw/agent; "$DIR/issue.json") count too.
          /^  - name: /{ if (name) print name "\x1f" files "\x1f" src; name=substr($0, index($0,"name: ")+6); files=""; delete v; next }
          { if (match($0, /[A-Z_]+=\/tmp\/gh-aw\/[A-Za-z0-9_.\/-]+/)) { a=substr($0, RSTART, RLENGTH); k=substr(a, 1, index(a,"=")-1); v[k]=substr(a, index(a,"=")+1) }
            for (k in v) { gsub("\\$\\{" k "\\}", v[k]); gsub("\\$" k, v[k]) }
            while (match($0, /\/tmp\/gh-aw\/(agent|comment-memory)\/[A-Za-z0-9_.\/-]*[A-Za-z0-9_]/)) {
              p=substr($0, RSTART, RLENGTH); if (index(files, p)==0) files=files (files?", ":"") "`" p "`"; $0=substr($0, RSTART+RLENGTH) } }
          END { if (name) print name "\x1f" files "\x1f" src }' \
      | while IFS=$'\x1f' read -r N W S; do printf '| %s | %s | %s |\n' "$N" "${W:-–}" "$S"; done
  done
  echo

  echo "## 3. While working: the guard (.github/pi/postconditions.cjs)"
  echo
  node -e '
    const m = require(process.argv[1]); const role = process.argv[2];
    const s = m.ROLES[role.replace(/^release-review$/, "release")];
    const out = [];
    out.push("- Every bash call: refused if it stops processes by name (pkill, killall, pgrep).");
    if (!s) { out.push("- No role configured: nothing else is checked."); console.log(out.join("\n")); process.exit(0); }
    for (const [tool, r] of Object.entries(s.checks)) out.push(`- \`${tool}\`: refused unless \`${r.field}\` is one of ${r.allowed.join(", ")}${r.once ? "; a second call is refused" : ""}${r.onlyWith ? ` (when \`${r.onlyWith}\` is sent)` : ""}.`);
    if (s.checks.submit_pull_request_review && s.checks.create_check_run) out.push("- Review event and check conclusion must agree, whichever comes first.");
    if (s.verify) out.push("- `create_pull_request` / `push_to_pull_request_branch`: runs verify.sh first and refuses with the failures; after 3 refusals, tells the agent to stop.");
    if (s.linkIssue) out.push("- `create_pull_request`: refused unless the body says `Fixes #<issue>`.");
    if (s.checkRows) out.push("- `submit_pull_request_review`: refused if review-rows.sh would refuse a row (no changed file named, n/a not allowed, missing row, no data).");
    if (s.checkIssue) out.push("- `update_issue`: refused unless the new body passes check-issue.sh.");
    console.log(out.join("\n"));
    console.log("\n## 4. When it thinks it is done: nudges (at most 2)\n");
    const n = s.required.map(g => `- until it has called ${g.map(t => "`" + t + "`").join(" or ")}`);
    if (s.decideEach) n.push(`- until every candidate has one of ${s.decideEach.labels.map(l => "`" + l + "`").join(", ")}`);
    console.log(n.join("\n"));
  ' "$ROOT/.github/pi/postconditions.cjs" "$ROLE"
  echo

  echo "## 5. While working: gh-aw's own messages"
  echo
  local CAP
  CAP=$(sed -nE 's/^max-ai-credits: *([0-9]+).*/\1/p' "$MD" "$WF/shared/budget.md" | head -1)
  echo "- Time: a warning with 5 minutes left and another with 2 (pi_steering_extension.cjs)."
  echo "- Budget: warnings at 80, 90, 95 and 99% of ${CAP:-1000} AI credits (frontmatter.md, max-ai-credits)."
  echo
}

if [ "${1:-}" = --all ]; then
  for R in implement review rework refine relate unblock release-review; do map "$R"; done
else
  map "${1:?usage: agent-inputs.sh <role> | --all}"
fi
