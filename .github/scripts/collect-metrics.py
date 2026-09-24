#!/usr/bin/env python3
"""Collect one week's factory metrics into a single history row.

Deterministic on purpose. A report about what the agents cost must not itself
cost agent credits, or the observer inflates the thing it observes — the
reviewer alone was 155 AIC over the first 94 runs. Same reasoning as
sweeper.yml: no judgement is needed here, only arithmetic.

Reads:  gh aw logs --json    per-run aic / tokens / actions minutes
        gh aw health --json  per-workflow success rate
        gh pr list           what actually merged
Writes: metrics/history.jsonl  one row per collection, appended
        a markdown report on stdout

`gh aw outcomes` is deliberately NOT used here, after it was. It downloads every
run's artifacts and then queries the current state of each object that run wrote
to; five collections in one hour exhausted the Actions token's 5,000/hour budget
outright. It earns that cost when a workflow's outputs have subtle fates — a
comment that may or may not draw a reply, an issue that may or may not get
resolved. This factory almost only produces pull requests, and for those
`accepted` means merged, which `gh pr list` answers in three calls rather than a
thousand. Run `gh aw outcomes <run-id>` by hand when the fuller picture is
wanted; it also reports types this does not, such as whether a review was acted
on.
"""

import json
import os
import subprocess
import sys
from collections import defaultdict
from datetime import datetime, timedelta, timezone

WINDOW_DAYS = int(os.environ.get("WINDOW_DAYS", "7"))
# Fetch limits. These are the only numbers here that can make the report say
# less than the truth, so each one is checked against what came back and
# declared in the output if it binds. A silently truncated total is how the
# first version of this script reported a third of the real cost.
RUN_FETCH = int(os.environ.get("RUN_FETCH", "400"))
PR_FETCH = int(os.environ.get("PR_FETCH", "300"))
HISTORY = "metrics/history.jsonl"

_REPORTED = set()


def sh(args, timeout=600):
    """Run a command, returning (ok, stdout). Never raises: a report that dies
    because one subcommand failed is worse than a report with a gap in it.

    It does, however, say WHY. Swallowing stderr here cost a whole CI round trip
    once — sixty calls failed in forty-eight seconds and the log showed only a
    count. The first failure of each command shape is printed in full; the rest
    are counted, so one broken subcommand cannot flood the log."""
    try:
        p = subprocess.run(args, capture_output=True, text=True, timeout=timeout)
        if p.returncode != 0:
            key = " ".join(args[:3])
            if key not in _REPORTED:
                _REPORTED.add(key)
                print(f"  ! {key} exited {p.returncode}:", file=sys.stderr)
                for line in (p.stderr or p.stdout or "").strip().splitlines()[:6]:
                    print(f"      {line}", file=sys.stderr)
            return False, ""
        return True, p.stdout
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


def within(ts, cutoff):
    try:
        return datetime.fromisoformat((ts or "").replace("Z", "+00:00")) >= cutoff
    except ValueError:
        return False


def collect_runs(cutoff):
    """Per-run cost. `gh aw health` reports total_tokens: 0 for every workflow
    on this repository, so cost comes from `logs`, not `health`.

    IMPORTANT: `aic` here is the AGENT's spend only — it matches the first
    figure in a run's footer exactly and excludes threat detection, which runs
    its own model on every run. Detection is the LARGER share: 1087 AIC against
    the agents' 632 over the first 94 runs. component_costs() below reads the
    real per-component figures instead of applying a multiplier."""
    data = jsh(["gh", "aw", "logs", "-c", str(RUN_FETCH), "--json"], timeout=900) or {}
    runs = data.get("runs") or []
    loc = data.get("logs_location")
    return runs, [r for r in runs if within(r.get("created_at"), cutoff)], loc


def component_costs(logs_location, run_id):
    """Real per-component AIC for one run, or None where it is not on disk.

    `gh aw logs` defaults `--artifacts` to `usage`, so it has already written
    <logs>/run-<id>/usage/{agent,detection,evals}/token_usage.jsonl. Each line
    carries a running `ai_credits_total`, so the last line is that component's
    total. Reading these costs nothing extra — no API calls, no downloads — and
    replaces an earlier 2.8x multiplier that was a mean of four samples ranging
    1.67 to 4.83, which had no business being in a report."""
    base = os.path.join(logs_location or ".github/aw/logs", f"run-{run_id}", "usage")

    def last_total(component):
        path = os.path.join(base, component, "token_usage.jsonl")
        if not os.path.exists(path):
            return None
        last = None
        try:
            with open(path) as fh:
                for line in fh:
                    line = line.strip()
                    if line:
                        last = json.loads(line)
        except (OSError, json.JSONDecodeError):
            return None
        return (last or {}).get("ai_credits_total")

    return {c: last_total(c) for c in ("agent", "detection", "evals")}


def collect_health():
    data = jsh(["gh", "aw", "health", "--days", "30", "--json"]) or {}
    return {w.get("workflow_name"): w for w in (data.get("workflows") or [])}


def collect_prs(cutoff):
    """What the factory actually shipped. Agent pull requests carry the `agent`
    label, applied at creation by the implementer's own safe output."""
    data = jsh([
        "gh", "pr", "list", "--state", "all", "--limit", str(PR_FETCH),
        "--json", "number,state,labels,createdAt,mergedAt",
    ]) or []
    truncated = len(data) >= PR_FETCH
    prs = [
        p for p in data
        if any(l.get("name") == "agent" for l in (p.get("labels") or []))
        and within(p.get("createdAt"), cutoff)
    ]
    merged = [p for p in prs if p.get("mergedAt")]
    closed = [p for p in prs if p.get("state") == "CLOSED" and not p.get("mergedAt")]
    open_ = [p for p in prs if p.get("state") == "OPEN"]
    return prs, merged, closed, open_, truncated


def main():
    now = datetime.now(timezone.utc)
    cutoff = now - timedelta(days=WINDOW_DAYS)

    all_runs, recent, logs_location = collect_runs(cutoff)
    health = collect_health()
    prs, merged, closed, open_, prs_truncated = collect_prs(cutoff)
    runs_truncated = len(all_runs) >= RUN_FETCH

    by_wf = defaultdict(lambda: {"runs": 0, "aic": 0.0, "detection": 0.0,
                                 "tokens": 0, "minutes": 0.0})
    missing_components = 0
    for r in recent:
        w = by_wf[r.get("workflow_name") or "?"]
        w["runs"] += 1
        w["aic"] += r.get("aic") or 0
        w["tokens"] += r.get("token_usage") or 0
        w["minutes"] += r.get("action_minutes") or 0
        comp = component_costs(logs_location, r.get("run_id"))
        if comp["detection"] is None:
            missing_components += 1
        w["detection"] += (comp["detection"] or 0) + (comp["evals"] or 0)

    total_aic = sum(w["aic"] for w in by_wf.values())
    total_detection = sum(w["detection"] for w in by_wf.values())
    total_all = total_aic + total_detection
    # The headline. Cost per accepted result, not cost per run: a factory can get
    # cheaper because it got better or because it did less, and only this ratio
    # tells the two apart. Agent-only, for the reason in collect_runs().
    aic_per_merged = round(total_all / len(merged), 1) if merged else None
    resolved = len(merged) + len(closed)

    row = {
        "collected_at": now.isoformat(),
        "window_days": WINDOW_DAYS,
        "runs": len(recent),
        "agent_aic": round(total_aic, 1),
        "detection_aic": round(total_detection, 1),
        "total_aic": round(total_all, 1),
        "runs_missing_component_costs": missing_components,
        "fetch_truncated": bool(runs_truncated or prs_truncated),
        "total_tokens": sum(w["tokens"] for w in by_wf.values()),
        "actions_minutes": round(sum(w["minutes"] for w in by_wf.values()), 1),
        "prs_opened": len(prs),
        "prs_merged": len(merged),
        "prs_closed_unmerged": len(closed),
        "prs_open": len(open_),
        "aic_per_merged_pr": aic_per_merged,
        "acceptance_rate": round(100 * len(merged) / resolved, 1) if resolved else None,
        "by_workflow": {
            k: {"runs": v["runs"], "aic": round(v["aic"], 1), "tokens": v["tokens"]}
            for k, v in sorted(by_wf.items())
        },
        "health": {k: round(v.get("success_rate") or 0, 1) for k, v in sorted(health.items())},
        "lifetime_runs": len(all_runs),
    }

    os.makedirs("metrics", exist_ok=True)
    with open(HISTORY, "a") as fh:
        fh.write(json.dumps(row) + "\n")

    prev = []
    try:
        with open(HISTORY) as fh:
            prev = [json.loads(line) for line in fh if line.strip()]
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

    out = [
        f"## Factory metrics — {now:%Y-%m-%d}",
        "",
        f"Last {WINDOW_DAYS} days: {len(recent)} runs that executed an agent "
        f"({len(all_runs)} in `gh aw logs`' whole history).",
        "",
        "_Cancelled and skipped runs are not listed by `gh aw logs` and are not "
        "counted here. Spot-checked: a cancelled run's usage artifact showed "
        "0.00 AIC, so they cost nothing — but that is a sample, not a proof._",
        "",
        "| | |",
        "|---|---|",
        f"| **Total AIC** | **{row['total_aic']}**{delta('total_aic')} "
        f"<sub>(${row['total_aic'] / 100:.2f})</sub> |",
        f"| ├ agents | {row['agent_aic']} |",
        f"| └ threat detection | {row['detection_aic']} "
        f"<sub>({100 * row['detection_aic'] / row['total_aic']:.0f}% of spend)</sub> |"
        if row["total_aic"] else "| └ threat detection | 0 |",
        f"| Pull requests merged | {len(merged)}{delta('prs_merged', '{:+d}')} |",
    ]
    if aic_per_merged is not None:
        out.append(f"| **AIC per merged PR** | **{aic_per_merged}**"
                   f"{delta('aic_per_merged_pr')} "
                   f"<sub>(${aic_per_merged / 100:.2f}, all-in)</sub> |")
    else:
        out.append("| **AIC per merged PR** | — <sub>(nothing merged in the window)</sub> |")
    if row["acceptance_rate"] is not None:
        tail = f", {len(open_)} still open" if open_ else ""
        out.append(f"| Acceptance | {row['acceptance_rate']}% "
                   f"({len(merged)} merged, {len(closed)} closed unmerged{tail}) |")
    out += [
        f"| Actions minutes | {row['actions_minutes']} |",
        f"| Tokens | {row['total_tokens']:,} |",
        "",
    ]

    if by_wf:
        out += ["### Cost by role", "",
                "| Role | Runs | Agent | Detection | Total | Per run | Success (30d) |",
                "|---|---:|---:|---:|---:|---:|---:|"]
        for name, v in sorted(by_wf.items(), key=lambda kv: -(kv[1]["aic"] + kv[1]["detection"])):
            tot = v["aic"] + v["detection"]
            per = round(tot / v["runs"], 1) if v["runs"] else 0
            hr = health.get(name, {}).get("success_rate")
            hs = f"{hr:.0f}%" if isinstance(hr, (int, float)) else "—"
            out.append(f"| {name} | {v['runs']} | {v['aic']:.1f} | {v['detection']:.1f} "
                       f"| **{tot:.1f}** | {per} | {hs} |")
        out.append("")
        notes = []
        if missing_components:
            notes.append(f"{missing_components} run(s) had no usage artifact to read "
                         f"(no agent executed, or the artifact expired), so their "
                         f"cost is not counted")
        if runs_truncated:
            notes.append(f"**the run fetch hit its limit of {RUN_FETCH}** — these "
                         f"totals are an undercount; raise `RUN_FETCH`")
        if prs_truncated:
            notes.append(f"**the pull request fetch hit its limit of {PR_FETCH}** — "
                         f"the merge count is an undercount; raise `PR_FETCH`")
        if notes:
            out.append("_" + "; ".join(notes) + "._")
            out.append("")

    out += [
        "<!-- factory-metrics-report -->",
        "",
        "_Deterministic report — no agent ran to produce this._",
        "",
        "_1 AIC = $0.01. Agent and detection costs are read per run from the "
        "usage artifacts `gh aw logs` already downloads, not estimated. For "
        "per-safe-output detail run `gh aw outcomes <run-id>` by hand; it is "
        "left out of this job because it costs roughly a thousand API calls._",
    ]
    print("\n".join(out))


if __name__ == "__main__":
    main()
