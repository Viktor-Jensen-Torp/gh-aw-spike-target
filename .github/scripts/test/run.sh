#!/usr/bin/env bash
# Tests for the pipeline's own scripts, so a routing bug shows up in the pull
# request that brings it and not in a live run afterwards (#136 took three).
# Needs bash, git, jq; the check-run replay also needs `gh` signed in.
#
#   bash .github/scripts/test/run.sh
#
# Replays are real inputs recorded from past runs (fixtures/); each names where
# it came from. Run by .github/workflows/pipeline-tests.yml.

set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
SCRIPTS="$HERE/.."
FIX="$HERE/fixtures"
WORK="$(mktemp -d "${TMPDIR:-/tmp}/pipeline-test.XXXX")"
trap 'rm -rf "$WORK"' EXIT
fails=0

check() { # <label> <expected> <actual>
  if [ "$2" = "$3" ]; then echo "PASS  $1"
  else echo "FAIL  $1"; diff <(echo "$2") <(echo "$3") | sed 's/^/      /'; fails=$((fails + 1)); fi
}

# --- review-rows.sh -------------------------------------------------------------
REQ_COMPONENT="$HERE/../../conventions/chain/requirements/component.md"
REQ_TASK="$HERE/../../conventions/chain/requirements/task.md"
rows() { bash "$SCRIPTS/review-rows.sh" "$@" 2>&1; }
review() { # <json rows...> -> a data.json path
  local f; f="$(mktemp "$WORK/data.XXXX")"
  printf '{"requirements":[%s]}' "$(IFS=,; echo "$*")" > "$f"; echo "$f"
}
row() { printf '{"id":"%s","status":"%s","evidence":"%s"}' "$1" "$2" "$3"; }

# Replay: #136's review on a2ab5ec (run 36524573206). U6 names the component's
# folder, which holds changed files; U3 names no file at all.
check "replay #136: rows as routed after the fix" \
"C1: unmet
U1: met
U2: met
U3: met-without-a-changed-file
U4: unmet
U5: n/a
U6: met" \
  "$(rows "$FIX/pr136-review.json" "$REQ_COMPONENT" "$FIX/pr136-files.txt")"

printf '%s\n' apps/web/src/components/Button/Button.tsx apps/web/src/components/Button/Button.stories.tsx docs/architecture.md > "$WORK/files.txt"
all_met() { # <row-id> <evidence> -> that row's line, every other row met with a real path
  local id ids r=() f
  ids=$(sed -nE 's/^\| *([A-Z][0-9]+) *\|.*/\1/p' "$REQ_COMPONENT")
  for f in C1 $ids; do
    if [ "$f" = "$1" ]; then r+=("$(row "$f" met "$2")")
    else r+=("$(row "$f" met "apps/web/src/components/Button/Button.tsx:3")"); fi
  done
  rows "$(review "${r[@]}")" "$REQ_COMPONENT" "$WORK/files.txt" | grep "^$1:"
}
check "a changed file with a line counts"              "U1: met" "$(all_met U1 "Default story, apps/web/src/components/Button/Button.stories.tsx:14.")"
check "a folder holding a changed file counts"         "U6: met" "$(all_met U6 "apps/web/src/components/Button/, native props")"
check "a folder holding no changed file does not"      "U6: met-without-a-changed-file" "$(all_met U6 "apps/web/src/components/Avatar/")"
check "a file this PR did not change does not"         "U1: met-without-a-changed-file" "$(all_met U1 "apps/web/src/App.tsx:4")"
check "a bare file name does not (#118)"               "U1: met-without-a-changed-file" "$(all_met U1 "architecture.md updated")"
check "a prefix of a file name is not a folder"        "U6: met-without-a-changed-file" "$(all_met U6 "apps/web/src/components/Butt")"
check "C1 needs no path"                               "C1: met" "$(all_met C1 "none found")"

na() { rows "$(review "$(row C1 met x)" "$(row "$1" n/a "nothing claimed")")" "$REQ_COMPONENT" "$WORK/files.txt" | grep "^$1:"; }
check "n/a on a row that allows it"                    "U4: n/a" "$(na U4)"
check "n/a on a row that does not"                     "U1: n/a-not-allowed" "$(na U1)"
check "a row the review left out is missing" "U2: missing" \
  "$(rows "$(review "$(row C1 met x)")" "$REQ_COMPONENT" "$WORK/files.txt" | grep '^U2:')"
check "the task file's rows are read too" "$(sed -nE 's/^\| *([A-Z][0-9]+) *\|.*/\1/p' "$REQ_TASK" | head -1): missing" \
  "$(rows "$(review "$(row C1 met x)")" "$REQ_TASK" "$WORK/files.txt" | sed -n 2p)"
echo "no rows" > "$WORK/empty.md"
bash "$SCRIPTS/review-rows.sh" "$(review "$(row C1 met x)")" "$WORK/empty.md" "$WORK/files.txt" >/dev/null 2>&1
check "a requirements file with no rows is an error"   "2" "$?"

# --- check-conventions.sh against a shallow clone ----------------------------------
# Rework runs 36473378915 and 36500339583: the checkout held one commit of the
# pull request and one of develop, so there was no merge base, and the check
# reported the base's feature folders as added by the pull request.
ORIGIN="$WORK/origin"
git init -q -b develop "$ORIGIN"
(
  cd "$ORIGIN" && git config user.email t@t && git config user.name t
  mkdir -p apps/web/src/features/home apps/api/src/features/health
  touch apps/web/src/features/home/Home.tsx apps/api/src/features/health/routes.ts
  git add . && git commit -qm base
  git checkout -qb pr
  mkdir -p apps/web/src/components/Button
  touch apps/web/src/components/Button/Button.tsx apps/web/src/components/Button/Button.stories.tsx
  git add . && git commit -qm button
  git checkout -q develop && touch apps/web/src/features/home/more.ts && git add . && git commit -qm later
) >/dev/null
conventions() { # <clone-dir> -> "exit=<code> <first line>"
  local out rc
  out=$(cd "$1" && bash "$SCRIPTS/check-conventions.sh" origin/develop 2>&1); rc=$?
  echo "exit=$rc $(head -1 <<<"$out")"
}
git clone -q --no-local --branch pr "$ORIGIN" "$WORK/full"
check "full history: the pull request meets the conventions" "exit=0 ✓ conventions met" "$(conventions "$WORK/full")"
git clone -q --no-local --depth 1 --branch pr "$ORIGIN" "$WORK/shallow"
git -C "$WORK/shallow" fetch -q --depth=1 origin '+refs/heads/develop:refs/remotes/origin/develop'
check "shallow history: says so instead of a false breach" \
  "exit=2 ✗ cannot check conventions: no common history with origin/develop in this checkout." \
  "$(conventions "$WORK/shallow")"

# --- hand-offs: workflows start each other by dispatch, never by a label ---------
WF="$HERE/../../workflows"
# A fake gh that prints its arguments one per line, to read what would be sent.
mkdir -p "$WORK/bin"; printf '#!/usr/bin/env bash\nprintf "%%s\\n" "$@"\n' > "$WORK/bin/gh"; chmod +x "$WORK/bin/gh"
sent() { PATH="$WORK/bin:$PATH" REPO=o/r bash "$SCRIPTS/dispatch.sh" "$@" | sed -n 's/^aw_context=//p'; }
check "dispatch.sh: a pull request carries its aw_context" \
  '{"item_type":"pull_request","item_number":"136","event_type":"pull_request","repo":"o/r"}' "$(sent rework.lock.yml pr 136 sha=abc)"
check "dispatch.sh: an issue is an issues event" \
  '{"item_type":"issue","item_number":"7","event_type":"issues","repo":"o/r"}' "$(sent implement.lock.yml issue 7)"
check "dispatch.sh: inputs and ref as given" "main pr=136 sha=abc" \
  "$(PATH="$WORK/bin:$PATH" REPO=o/r bash "$SCRIPTS/dispatch.sh" rework.lock.yml pr 136 sha=abc | grep -E '^(main|pr=|sha=)' | tr '\n' ' ' | sed 's/ $//')"
REPO=o/r DRY_RUN=1 bash "$SCRIPTS/dispatch.sh" x.lock.yml pr 12a >/dev/null 2>&1
check "dispatch.sh: refuses a non-number" "2" "$?"

# Every `dispatch.sh <workflow> <pr|issue>` call names a workflow whose lock
# accepts a dispatch with that input (and aw_context, which gh-aw adds).
CALLS=$(grep -rhoE 'dispatch\.sh[^|;]* [a-z-]+\.lock\.yml (pr|issue)' "$WF" "$SCRIPTS" --include='*.md' --include='*.yml' \
          | grep -oE '[a-z-]+\.lock\.yml (pr|issue)' | sort -u)
BAD=""
while read -r LOCK INPUT; do
  [ -n "$LOCK" ] || continue
  ON=$(awk '/^"?on"?:/{f=1;next} f&&/^[a-z]/{exit} f' "$WF/$LOCK")
  grep -q '^  workflow_dispatch:' <<<"$ON" && grep -qE "^      $INPUT:" <<<"$ON" && grep -qE '^      aw_context:' <<<"$ON" \
    || BAD+="$LOCK($INPUT) "
done <<<"$CALLS"
check "every dispatch target accepts its input ($(echo "$CALLS" | wc -l | tr -d ' ') calls)" "" "$BAD"

# No agentic workflow starts on a label any more (they were implement,
# needs-rework, recheck, refine).
LABELLED=$(for L in "$WF"/*.lock.yml; do
  awk '/^"?on"?:/{f=1;next} f&&/^[a-z]/{exit} f' "$L" | grep -q -- '- labeled' && basename "$L"; done | tr '\n' ' ')
check "no agentic workflow is started by a label" "" "$LABELLED"

# A dispatched review must attach its verdict to the pull request, not to main:
# without a target, create_check_run uses GITHUB_SHA (create_check_run.cjs).
NOTARGET=$(for L in "$WF"/*.lock.yml; do
  grep -o 'create_check_run\\":{[^}]*}' "$L" | grep -qv 'target' && basename "$L"; done | tr '\n' ' ')
check "every create_check_run names its target" "" "$NOTARGET"

# Every pre-activation output a lock reads is one the job exports. Review read
# `proceed` without exporting it, so every review skipped (run 36591128696).
UNSET=$(for L in "$WF"/*.lock.yml; do
  OUT=$(awk '/^  pre_activation:/{f=1} f&&/^    outputs:/{p=1;next} p&&/^    [a-z]/{exit} p' "$L" | sed -nE 's/^      ([a-z_-]+):.*/\1/p')
  for K in $(grep -oE 'needs\.pre_activation\.outputs\.[a-z_-]+' "$L" | sed 's/.*\.//' | sort -u); do
    grep -qx "$K" <<<"$OUT" || printf '%s:%s ' "$(basename "$L")" "$K"
  done; done)
check "every pre-activation output that is read is exported" "" "$UNSET"

# Workflows that dispatch with GITHUB_TOKEN need actions: write.
NOPERM=$(for F in "$WF"/*.md "$WF"/*.yml; do
  [[ "$F" == *.lock.yml ]] && continue
  grep -q 'bash [^ ]*dispatch\.sh' "$F" && ! grep -q 'actions: write' "$F" && basename "$F"; done | tr '\n' ' ')
check "every workflow that dispatches has actions: write" "" "$NOPERM"

# Auto-merge is armed by the implementer App: queued with GITHUB_TOKEN, #136
# got no merge_group checks and was dropped (2026-09-29).
check "the sweeper arms auto-merge as the implementer App" "1" \
  "$(grep -c 'GH_TOKEN="$IMPLEMENTER_TOKEN" gh api graphql' "$WF/sweeper.yml")"

# --- agent-context.sh: the conventions an agent is given -------------------------
# Picked from index.md; on review run 36602126236 the reviewer, choosing for
# itself, skipped the four documents under "Always".
ctx() { # <paths, newline-separated> <issue body> -> the picked files, space-separated
  printf '%s\n' "$1" > "$WORK/ctx-paths.txt"; printf '%s' "$2" > "$WORK/ctx-body.md"
  (cd "$HERE/../../.." && bash .github/scripts/agent-context.sh "$WORK/ctx-paths.txt" "$WORK/ctx-body.md" "$WORK/ctx.md" >/dev/null) \
    && sed -nE 's/^- `([^`]+)` \(.*/\1/p' "$WORK/ctx.md" | tr '\n' ' ' | sed 's/ $//'
}
ALWAYS=".github/conventions/chain/principles.md .github/conventions/chain/structure.md .github/conventions/chain/testing.md docs/architecture.md"
check "a component with design claims (#136)" \
  "$ALWAYS .github/conventions/web.md .github/conventions/chain/design.md .github/conventions/components.md" \
  "$(ctx "apps/web/src/components/Button/Button.tsx" 'Builds `design/tempo.pen#yg090`.')"
check "design.md only when the issue claims design parts" \
  "$ALWAYS .github/conventions/web.md .github/conventions/components.md" \
  "$(ctx "apps/web/src/components/Button/Button.tsx" "No claims.")"
check "an API change" "$ALWAYS .github/conventions/api.md" "$(ctx "apps/api/src/app.ts" "")"
check "no paths: the Always documents only" "$ALWAYS" "$(ctx "" "")"
check "each document's text is included, without its frontmatter" "0 1" \
  "$(grep -c '^okf_version:' "$WORK/ctx.md") $(grep -c '^<!-- docs/architecture.md -->' "$WORK/ctx.md")"

# --- agent-inputs.sh: the map of what each role is given -------------------------
MAPOK=""
for R in implement review rework refine relate unblock release-review; do
  OUT=$(bash "$SCRIPTS/agent-inputs.sh" "$R" 2>&1) || { MAPOK+="$R(failed) "; continue; }
  for H in "## 1." "## 2." "## 3." "## 4." "## 5."; do grep -qF "$H" <<<"$OUT" || MAPOK+="$R(no $H) "; done
  grep -qE '^\| # ' <<<"$OUT" || MAPOK+="$R(no task section) "
done
check "agent-inputs.sh maps every role" "" "$MAPOK"
check "the map names review's pre-fetched diff" "1" \
  "$(bash "$SCRIPTS/agent-inputs.sh" review | grep -c 'pr-diff.patch')"

# --- current-sprint.sh: the sprint is the Project's Sprint iteration ---------------
sprint() { SPRINT_DATA="$FIX/sprint-board.json" SPRINT_TODAY="$1" bash "$SCRIPTS/current-sprint.sh" org 2 | jq -c '[.title, .issues]'; }
check "the first day of a sprint belongs to it"   '["Sprint 1",[83,125]]' "$(sprint 2026-09-28)"
check "its last day too (14 days: to Oct 11)"     '["Sprint 1",[83,125]]' "$(sprint 2026-10-11)"
check "the next Monday starts the next sprint"    '["Sprint 2",[126]]'    "$(sprint 2026-10-12)"
check "before the first sprint: none"             '["",[]]'               "$(sprint 2026-09-27)"
check "after the last planned sprint: none"       '["",[]]'               "$(sprint 2026-10-26)"

# --- design-part.sh: a design part with its components in place ---------------------
# fixtures/design-refs.pen: a Row component holding an Icon Circle component, and
# a screen using Row plain, with overrides, and with a part replaced.
part() { bash "$SCRIPTS/design-part.sh" "$FIX/design-refs.pen" "$1"; }
check "design-part: no ref is left" "0" \
  "$(part screen | jq '[.. | objects | select(.type == "ref")] | length')"
check "design-part: a plain instance is the component, marked as one" \
  '{"id":"plain","name":"Plain Row","gap":8,"component":{"id":"row","name":"Row"},"label":"Default","icon":"check"}' \
  "$(part screen | jq -c '.children[0] | {id, name, gap, component, label: .children[1].content, icon: .children[0].children[0].icon}')"
check "design-part: the component's canvas position is not the instance's" "null null" \
  "$(part screen | jq -r '.children[0] | "\(.x) \(.y)"')"
check "design-part: a property on the instance overrides the component" '"$bg"' \
  "$(part screen | jq -c '.children[1].fill')"
check "design-part: descendants merge by id, and by ID path into a nested component" \
  '{"label":"Inbox","labelFill":"$text","countEnabled":false,"icon":"inbox"}' \
  "$(part screen | jq -c '.children[1] | {label: .children[1].content, labelFill: .children[1].fill, countEnabled: .children[2].enabled, icon: .children[0].children[0].icon}')"
check "design-part: a descendant with a type replaces the part, resolved too" \
  '{"id":"badge","component":{"id":"icon","name":"Icon Circle"},"glyph":"check"}' \
  "$(part screen | jq -c '.children[2].children[2] | {id, component, glyph: .children[0].icon}')"
check "design-part: other instances of the component are untouched" '"Default"' \
  "$(part screen | jq -c '.children[2].children[1].content')"
part missing >/dev/null 2>&1; check "design-part: an absent id is an error" "nonzero" "$([ $? -ne 0 ] && echo nonzero || echo zero)"

# --- check-runs.sh, replayed against the API ----------------------------------------
# c113cac1 (#136) has 121 check runs; `Agent review` is on page 3 of 30. Its
# conclusion there is `failure` (review run 36472313007).
if gh auth status >/dev/null 2>&1 || [ -n "${GH_TOKEN:-}" ]; then
  export REPO=Viktor-Jensen-Torp/gh-aw-spike-target
  SHA=c113cac1b5a9782fea5d543ef6e63594ac787791
  check "replay c113cac1: Agent review past the first page" "failure" \
    "$(bash "$SCRIPTS/check-runs.sh" latest "$SHA" "Agent review" gh-aw-spike-reviewer)"
  check "replay c113cac1: another app's check is not it"   "" \
    "$(bash "$SCRIPTS/check-runs.sh" latest "$SHA" "Agent review" someone-else)"
  check "replay c113cac1: failing counts only the names given" "0 1" \
    "$(bash "$SCRIPTS/check-runs.sh" failing "$SHA" test lint conventions) $(bash "$SCRIPTS/check-runs.sh" failing "$SHA" "Agent review")"
else
  echo "SKIP  check-runs.sh replays: gh is not signed in"
fi

echo
[ "$fails" -eq 0 ] && echo "all passed" || echo "$fails failed"
exit "$((fails > 0))"
