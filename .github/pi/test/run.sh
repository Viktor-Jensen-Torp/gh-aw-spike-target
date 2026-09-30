#!/usr/bin/env bash
# Tests for ../postconditions.cjs, off-runner. Needs node, bash and jq.
#
#   bash .github/pi/test/run.sh
#
# The guard is exercised by replaying real safe-output commands captured from
# review runs (fixtures/, from runs 35556150590 and 35598277469) plus edge
# cases, each through the rewritten command against a fake `safeoutputs` that
# records what reached it. The agent_end nudge is exercised with a fake Pi API.
#
# Run in CI by pipeline-tests.yml, not by `node --test`: that is the product's suite,
# and this file is pipeline tooling.

set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
EXT="$HERE/../postconditions.cjs"
FIX="$HERE/fixtures"
BASE="$(mktemp -d "${TMPDIR:-/tmp}/postconditions-test.XXXX")"
trap 'rm -rf "$BASE"' EXIT
fails=0
# The commit-scope check reads the workspace's unpushed commits; by default the
# tests run against an empty folder, not this repository's own branch.
mkdir -p "$BASE/nogit"; export GITHUB_WORKSPACE="$BASE/nogit"

new_root() {
  ROOT="$(mktemp -d "$BASE/r.XXXX")"
  mkdir -p "$ROOT/bin" "$ROOT/calls" "$ROOT/gh-aw"
  cat > "$ROOT/bin/safeoutputs" <<'FAKE'
#!/usr/bin/env bash
d="$ROOT/calls"; n=$(ls "$d" | wc -l); f="$d/$((n+1))"; echo "ARGS: $*" > "$f"
if [ "$2" = "." ]; then cat >> "$f"; fi
exit "${FAKE_RC:-0}"
FAKE
  chmod +x "$ROOT/bin/safeoutputs"
  export ROOT
}

# case <label> <pass|block> <command>
case_() {
  local label="$1" want="$2" cmd="$3" wrapped err rc before after ok
  cmd="${cmd//\/tmp\/gh-aw/$ROOT/gh-aw}"
  wrapped=$(PI_ROLE="${ROLE:-review}" PI_VERIFY_SCRIPT="$ROOT/verify.sh" PI_CHECK_ISSUE_SCRIPT="${CHECK_ISSUE:-$ROOT/none.sh}" PI_REVIEW_ROWS_SCRIPT="${ROWS_SCRIPT:-$ROOT/none.sh}" PI_REQUIREMENTS="${REQS:-$ROOT/none.md}" PI_PR_META="${META:-$ROOT/none.json}" PI_REFINE_CANDIDATES="$ROOT/cands.json" PI_POSTCONDITIONS_STATE_DIR="$ROOT/state" CMD="$cmd" node -e '
    const h = {}; require(process.argv[1])({ on: (e, f) => (h[e] = f), sendUserMessage() {} });
    const ev = { toolName: "bash", input: { command: process.env.CMD } };
    h.tool_call(ev).then(() => process.stdout.write(ev.input.command));' "$EXT" 2>/dev/null)
  before=$(ls "$ROOT/calls" | wc -l)
  err=$(PATH="$ROOT/bin:$PATH" bash -c "$wrapped" 2>&1 >/dev/null); rc=$?
  after=$(ls "$ROOT/calls" | wc -l)
  printf '%s' "$err" > "$ROOT/last_err"
  if [ "$want" = pass ]; then [ $rc -eq 0 ] && [ $((after - before)) -eq 1 ] && ok=1 || ok=0
  else [ $rc -ne 0 ] && [ $((after - before)) -eq 0 ] && ok=1 || ok=0; fi
  printf '%s  %-55s want=%-5s rc=%s\n' "$([ $ok = 1 ] && echo PASS || echo FAIL)" "$label" "$want" "$rc"
  [ "$want" = block ] && echo "      agent sees: $(echo "$err" | grep BLOCKED | head -1 | cut -c1-110)"
  [ $ok = 1 ] || fails=$((fails + 1))
}
fixture() { case_ "$1" "$2" "$(cat "$FIX/$3")"; }

echo "== real commands, in the order the agents ran them"
new_root
fixture "good run: submit, heredoc JSON, event=REQUEST_CHANGES" pass good-submit-heredoc.sh
fixture "good run: check, heredoc JSON, conclusion=failure"    pass good-check-heredoc.sh
new_root
fixture "stalled run: jq '{body: .}' | submit (no event)"      block stalled-submit-jq-no-event.sh
fixture "check via jq --arg conclusion failure"                pass good-check-jq-args.sh

echo "== flags and edge cases"
new_root; case_ "--event request_changes (lowercase)" pass  'safeoutputs submit_pull_request_review --event request_changes --body "x"'
new_root; case_ "--event=COMMENT"                     pass  'safeoutputs submit_pull_request_review --event=COMMENT --body x'
new_root; case_ "body only, no event"                 block 'safeoutputs submit_pull_request_review --body x'
new_root; case_ "event APPROVE (not allowed)"         block 'echo "{\"event\":\"APPROVE\",\"body\":\"x\"}" | safeoutputs submit_pull_request_review .'
new_root; case_ "check run without conclusion"        block 'echo "{\"title\":\"t\",\"summary\":\"s\"}" | safeoutputs create_check_run .'
# Replay: review run 36675018713, call 58: an unescaped quote inside summary.
new_root; case_ "invalid JSON (unescaped quote)"      block $'cat > /tmp/p.json <<\'EOF\'\n{"conclusion": "failure", "summary": "requires "asChild" here"}\nEOF\ncat /tmp/p.json | safeoutputs create_check_run .'
grep -q "not valid JSON" "$ROOT/last_err" && echo "PASS  it says the JSON is invalid, not that the conclusion is missing" || { echo "FAIL  invalid JSON reported as: $(cat "$ROOT/last_err" | head -1)"; fails=$((fails + 1)); }

echo "== review and check must agree, either order"
new_root
case_ "submit COMMENT"                                 pass  'echo "{\"event\":\"COMMENT\",\"body\":\"ok\"}" | safeoutputs submit_pull_request_review .'
case_ "then check failure (disagrees)"                 block 'echo "{\"conclusion\":\"failure\",\"title\":\"t\",\"summary\":\"s\"}" | safeoutputs create_check_run .'
case_ "then check success (agrees)"                    pass  'echo "{\"conclusion\":\"success\",\"title\":\"t\",\"summary\":\"s\"}" | safeoutputs create_check_run .'
case_ "second check run refused (first one counts)"    block 'echo "{\"conclusion\":\"success\",\"title\":\"t\",\"summary\":\"s\"}" | safeoutputs create_check_run .'
new_root
case_ "check failure first"                            pass  'echo "{\"conclusion\":\"failure\",\"title\":\"t\",\"summary\":\"s\"}" | safeoutputs create_check_run .'
case_ "then submit COMMENT (disagrees)"                block 'echo "{\"event\":\"COMMENT\",\"body\":\"x\"}" | safeoutputs submit_pull_request_review .'

echo "== refine replaces an issue body, never appends"
new_root
ROLE=refine case_ "body without operation (gh-aw appends)"    block 'echo "{\"issue_number\":1,\"body\":\"x\"}" | safeoutputs update_issue .'
ROLE=refine case_ "body with operation append"                block 'echo "{\"issue_number\":1,\"body\":\"x\",\"operation\":\"append\"}" | safeoutputs update_issue .'
ROLE=refine case_ "body with operation replace"               pass  'echo "{\"issue_number\":1,\"body\":\"x\",\"operation\":\"replace\"}" | safeoutputs update_issue .'
ROLE=refine case_ "second issue in the same run"              pass  'echo "{\"issue_number\":2,\"body\":\"y\",\"operation\":\"replace\"}" | safeoutputs update_issue .'
ROLE=refine case_ "title only needs no operation"             pass  'echo "{\"issue_number\":3,\"title\":\"t\"}" | safeoutputs update_issue .'
ROLE=refine case_ "--body with --operation replace"           pass  'safeoutputs update_issue --issue_number 4 --body x --operation replace'

echo "== refine writes bodies in the template's shape (check-issue.sh)"
REPO_ROOT="$(cd "$HERE/../../.." && pwd)"
GOOD=$(jq -Rs . <<'B'
## What
x
## Why
y
## Details
z
## Done when
| Given | Expect |
|---|---|
| a | b |
## Out of scope
Nothing nearby.
B
)
BAD=$(jq -Rs . <<'B'
## What
x
## Done when
it works
B
)
new_root; printf '[{"number":7,"type":"Task"},{"number":81,"type":"Epic"}]' > "$ROOT/cands.json"
export GITHUB_WORKSPACE="$REPO_ROOT"
CHECK_ISSUE="$REPO_ROOT/.github/scripts/check-issue.sh" ROLE=refine case_ "work item in the template's shape"   pass  "echo '{\"issue_number\":7,\"operation\":\"replace\",\"body\":'\"\$(printf '%s' '$GOOD')\"'}' | safeoutputs update_issue ."
CHECK_ISSUE="$REPO_ROOT/.github/scripts/check-issue.sh" ROLE=refine case_ "work item missing Why, Details, a table" block "echo '{\"issue_number\":7,\"operation\":\"replace\",\"body\":'\"\$(printf '%s' '$BAD')\"'}' | safeoutputs update_issue ."
CHECK_ISSUE="$REPO_ROOT/.github/scripts/check-issue.sh" ROLE=refine case_ "an epic is checked against epic.md"   block "echo '{\"issue_number\":81,\"operation\":\"replace\",\"body\":'\"\$(printf '%s' '$GOOD')\"'}' | safeoutputs update_issue ."
CHECK_ISSUE="$REPO_ROOT/.github/scripts/check-issue.sh" ROLE=refine case_ "title only is not checked"            pass  'echo "{\"issue_number\":7,\"title\":\"t\"}" | safeoutputs update_issue .'
export GITHUB_WORKSPACE="$BASE/nogit"

echo "== pass-through"
new_root
case_ "unguarded tool keeps its stdin payload"         pass  'echo "{\"path\":\"a.js\",\"line\":1,\"body\":\"b\"}" | safeoutputs create_pull_request_review_comment .'
grep -q '"path":"a.js"' "$ROOT/calls/1" && echo "PASS  payload reached safeoutputs intact" || { echo "FAIL  payload lost"; fails=$((fails + 1)); }
new_root
case_ "safeoutputs --help"                             pass  'safeoutputs --help'
[ ! -s "$ROOT/state/called" ] && echo "PASS  --help is not recorded as a called tool" || { echo "FAIL  --help recorded"; fails=$((fails + 1)); }
new_root
# The real binary failing is expected to fail the call; only the recorded state matters here.
( FAKE_RC=1 case_ "real binary fails" pass 'echo "{\"event\":\"COMMENT\",\"body\":\"x\"}" | safeoutputs submit_pull_request_review .' >/dev/null )
[ ! -f "$ROOT/state/submit_pull_request_review.event" ] && echo "PASS  no state recorded after a failed submit" || { echo "FAIL  state after failure"; fails=$((fails + 1)); }

echo "== pre-push verify (code-writing roles)"
# A fake verify.sh: red while $ROOT/red exists, and counts how often it ran.
fake_verify() {
  cat > "$ROOT/verify.sh" <<'V'
#!/usr/bin/env bash
echo run >> "$ROOT/verify.runs"
pwd > "$ROOT/verify.cwd"
if [ -f "$ROOT/red" ]; then echo "✗ test: unique rejects strings — expected TypeError"; exit 1; fi
echo "✓ verify: all checks passed"
V
}
PR='echo "{\"title\":\"t\",\"body\":\"b\",\"branch\":\"x\"}" | safeoutputs create_pull_request .'
PUSH='echo "{\"message\":\"m\"}" | safeoutputs push_to_pull_request_branch .'
new_root; fake_verify; touch "$ROOT/red"
ROLE=implement case_ "red checks: create_pull_request refused (1 of 3)" block "$PR"
ROLE=implement case_ "still red: refused again (2 of 3)"               block "$PR"
rm "$ROOT/red"
ROLE=implement case_ "fixed: the same call now goes through"          pass  "$PR"
new_root; fake_verify; touch "$ROOT/red"
ROLE=implement case_ "cap: red 1"                                      block "$PR"
ROLE=implement case_ "cap: red 2"                                      block "$PR"
ROLE=implement case_ "cap: red 3 -> told to report_incomplete"        block "$PR"
grep -q "Stop trying: call report_incomplete" "$ROOT/last_err" && grep -q "expected TypeError" "$ROOT/last_err" \
  && echo "PASS  third refusal says report_incomplete and shows the failing check" \
  || { echo "FAIL  third refusal message: $(head -c 200 "$ROOT/last_err")"; fails=$((fails + 1)); }
rm "$ROOT/red"
ROLE=implement case_ "after the cap, even green is refused"           block "$PR"
[ "$(wc -l < "$ROOT/verify.runs")" -eq 3 ] && echo "PASS  verify not re-run once the cap is reached" || { echo "FAIL  verify ran $(wc -l < "$ROOT/verify.runs") times"; fails=$((fails + 1)); }
new_root; fake_verify; touch "$ROOT/red"
ROLE=rework  case_ "rework: red push refused"                         block "$PUSH"
ROLE=unblock case_ "unblock: red push refused"                        block "$PUSH"
ROLE=implement case_ "--help is not checked"                          pass  'safeoutputs create_pull_request --help'
ROLE=implement case_ "other tools are not checked"                    pass  'echo "{\"reason\":\"r\"}" | safeoutputs noop .'
ROLE=review  case_ "review role: no pre-push check"                   pass  "$PR"
new_root; fake_verify; touch "$ROOT/red"
for i in 1 2; do ROLE=unblock case_ "unblock red $i" block "$PUSH" >/dev/null; done
ROLE=unblock case_ "unblock red 3 -> told to escalate (Step 4)"      block "$PUSH"
grep -q "Stop trying: escalate as in Step 4: add_labels needs-human" "$ROOT/last_err" \
  && echo "PASS  unblock gives up its own way, not report_incomplete" \
  || { echo "FAIL  unblock give-up message: $(head -c 200 "$ROOT/last_err")"; fails=$((fails + 1)); }
new_root; fake_verify
git init -q "$BASE/wsroot"; WS="$(cd "$BASE/wsroot" && pwd -P)"
GITHUB_WORKSPACE="$WS" ROLE=implement case_ "called from another directory" pass "cd / && $PR"
[ "$(cat "$ROOT/verify.cwd")" = "$WS" ] \
  && echo "PASS  verify runs from the repository root, not the command's directory" \
  || { echo "FAIL  verify ran in $(cat "$ROOT/verify.cwd")"; fails=$((fails + 1)); }
new_root   # no verify.sh written: the script is missing
ROLE=implement case_ "missing verify script fails open (CI is the gate)" pass "$PR"
grep -q "not found; pushing without" "$ROOT/last_err" && echo "PASS  missing script is logged" || { echo "FAIL  missing script not logged"; fails=$((fails + 1)); }

echo "== implement links its issue (dispatched runs get no automatic Fixes #N)"
new_root; fake_verify
link() { printf 'echo %q | safeoutputs create_pull_request .' "{\"title\":\"t\",\"branch\":\"x\",\"body\":\"$1\"}"; }
PI_ISSUE=125 ROLE=implement case_ "no Fixes line: refused before verify"   block "$(link 'Builds the button.')"
[ ! -f "$ROOT/verify.runs" ] && echo "PASS  refused link cost no verify run" || { echo "FAIL  verify ran for a refused link"; fails=$((fails+1)); }
PI_ISSUE=125 ROLE=implement case_ "another issue's number: refused"       block "$(link 'Fixes #1250')"
PI_ISSUE=125 ROLE=implement case_ "Fixes #125 goes through"               pass  "$(link 'Builds it.\n\n- Fixes #125')"
new_root; fake_verify
PI_ISSUE=125 ROLE=implement case_ "closes #125, any case"                 pass  "$(link 'closes #125.')"
PI_ISSUE=""  ROLE=implement case_ "no PI_ISSUE (a person's run): not checked" pass "$(link 'x')"
PI_ISSUE=125 ROLE=rework    case_ "rework pushes are not checked"         pass  "$PUSH"

echo "== commits stay inside the role's paths (rework run 36601234520 committed a browser)"
SCOPE="$BASE/scope"; git init -q --bare "$SCOPE/origin.git"
git clone -q "$SCOPE/origin.git" "$SCOPE/ws" 2>/dev/null
( cd "$SCOPE/ws" && git config user.email t@t && git config user.name t && mkdir -p apps/web && echo a > apps/web/a.ts \
  && git add . && git commit -qm base && git push -q origin HEAD:main ) >/dev/null 2>&1
in_ws() { (cd "$SCOPE/ws" && "$@") >/dev/null 2>&1; }
new_root; fake_verify
in_ws sh -c 'echo b >> apps/web/a.ts && git add -A && git commit -qm fix'
GITHUB_WORKSPACE="$SCOPE/ws" ROLE=rework case_ "only apps/ changed: goes through"            pass  "$PUSH"
in_ws sh -c 'mkdir -p .github x/y && echo c > .github/ci.yml && echo d > "x/y/chrome" && git add -A && git commit -qm sweep'
new_root; fake_verify
GITHUB_WORKSPACE="$SCOPE/ws" ROLE=rework case_ ".github/ and a stray folder: refused"      block "$PUSH"
grep -q "  .github/ci.yml" "$ROOT/last_err" && grep -q "git reset " "$ROOT/last_err" && echo "PASS  the agent is told which files, and how to undo" || { echo "FAIL  refusal lacks files or reset"; fails=$((fails+1)); }
[ ! -f "$ROOT/verify.runs" ] && echo "PASS  refused before verify ran" || { echo "FAIL  verify ran for an out-of-scope commit"; fails=$((fails+1)); }
new_root; fake_verify
GITHUB_WORKSPACE="$SCOPE/ws" ROLE=review  case_ "review role: not checked"                  pass  "$PUSH"

echo "== review rows are refused in the form the routing would refuse them"
REPO_ROOT="$(cd "$HERE/../../.." && pwd)"
export ROWS_SCRIPT="$REPO_ROOT/.github/scripts/review-rows.sh" REQS="$REPO_ROOT/.github/conventions/chain/requirements/component.md" META="$FIX/pr-meta-136.json"
submit() { printf 'echo %q | safeoutputs submit_pull_request_review .' "{\"event\":\"$1\",\"body\":\"b\",\"data\":$2}"; }
# Replay: review run 36598205345 on #136 cited "Button.stories.tsx" for U1-U3.
REPLAY=$(cat "$FIX/review-136-55930b3.json")
new_root; case_ "replay #136: U1-U3 without a full path refused" block "$(submit REQUEST_CHANGES "$REPLAY")"
grep -q "U1: met-without-a-changed-file" "$ROOT/last_err" && echo "PASS  the agent is told which rows" || { echo "FAIL  the agent is not told which rows"; fails=$((fails+1)); }
FIXED=$(jq -c '.requirements |= map(if (.id == "U1" or .id == "U2" or .id == "U3") then .evidence = "apps/web/src/components/Button/Button.stories.tsx:16" else . end)
  + [{"id": "U7", "status": "met", "evidence": "apps/web/src/components/Button/Button.stories.tsx:16"}]' <<<"$REPLAY")
new_root; case_ "same review with full paths goes through"   pass  "$(submit REQUEST_CHANGES "$FIXED")"
new_root; case_ "no data at all is refused"                  block 'echo "{\"event\":\"COMMENT\",\"body\":\"b\"}" | safeoutputs submit_pull_request_review .'
new_root; case_ "a row left out is refused"                  block "$(submit REQUEST_CHANGES "$(jq -c '.requirements |= map(select(.id != "U2"))' <<<"$FIXED")")"
# Replay: review run 36675018713, call 56: data sent as a bare list.
new_root; case_ "data as a bare list, not {requirements}"  block "$(submit REQUEST_CHANGES "$(jq -c '.requirements' <<<"$FIXED")")"
grep -q "data must be an object" "$ROOT/last_err" && echo "PASS  it names the shape data needs" || { echo "FAIL  bare list reported as: $(head -1 "$ROOT/last_err")"; fails=$((fails + 1)); }
new_root; case_ "n/a on a row that does not allow it"        block "$(submit REQUEST_CHANGES "$(jq -c '.requirements |= map(if .id == "U1" then .status = "n/a" else . end)' <<<"$FIXED")")"
new_root; REQS="$ROOT/none.md" case_ "no requirements file (a person's PR): not checked" pass 'echo "{\"event\":\"COMMENT\",\"body\":\"b\"}" | safeoutputs submit_pull_request_review .'
unset ROWS_SCRIPT REQS META

echo "== agent_end nudge"
new_root
out=$(PI_ROLE=review PI_POSTCONDITIONS_STATE_DIR="$ROOT/state" GH_AW_SAFE_OUTPUTS="$ROOT/outputs.jsonl" node -e '
  const fs = require("fs"), T = process.env.PI_POSTCONDITIONS_STATE_DIR;
  const h = {}, sent = []; fs.mkdirSync(T, { recursive: true });
  require(process.argv[1])({ on: (e, f) => (h[e] = f), sendUserMessage: (m, o) => sent.push(o) });
  (async () => {
    fs.writeFileSync(T + "/called", "submit_pull_request_review\n");
    for (let i = 0; i < 3; i++) await h.agent_end({});
    const capped = sent.length;
    fs.writeFileSync(process.env.GH_AW_SAFE_OUTPUTS, JSON.stringify({ type: "create_check_run" }) + "\n");
    await h.agent_end({});
    console.log(`${capped} ${sent.length} ${sent[0] && sent[0].deliverAs}`);
  })();' "$EXT" 2>/dev/null)
[ "$out" = "2 2 followUp" ] && echo "PASS  two follow-up nudges, then gives up; gh-aw's own record counts" || { echo "FAIL  nudge: got '$out'"; fails=$((fails + 1)); }
# refine: every candidate ends with a stage label. $1 = candidates JSON, $2 = outputs (one per line).
refine_end() {
  new_root; printf '%s' "$1" > "$ROOT/cands.json"; printf '%s\n' "$2" > "$ROOT/outputs.jsonl"
  PI_ROLE=refine PI_REFINE_CANDIDATES="$ROOT/cands.json" PI_POSTCONDITIONS_STATE_DIR="$ROOT/state" \
    GH_AW_SAFE_OUTPUTS="$ROOT/outputs.jsonl" node -e '
    const h = {}, sent = []; require("fs").mkdirSync(process.env.PI_POSTCONDITIONS_STATE_DIR, { recursive: true });
    require(process.argv[1])({ on: (e, f) => (h[e] = f), sendUserMessage: m => sent.push(m) });
    h.agent_end({}).then(() => console.log(sent.length ? sent[0].match(/a stage for [#0-9, ]+/)?.[0] || "nudged" : "none"));' "$EXT" 2>/dev/null
}
out=$(refine_end '[{"number":64}]' '{"type":"set_issue_type","issue_number":64}
{"type":"add_labels","labels":["bug"]}
{"type":"noop","message":"done"}')
[ "$out" = "a stage for #64" ] && echo "PASS  refine: run 36266779049 replayed (type, bug, noop, no stage) is nudged" || { echo "FAIL  refine #64 replay: '$out'"; fails=$((fails + 1)); }
out=$(refine_end '[{"number":64}]' '{"type":"add_labels","labels":["bug","refined"]}')
[ "$out" = "none" ] && echo "PASS  refine: one candidate, refined without a number counts" || { echo "FAIL  refine single refined: '$out'"; fails=$((fails + 1)); }
out=$(refine_end '[{"number":64}]' '{"type":"add_labels","item_number":64,"labels":["ready"]}')
[ "$out" = "a stage for #64" ] && echo "PASS  refine: ready is a person's label and decides nothing" || { echo "FAIL  refine ready: '$out'"; fails=$((fails + 1)); }
out=$(refine_end '[{"number":1},{"number":2}]' '{"type":"add_labels","item_number":1,"labels":["needs-shape"]}
{"type":"add_labels","labels":["refined"]}')
[ "$out" = "a stage for #2" ] && echo "PASS  refine: two candidates, an unnumbered label decides neither" || { echo "FAIL  refine two: '$out'"; fails=$((fails + 1)); }
out=$(refine_end '[{"number":81,"type":"Epic"},{"number":82,"type":"Task"}]' '{"type":"add_labels","item_number":82,"labels":["refined"]}')
[ "$out" = "none" ] && echo "PASS  refine: an epic needs no stage" || { echo "FAIL  refine epic: '$out'"; fails=$((fails + 1)); }
out=$(refine_end '[]' '{"type":"noop","message":"quiet night"}')
[ "$out" = "none" ] && echo "PASS  refine: no candidates, noop is enough" || { echo "FAIL  refine quiet: '$out'"; fails=$((fails + 1)); }

# Kill by name is refused in every role, before it runs (review run 36465779257).
blocked() { PI_ROLE="$1" PI_POSTCONDITIONS_STATE_DIR="$BASE/k" CMD="$2" node -e '
  const h = {}; require(process.argv[1])({ on: (e, f) => (h[e] = f), sendUserMessage() {} });
  h.tool_call({ toolName: "bash", input: { command: process.env.CMD } }).then(r => console.log(r && r.block ? "blocked" : "allowed"));' "$EXT" 2>/dev/null; }
for role in review implement rework refine unblock; do
  [ "$(blocked $role "pkill -f 'vite|storybook|npm' || true")" = blocked ] \
    && echo "PASS  $role: the run-36465779257 command is refused" || { echo "FAIL  $role: pkill allowed"; fails=$((fails + 1)); }
done
[ "$(blocked review 'kill "$(cat /tmp/app.pid)"')" = allowed ] && echo "PASS  kill by saved pid is allowed" || { echo "FAIL  kill by pid blocked"; fails=$((fails + 1)); }
[ "$(blocked review 'kill $(pgrep -f vite)')" = blocked ] && echo "PASS  kill \$(pgrep ...) is refused" || { echo "FAIL  pgrep allowed"; fails=$((fails + 1)); }

# Sweeping adds are refused for the code-writing roles (rework run 36601234520).
for c in "git add -A" "git add . && git commit -m x" "cd /w && git add --all" "git commit -am x" "git commit -m x --all"; do
  [ "$(blocked rework "$c")" = blocked ] && echo "PASS  rework refuses: $c" || { echo "FAIL  rework allowed: $c"; fails=$((fails + 1)); }
done
for c in "git add apps/web/a.ts" "git add ./apps/web" "git commit -m 'fix a thing'" "git commit --amend --no-edit"; do
  [ "$(blocked rework "$c")" = allowed ] && echo "PASS  rework allows: $c" || { echo "FAIL  rework refused: $c"; fails=$((fails + 1)); }
done
[ "$(blocked review "git add -A")" = allowed ] && echo "PASS  review: a sweeping add is not its business" || { echo "FAIL  review refused git add -A"; fails=$((fails + 1)); }

# The fixed rules reach the system prompt, for every role, after what Pi has.
sysprompt() { PI_ROLE="$1" PI_POSTCONDITIONS_STATE_DIR="$BASE/k" node -e '
  const h = {}; require(process.argv[1])({ on: (e, f) => (h[e] = f), sendUserMessage() {} });
  h.before_agent_start({ systemPrompt: "PI-BASE" }).then(r => console.log(r.systemPrompt));' "$EXT" 2>/dev/null; }
for role in implement rework review refine unblock relate release; do
  S=$(sysprompt $role)
  { [[ "$S" == PI-BASE* ]] && grep -q "aw-prompts/prompt.txt" <<<"$S" && grep -q "Pipeline rules" <<<"$S"; } \
    && echo "PASS  $role: rules appended to the system prompt" || { echo "FAIL  $role system prompt: ${S:0:80}"; fails=$((fails + 1)); }
done
grep -q "never \`git add -A\`" <<<"$(sysprompt rework)" && echo "PASS  rework is told how to commit" || { echo "FAIL  rework rule missing"; fails=$((fails + 1)); }
grep -q "full path" <<<"$(sysprompt review)" && echo "PASS  review is told the evidence rule" || { echo "FAIL  review rule missing"; fails=$((fails + 1)); }

# Advice is added to a failing tool's result at that moment, and nowhere else.
advised() { PI_ROLE="$1" PI_POSTCONDITIONS_STATE_DIR="$BASE/k" CMD="$2" OUT="$3" ERR="$4" node -e '
  const h = {}; require(process.argv[1])({ on: (e, f) => (h[e] = f), sendUserMessage() {} });
  h.tool_result({ toolName: "bash", input: { command: process.env.CMD }, isError: process.env.ERR === "1",
                  content: [{ type: "text", text: process.env.OUT }] })
   .then(r => console.log(r ? r.content.map(c => c.text).join("|") : "unchanged"));' "$EXT" 2>/dev/null; }
grep -q "verify.sh failed" <<<"$(advised rework "bash .github/scripts/verify.sh" "✗ test" 1)" && echo "PASS  advice after a failed verify.sh" || { echo "FAIL  no advice after verify"; fails=$((fails + 1)); }
# Replay: refine run 36561914371, set_issue_field with the wrong fields.
grep -q "safeoutputs <tool> --help" <<<"$(advised refine 'cat <<EOF | safeoutputs set_issue_field .' "Invalid arguments: unknown parameters 'field', 'item_number' (closest: 'issue_number', 'field_name')" 1)" \
  && echo "PASS  replay refine 36561914371: advice after refused fields" || { echo "FAIL  no advice after refused fields"; fails=$((fails + 1)); }
[ "$(advised rework "bash .github/scripts/verify.sh" "✓ all passed" 0)" = unchanged ] && echo "PASS  a passing verify.sh gets no advice" || { echo "FAIL  advice on success"; fails=$((fails + 1)); }
[ "$(advised rework "ls /nope" "No such file" 1)" = unchanged ] && echo "PASS  other failures get no advice" || { echo "FAIL  advice on unrelated failure"; fails=$((fails + 1)); }

# Item 12: once every required output is in, the result says to finish; not before.
rm -rf "$BASE/k"; mkdir -p "$BASE/k"
[ "$(advised review 'echo x | safeoutputs submit_pull_request_review .' ok 0)" = unchanged ] && echo "PASS  review: nothing said while the check run is still missing" || { echo "FAIL  finish advice too early"; fails=$((fails + 1)); }
printf 'submit_pull_request_review\ncreate_check_run\n' > "$BASE/k/called"
grep -q "Your task is done" <<<"$(advised review 'echo x | safeoutputs create_check_run .' ok 0)" && echo "PASS  review: told to finish once both outputs are in" || { echo "FAIL  no finish advice"; fails=$((fails + 1)); }
[ "$(advised refine 'echo x | safeoutputs add_labels .' ok 0)" = unchanged ] && echo "PASS  refine is never told to finish (it decides many issues)" || { echo "FAIL  refine told to finish"; fails=$((fails + 1)); }

out=$(GH_AW_PHASE=evals PI_ROLE=review node -e 'let n=0; require(process.argv[1])({ on: () => n++ }); console.log(n)' "$EXT" 2>/dev/null)
[ "$out" = "0" ] && echo "PASS  does nothing in the evals phase" || { echo "FAIL  evals registered $out handlers"; fails=$((fails + 1)); }

echo
echo "failures: $fails"
[ $fails -eq 0 ]
