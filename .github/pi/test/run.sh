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
# Not a CI test on purpose: `node --test` in this repo is the product's suite,
# and this file is pipeline tooling.

set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
EXT="$HERE/../postconditions.cjs"
FIX="$HERE/fixtures"
BASE="$(mktemp -d "${TMPDIR:-/tmp}/postconditions-test.XXXX")"
trap 'rm -rf "$BASE"' EXIT
fails=0

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
  wrapped=$(PI_ROLE="${ROLE:-review}" PI_VERIFY_SCRIPT="$ROOT/verify.sh" PI_POSTCONDITIONS_STATE_DIR="$ROOT/state" CMD="$cmd" node -e '
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

echo "== review and check must agree, either order"
new_root
case_ "submit COMMENT"                                 pass  'echo "{\"event\":\"COMMENT\",\"body\":\"ok\"}" | safeoutputs submit_pull_request_review .'
case_ "then check failure (disagrees)"                 block 'echo "{\"conclusion\":\"failure\",\"title\":\"t\",\"summary\":\"s\"}" | safeoutputs create_check_run .'
case_ "then check success (agrees)"                    pass  'echo "{\"conclusion\":\"success\",\"title\":\"t\",\"summary\":\"s\"}" | safeoutputs create_check_run .'
case_ "second check run refused (first one counts)"    block 'echo "{\"conclusion\":\"success\",\"title\":\"t\",\"summary\":\"s\"}" | safeoutputs create_check_run .'
new_root
case_ "check failure first"                            pass  'echo "{\"conclusion\":\"failure\",\"title\":\"t\",\"summary\":\"s\"}" | safeoutputs create_check_run .'
case_ "then submit COMMENT (disagrees)"                block 'echo "{\"event\":\"COMMENT\",\"body\":\"x\"}" | safeoutputs submit_pull_request_review .'

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
WS="$(git -C "$HERE" rev-parse --show-toplevel)"
GITHUB_WORKSPACE="$WS" ROLE=implement case_ "called from another directory" pass "cd / && $PR"
[ "$(cat "$ROOT/verify.cwd")" = "$WS" ] \
  && echo "PASS  verify runs from the repository root, not the command's directory" \
  || { echo "FAIL  verify ran in $(cat "$ROOT/verify.cwd")"; fails=$((fails + 1)); }
new_root   # no verify.sh written: the script is missing
ROLE=implement case_ "missing verify script fails open (CI is the gate)" pass "$PR"
grep -q "not found; pushing without" "$ROOT/last_err" && echo "PASS  missing script is logged" || { echo "FAIL  missing script not logged"; fails=$((fails + 1)); }

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
out=$(GH_AW_PHASE=evals PI_ROLE=review node -e 'let n=0; require(process.argv[1])({ on: () => n++ }); console.log(n)' "$EXT" 2>/dev/null)
[ "$out" = "0" ] && echo "PASS  does nothing in the evals phase" || { echo "FAIL  evals registered $out handlers"; fails=$((fails + 1)); }

echo
echo "failures: $fails"
[ $fails -eq 0 ]
