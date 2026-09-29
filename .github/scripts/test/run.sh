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
