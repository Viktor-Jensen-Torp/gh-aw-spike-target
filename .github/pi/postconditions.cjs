// @ts-check
"use strict";

/**
 * Role postconditions for Pi agents running under gh-aw.
 *
 * Installed by a pre-agent step to $PI_CODING_AGENT_DIR/extensions/postconditions.js,
 * where Pi auto-loads it. Not via `engine.args --extension`: gh-aw also passes
 * those to the evals job, which has no checkout, and Pi exits 1 on a missing
 * extension file. gh-aw restores `.github/` from the base branch before the
 * pre-agent steps run (restore_base_github_folders.sh), so the installed copy is
 * never the pull request's.
 *
 * Two jobs, for two different failure modes:
 *
 * 1. GUARD (tool_call). gh-aw keeps only the FIRST review an agent submits per
 *    run (submit_pr_review.cjs) and silently turns a missing `event` into
 *    COMMENT, which does not block a merge. On run 35598277469 the agent wrote
 *    "REQUEST_CHANGES" in the review text and piped `{body: .}` from jq, with no
 *    event. A nudge afterwards cannot help, because a corrected resubmission is
 *    dropped. So the bad call has to be stopped before it reaches safeoutputs.
 *
 *    The agent builds payloads at runtime (heredocs, `jq ... | safeoutputs x .`),
 *    so the command text cannot be pattern-matched. Instead every bash command is
 *    prefixed with a `safeoutputs` shell function that sees the real, final
 *    payload, validates it with jq, and either passes it to the real binary
 *    (`command safeoutputs`) or fails with a message the agent can act on.
 *
 * 2. POSTCONDITION (agent_end). If the agent stops without calling a required
 *    safe output, queue a follow-up naming what is missing. Pi continues the run
 *    for follow-ups queued in agent_end (agent-session.js _handlePostAgentRun).
 *    Capped, so a confused agent cannot loop.
 *
 * Configuration: PI_ROLE (review | implement | rework), set via engine.env.
 * Unknown or missing role: the extension logs and does nothing.
 */

const fs = require("fs");

const MAX_NUDGES = 2;
// Overridable only so the guard can be tested off-runner; /tmp/gh-aw is rw in the agent container.
const STATE_DIR = process.env.PI_POSTCONDITIONS_STATE_DIR || "/tmp/gh-aw/postconditions";
const CALLED_LOG = `${STATE_DIR}/called`;

/**
 * required: each inner array is "any of these".
 * checks:   per-tool payload rules enforced by the shell guard.
 */
const ROLES = {
  review: {
    required: [["submit_pull_request_review"], ["create_check_run"]],
    checks: {
      submit_pull_request_review: { field: "event", allowed: ["COMMENT", "REQUEST_CHANGES"], upper: true },
      create_check_run: { field: "conclusion", allowed: ["success", "failure"], upper: false },
    },
  },
  implement: {
    required: [["create_pull_request", "noop", "report_incomplete", "missing_tool", "missing_data"]],
    checks: {},
  },
  rework: {
    required: [["push_to_pull_request_branch", "noop", "report_incomplete", "missing_tool", "missing_data"]],
    checks: {},
  },
};

/** Why each required output matters, in the agent's terms. */
const WHY = {
  submit_pull_request_review: "Without it no review is posted and the pull request is neither blocked nor passed.",
  create_check_run: "The `Agent review` check is what gates the merge and starts rework; without it the pipeline cannot act on your verdict.",
  create_pull_request: "Without it your work never leaves this run.",
  push_to_pull_request_branch: "Without it your fix never reaches the pull request.",
};

/** @param {string} msg */
function log(msg) {
  process.stderr.write(`[spike/postconditions] ${msg}\n`);
}

/**
 * The shell guard. Defined as a function in the same shell as the agent's
 * command, so it shadows the `safeoutputs` binary for that command only.
 * Consistency between the review event and the check conclusion is checked in
 * both directions, whichever the agent calls first.
 *
 * @param {Record<string, {field: string, allowed: string[], upper: boolean}>} checks
 */
function buildGuard(checks) {
  const cases = Object.entries(checks)
    .map(([tool, rule]) => {
      const norm = rule.upper ? ` | tr '[:lower:]' '[:upper:]'` : "";
      const hint =
        tool === "submit_pull_request_review"
          ? ` gh-aw silently treats a missing event as COMMENT, which does not block the merge, and keeps only the FIRST review you submit. Put "event" in the JSON or pass --event.`
          : "";
      return `    ${tool})
      __v=$(printf '%s' "$__payload" | jq -r '.${rule.field} // empty' 2>/dev/null${norm})
      [ -z "$__v" ] && __v=$(__pc_flag "${rule.field}" "$@"${norm})
      case " ${rule.allowed.join(" ")} " in
        *" $__v "*) __rec="${STATE_DIR}/${tool}.${rule.field}"; __val="$__v" ;;
        *) echo "BLOCKED by the pipeline: ${tool} needs ${rule.field} set to one of: ${rule.allowed.join(", ")} (got: \${__v:-nothing}).${hint} Nothing was submitted; call it again." >&2
           return 2 ;;
      esac ;;`;
    })
    .join("\n");

  // The review event and the check conclusion must say the same thing, whichever
  // is called first. Compared against what was actually submitted, never against
  // a value from a call that was blocked or failed.
  const consistency =
    checks.submit_pull_request_review && checks.create_check_run
      ? `
  __ev=""; __cc=""
  case "$1" in
    submit_pull_request_review) __ev="$__val"; __cc=$(cat "${STATE_DIR}/create_check_run.conclusion" 2>/dev/null || true) ;;
    create_check_run)           __cc="$__val"; __ev=$(cat "${STATE_DIR}/submit_pull_request_review.event" 2>/dev/null || true) ;;
  esac
  if [ -n "$__ev" ] && [ -n "$__cc" ]; then
    if { [ "$__ev" = "REQUEST_CHANGES" ] && [ "$__cc" != "failure" ]; } || { [ "$__ev" = "COMMENT" ] && [ "$__cc" != "success" ]; }; then
      echo "BLOCKED by the pipeline: the review event ($__ev) and the check conclusion ($__cc) disagree. REQUEST_CHANGES goes with failure, COMMENT with success. Nothing was submitted; call $1 again so it matches what you already submitted." >&2
      return 2
    fi
  fi`
      : "";

  return `mkdir -p ${STATE_DIR}
__pc_flag() { __f="$1"; shift; while [ $# -gt 0 ]; do case "$1" in --"$__f") printf '%s' "$2"; return;; --"$__f"=*) printf '%s' "\${1#*=}"; return;; esac; shift; done; }
safeoutputs() {
  __payload=""; __rec=""; __val=""
  if [ "$2" = "." ]; then __payload=$(cat); fi
  case "$1" in
${cases}
  esac${consistency}
  if [ "$2" = "." ]; then printf '%s' "$__payload" | command safeoutputs "$@"; else command safeoutputs "$@"; fi
  __rc=$?
  if [ $__rc -eq 0 ]; then
    [ -n "$__rec" ] && printf '%s' "$__val" > "$__rec"
    echo "$1" >> "${CALLED_LOG}"
  fi
  return $__rc
}
`;
}

/** Tools the agent has called successfully, from our log and from gh-aw's own record. */
function calledTools() {
  const called = new Set();
  try {
    for (const line of fs.readFileSync(CALLED_LOG, "utf8").split("\n")) if (line.trim()) called.add(line.trim());
  } catch {}
  const outputs = process.env.GH_AW_SAFE_OUTPUTS;
  if (outputs) {
    try {
      for (const line of fs.readFileSync(outputs, "utf8").split("\n")) {
        if (!line.trim()) continue;
        try {
          const item = JSON.parse(line);
          if (item && typeof item.type === "string") called.add(item.type);
        } catch {}
      }
    } catch {}
  }
  return called;
}

/** @param {any} pi */
function postconditions(pi) {
  // Only the agent run is governed. The evals job also runs Pi and must never be
  // told to submit a review; it should not have this file at all, but be sure.
  if (process.env.GH_AW_PHASE === "evals") {
    log("evals phase; doing nothing");
    return;
  }
  const role = (process.env.PI_ROLE || "").trim();
  const spec = ROLES[/** @type {keyof typeof ROLES} */ (role)];
  if (!spec) {
    log(`no role configured (PI_ROLE=${JSON.stringify(role)}); doing nothing`);
    return;
  }
  const guard = Object.keys(spec.checks).length > 0 ? buildGuard(spec.checks) : "";
  let nudges = 0;
  log(`role=${role} guards=[${Object.keys(spec.checks).join(",")}] required=${JSON.stringify(spec.required)}`);

  if (guard) {
    pi.on("tool_call", async (/** @type {any} */ event) => {
      if (event.toolName !== "bash" || typeof event.input?.command !== "string") return;
      if (!/\bsafeoutputs\b/.test(event.input.command)) return;
      event.input.command = `${guard}\n${event.input.command}`;
    });
  }

  pi.on("agent_end", async () => {
    const called = calledTools();
    const missing = spec.required.filter(group => !group.some(tool => called.has(tool)));
    if (missing.length === 0) {
      log(`postconditions met (called: ${[...called].join(", ") || "none"})`);
      return;
    }
    const names = missing.map(group => group.join(" or "));
    if (nudges >= MAX_NUDGES) {
      log(`postconditions NOT met after ${nudges} nudge(s); giving up. Missing: ${names.join("; ")}`);
      return;
    }
    nudges++;
    log(`nudge ${nudges}/${MAX_NUDGES}: missing ${names.join("; ")}`);
    const lines = missing.map(group => {
      const why = group.map(tool => WHY[/** @type {keyof typeof WHY} */ (tool)]).find(Boolean);
      return `- \`${group.join("` or `")}\`${why ? ` — ${why}` : ""}`;
    });
    pi.sendUserMessage(
      `You stopped before finishing. These required safe outputs have not been called yet:\n${lines.join("\n")}\n\nCall them now. If you genuinely cannot complete the task, call \`noop\` or \`report_incomplete\` with the reason instead.`,
      { deliverAs: "followUp" }
    );
  });
}

module.exports = postconditions;
module.exports.buildGuard = buildGuard;
module.exports.ROLES = ROLES;
