#!/usr/bin/env python3
"""Collect one week's factory metrics into a single history row.

Deterministic on purpose. A report about what the agents cost must not itself
cost agent credits, or the observer inflates the thing it observes — the
reviewer alone was 155 AIC over the first 94 runs. Same reasoning as
sweeper.yml: no judgement is needed here, only arithmetic.

Reads:  gh aw logs --json      (per-run aic / tokens / actions minutes)
        gh aw health --json    (per-workflow success rate)
        gh aw outcomes --json  (did the safe output survive in the repository)
Writes: metrics/history.jsonl  one row per collection, appended
        metrics/pending.json   run ids still carrying pending outcome items
        a markdown report on stdout

Outcomes are explicitly a snapshot: an item is `pending` until the repository
says otherwise, so every run scored before is re-scored while anything in it is
still pending. Without that the acceptance rate is permanently understated.
"""

import json
import os
import subprocess
import sys
from collections import Counter, defaultdict
from datetime import datetime, timedelta, timezone

REPO = os.environ.get("REPO") or ""
WINDOW_DAYS = int(os.environ.get("WINDOW_DAYS", "7"))
HISTORY = "metrics/history.jsonl"
PENDING = "metrics/pending.json"
# Cap the per-run outcome scoring: `gh aw outcomes` downloads each run's
# artifacts, so an unbounded set turns a report into a half-hour job.
MAX_SCORED = int(os.environ.get("MAX_SCORED", "60"))


def sh(args, timeout=600):
    """Run a command, returning (ok, stdout). Never raises: a report that dies
    because one subcommand failed is worse than a report with a gap in it."""
    try:
        p = subprocess.run(args, capture_output=True, text=True, timeout=timeout)
        return p.returncode == 0, p.stdout
    except Exception as exc:  # noqa: BLE001 - deliberately broad, see docstring
        print(f"  ! {' '.join(args[:3])}: {exc}", file=sys.stderr)
        return False, ""


def jsh(args, timeout=600):
    ok, out = sh(args, timeout)
    if not ok or not out.strip():
        return None
    try:
        return json.loads(out)
    except json.JSONDecodeError:
        return None


def agentic_workflows():
    """The .lock.yml files are exactly the agentic roles; everything else in
    .github/workflows is a plain deterministic workflow we are not measuring."""
    d = ".github/workflows"
    if not os.path.isdir(d):
        return []
    return sorted(f[: -len(".lock.yml")] for f in os.listdir(d) if f.endswith(".lock.yml"))


def collect_runs():
    """Per-run cost. `gh aw health` reports total_tokens: 0 for every workflow
    on this repository, so cost comes from `logs`, not `health`."""
    data = jsh(["gh", "aw", "logs", "-c", "200", "--json"], timeout=900) or {}
    runs = data.get("runs") or []
    cutoff = datetime.now(timezone.utc) - timedelta(days=WINDOW_DAYS)
    recent = []
    for r in runs:
        ts = (r.get("created_at") or "").replace("Z", "+00:00")
        try:
            if datetime.fromisoformat(ts) >= cutoff:
                recent.append(r)
        except ValueError:
            continue
    return runs, recent


def collect_health():
    data = jsh(["gh", "aw", "health", "--days", "30", "--json"]) or {}
    return {w.get("workflow_name"): w for w in (data.get("workflows") or [])}


def load_pending():
    try:
        with open(PENDING) as fh:
            return set(json.load(fh).get("run_ids") or [])
    except (OSError, json.JSONDecodeError):
        return set()


def score_outcomes(run_ids):
    """Returns (items, still_pending_run_ids, scored_count, truncated)."""
    items, still = [], set()
    wanted = sorted(run_ids, reverse=True)
    batch = wanted[:MAX_SCORED]
    truncated = len(batch) < len(wanted)
    scored = 0
    for rid in batch:
        data = jsh(["gh", "aw", "outcomes", str(rid), "--json"], timeout=300)
        if not data:
            continue
        got = data.get("items") or []
        scored += 1
        items.extend(got)
        if any(i.get("outcome_status") == "pending" for i in got):
            still.add(str(rid))
    # Anything the cap cut is still unresolved as far as we know, so carry it
    # forward rather than dropping it: an un-scored run must not silently
    # disappear from the next collection's work list.
    for rid in wanted[MAX_SCORED:]:
        still.add(str(rid))
    return items, still, scored, truncated


def main():
    now = datetime.now(timezone.utc)
    roles = set(agentic_workflows())
    print(f"agentic roles: {', '.join(sorted(roles)) or '(none)'}", file=sys.stderr)

    all_runs, recent = collect_runs()
    health = collect_health()

    # Score this window's successful runs, plus everything still unresolved from
    # previous weeks.
    to_score = {
        str(r.get("run_id"))
        for r in recent
        if r.get("conclusion") == "success" and r.get("run_id")
    } | load_pending()
    print(f"scoring {len(to_score)} run(s) for outcomes", file=sys.stderr)
    items, still_pending, scored, truncated = score_outcomes(to_score)
    if truncated:
        print(f"  ! capped at {MAX_SCORED}; {len(to_score) - scored} deferred",
              file=sys.stderr)

    # ---- aggregate ---------------------------------------------------------
    by_wf = defaultdict(lambda: {"runs": 0, "aic": 0.0, "tokens": 0, "minutes": 0.0})
    for r in recent:
        w = by_wf[r.get("workflow_name") or "?"]
        w["runs"] += 1
        w["aic"] += r.get("aic") or 0
        w["tokens"] += r.get("token_usage") or 0
        w["minutes"] += r.get("action_minutes") or 0

    states = Counter(i.get("outcome_status") for i in items)
    by_type = defaultdict(Counter)
    for i in items:
        by_type[i.get("type") or "(unknown)"][i.get("outcome_status") or "(none)"] += 1
    prs = [i for i in items if i.get("type") == "create_pull_request"]
    merged = sum(1 for i in prs if i.get("outcome_status") == "accepted")

    total_aic = sum(w["aic"] for w in by_wf.values())
    # The headline. Outcome efficiency is AIC per accepted result: a workflow can
    # get cheaper because it got better or because it did less, and only this
    # ratio tells the two apart.
    #
    # Only meaningful when every run in the window was scored. total_aic covers
    # the whole window, so dividing it by a merge count from a truncated sample
    # inflates the figure without saying so — the first local test produced
    # "309.4 AIC per merged PR" from six scored runs out of eighty-one.
    aic_per_merged = round(total_aic / merged, 1) if merged and not truncated else None

    row = {
        "collected_at": now.isoformat(),
        "window_days": WINDOW_DAYS,
        "runs": len(recent),
        "total_aic": round(total_aic, 1),
        "total_tokens": sum(w["tokens"] for w in by_wf.values()),
        "actions_minutes": round(sum(w["minutes"] for w in by_wf.values()), 1),
        "merged_prs": merged,
        "aic_per_merged_pr": aic_per_merged,
        "runs_scored": scored,
        "runs_deferred": len(to_score) - scored,
        "partial": truncated,
        "outcomes": dict(states),
        "outcomes_by_type": {k: dict(v) for k, v in sorted(by_type.items())},
        "by_workflow": {
            k: {"runs": v["runs"], "aic": round(v["aic"], 1), "tokens": v["tokens"]}
            for k, v in sorted(by_wf.items())
        },
        "health": {
            k: round(v.get("success_rate") or 0, 1)
            for k, v in sorted(health.items())
        },
        "lifetime_runs": len(all_runs),
    }

    os.makedirs("metrics", exist_ok=True)
    with open(HISTORY, "a") as fh:
        fh.write(json.dumps(row) + "\n")
    with open(PENDING, "w") as fh:
        json.dump({"run_ids": sorted(still_pending)}, fh, indent=1)

    # ---- render ------------------------------------------------------------
    prev = []
    try:
        with open(HISTORY) as fh:
            prev = [json.loads(l) for l in fh if l.strip()]
    except (OSError, json.JSONDecodeError):
        pass

    def delta(field, fmt="{:+.1f}"):
        if len(prev) < 2:
            return ""
        a, b = prev[-1].get(field), prev[-2].get(field)
        if not isinstance(a, (int, float)) or not isinstance(b, (int, float)):
            return ""
        d = a - b
        return f" ({fmt.format(d)})" if d else " (=)"

    out = []
    out.append(f"## Factory metrics — {now:%Y-%m-%d}")
    out.append("")
    out.append(f"Last {WINDOW_DAYS} days. {len(recent)} agent runs, "
               f"{len(all_runs)} lifetime.")
    out.append("")
    out.append("| | |")
    out.append("|---|---|")
    out.append(f"| Total AIC | **{row['total_aic']}**{delta('total_aic')} |")
    out.append(f"| Merged pull requests | {merged}{delta('merged_prs', '{:+d}')} |")
    if aic_per_merged is not None:
        out.append(f"| **AIC per merged PR** | **{aic_per_merged}**"
                   f"{delta('aic_per_merged_pr')} |")
    else:
        why = (f"only {scored} of {len(to_score)} runs scored this pass"
               if truncated else "no pull request merged in the window")
        out.append(f"| **AIC per merged PR** | — <sub>({why})</sub> |")
    out.append(f"| Actions minutes | {row['actions_minutes']} |")
    out.append(f"| Tokens | {row['total_tokens']:,} |")
    out.append("")

    if by_wf:
        out.append("### Cost by role")
        out.append("")
        out.append("| Role | Runs | AIC | Median AIC/run | Success (30d) |")
        out.append("|---|---:|---:|---:|---:|")
        for name, v in sorted(by_wf.items(), key=lambda kv: -kv[1]["aic"]):
            per = round(v["aic"] / v["runs"], 1) if v["runs"] else 0
            hr = health.get(name, {}).get("success_rate")
            hs = f"{hr:.0f}%" if isinstance(hr, (int, float)) else "—"
            out.append(f"| {name} | {v['runs']} | {v['aic']:.1f} | {per} | {hs} |")
        out.append("")

    if states:
        out.append("### Outcomes")
        out.append("")
        order = ["accepted", "rejected", "pending", "ignored", "unknown"]
        known = states.get("accepted", 0) + states.get("rejected", 0)
        rate = f"{100 * states.get('accepted', 0) / known:.0f}%" if known else "—"
        # By type, not just a single rate: the aggregate mixes pull requests
        # with labels the state machine is supposed to remove again, and with
        # types the outcome model has no rule for at all.
        out.append("| Safe output | " + " | ".join(order) + " |")
        out.append("|---" * (len(order) + 1) + "|")
        for ty in sorted(by_type, key=lambda t: -sum(by_type[t].values())):
            cells = " | ".join(str(by_type[ty].get(st, 0) or "") for st in order)
            out.append(f"| `{ty}` | {cells} |")
        extra = sorted(set(states) - set(order))
        if extra:
            out.append("")
            out.append("Other states: " + ", ".join(f"{e} ({states[e]})" for e in extra))
        out.append("")
        pr = by_type.get("create_pull_request", Counter())
        pr_known = pr.get("accepted", 0) + pr.get("rejected", 0)
        pr_rate = f"{100 * pr.get('accepted', 0) / pr_known:.0f}%" if pr_known else "—"
        note = (f"**Pull requests: {pr_rate} accepted** "
                f"({pr.get('accepted', 0)} merged, {pr.get('rejected', 0)} closed "
                f"unmerged) — the number to watch. Across all output types it is "
                f"{rate}, but that mixes in types the outcome model has no rule "
                f"for and labels that are *meant* to be removed, so read the "
                f"table rather than the single figure. "
                f"{len(still_pending)} run(s) carry unresolved items and will be "
                f"re-scored next week.")
        if truncated:
            note += (f" **Partial:** {scored} of {len(to_score)} runs were scored "
                     f"this pass (cap {MAX_SCORED}); the rest are deferred, not "
                     f"dropped.")
        out.append(note)
        out.append("")

    out.append("<!-- factory-metrics-report -->")
    out.append("")
    out.append("_Deterministic report — no agent ran to produce this._")
    print("\n".join(out))


if __name__ == "__main__":
    main()
