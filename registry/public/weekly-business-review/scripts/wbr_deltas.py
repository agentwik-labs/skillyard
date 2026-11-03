#!/usr/bin/env python3
"""Week-over-week and vs-plan deltas for a weekly business review.

Input CSV columns: metric,week,actual[,plan]
  week  any sortable label, e.g. 2026-W14 or 2026-04-06 (ISO strings sort correctly)
Prints a markdown table for the chosen week (default: the latest in the file).

Exit codes: 0 ok, 1 invalid data, 2 file not found. Stdlib only, no network.
"""
import argparse
import csv
import sys


def num(s):
    s = (s or "").strip().replace(",", "").replace("$", "").replace("%", "")
    if s == "":
        return None
    return float(s)


def pct(new, old):
    if new is None or old is None or old == 0:
        return None
    return (new - old) / abs(old)


def f_num(x):
    if x is None:
        return "-"
    if abs(x) >= 1000:
        return "{:,.0f}".format(x)
    return "{:,.2f}".format(x).rstrip("0").rstrip(".")


def f_pct(x):
    return "-" if x is None else "{:+.1f}%".format(x * 100)


def main(argv=None):
    p = argparse.ArgumentParser(description="Week-over-week and vs-plan deltas from a metrics CSV (metric,week,actual[,plan]).")
    p.add_argument("csv", help="path to metrics CSV")
    p.add_argument("--week", help="week label to report (default: latest in file)")
    p.add_argument("--threshold", type=float, default=0.10, help="flag changes at or beyond this fraction (default 0.10)")
    a = p.parse_args(argv)

    try:
        fh = open(a.csv, newline="", encoding="utf-8-sig")
    except FileNotFoundError:
        print("error: file not found: {}".format(a.csv), file=sys.stderr)
        return 2

    data = {}
    order = []
    try:
        with fh:
            reader = csv.DictReader(fh)
            cols = {c.strip().lower() for c in (reader.fieldnames or [])}
            if not {"metric", "week", "actual"}.issubset(cols):
                raise ValueError("CSV needs columns metric,week,actual (plan optional)")
            for i, raw in enumerate(reader, start=2):
                row = {k.strip().lower(): v for k, v in raw.items() if k}
                m = (row.get("metric") or "").strip()
                w = (row.get("week") or "").strip()
                if not m or not w:
                    continue
                try:
                    actual = num(row.get("actual"))
                    plan = num(row.get("plan"))
                except ValueError:
                    raise ValueError("line {}: non-numeric actual or plan".format(i))
                if m not in data:
                    data[m] = {}
                    order.append(m)
                data[m][w] = (actual, plan)
    except ValueError as e:
        print("error: {}".format(e), file=sys.stderr)
        return 1

    weeks = sorted({w for m in data.values() for w in m})
    if not weeks:
        print("error: no data rows", file=sys.stderr)
        return 1
    week = a.week or weeks[-1]
    if week not in weeks:
        print("error: week {} not in file (have: {})".format(week, ", ".join(weeks)), file=sys.stderr)
        return 1
    idx = weeks.index(week)
    prev = weeks[idx - 1] if idx > 0 else None

    print("Week {} vs {}  (flag at +/-{:.0f}%)\n".format(week, prev or "n/a", a.threshold * 100))
    print("| Metric | Actual | Prior wk | WoW | Plan | vs Plan | Flag |")
    print("|---|---|---|---|---|---|---|")
    flagged = 0
    for m in order:
        cur = data[m].get(week)
        if cur is None:
            continue
        actual, plan = cur
        prior = data[m].get(prev, (None, None))[0] if prev else None
        wow = pct(actual, prior)
        vp = pct(actual, plan)
        flag = ""
        if (wow is not None and abs(wow) >= a.threshold) or (vp is not None and abs(vp) >= a.threshold):
            flag = "CHECK"
            flagged += 1
        print("| {} | {} | {} | {} | {} | {} | {} |".format(
            m, f_num(actual), f_num(prior), f_pct(wow), f_num(plan), f_pct(vp), flag))
    print("\n{} metric(s) flagged. For metrics where lower is better (churn, CAC), read the sign accordingly.".format(flagged))
    return 0


if __name__ == "__main__":
    sys.exit(main())
