#!/usr/bin/env python3
"""Accounts receivable aging report from a CSV of invoices.

Input CSV columns: invoice,customer,amount,due_date[,paid][,contact]
  due_date  YYYY-MM-DD
  paid      optional amount already paid on the invoice (partial payments)
Buckets open balances: Current, 1-30, 31-60, 61-90, 90+ days overdue.

Exit codes: 0 ok, 1 invalid data, 2 file not found. Stdlib only, no network.
"""
import argparse
import csv
import datetime as dt
import sys

BUCKETS = ["Current", "1-30", "31-60", "61-90", "90+"]


def bucket(days):
    if days <= 0:
        return "Current"
    if days <= 30:
        return "1-30"
    if days <= 60:
        return "31-60"
    if days <= 90:
        return "61-90"
    return "90+"


def step(days):
    if days <= 0:
        return "not due"
    if days <= 7:
        return "reminder email"
    if days <= 30:
        return "second reminder + call"
    if days <= 60:
        return "call payer, agree date"
    if days <= 90:
        return "escalate to senior contact"
    return "final notice / decide plan or write-off"


def money(x):
    return "{:,.2f}".format(x)


def parse_amount(s):
    return float((s or "0").strip().replace(",", "").replace("$", "") or 0)


def main(argv=None):
    p = argparse.ArgumentParser(description="AR aging buckets (Current, 1-30, 31-60, 61-90, 90+) from an invoices CSV.")
    p.add_argument("csv", help="invoices CSV: invoice,customer,amount,due_date[,paid]")
    p.add_argument("--as-of", help="report date YYYY-MM-DD (default: today)")
    a = p.parse_args(argv)

    try:
        as_of = dt.date.fromisoformat(a.as_of) if a.as_of else dt.date.today()
    except ValueError:
        print("error: --as-of must be YYYY-MM-DD", file=sys.stderr)
        return 1
    try:
        fh = open(a.csv, newline="", encoding="utf-8-sig")
    except FileNotFoundError:
        print("error: file not found: {}".format(a.csv), file=sys.stderr)
        return 2

    rows = []
    try:
        with fh:
            reader = csv.DictReader(fh)
            cols = {c.strip().lower() for c in (reader.fieldnames or [])}
            need = {"invoice", "customer", "amount", "due_date"}
            if not need.issubset(cols):
                raise ValueError("CSV needs columns invoice,customer,amount,due_date (paid optional)")
            for i, raw in enumerate(reader, start=2):
                r = {k.strip().lower(): (v or "").strip() for k, v in raw.items() if k}
                if not r.get("invoice"):
                    continue
                try:
                    open_bal = parse_amount(r.get("amount")) - parse_amount(r.get("paid"))
                except ValueError:
                    raise ValueError("line {}: amount or paid is not a number".format(i))
                try:
                    due = dt.date.fromisoformat(r["due_date"])
                except ValueError:
                    raise ValueError("line {}: due_date '{}' is not YYYY-MM-DD".format(i, r["due_date"]))
                if open_bal <= 0.005:
                    continue
                days = (as_of - due).days
                rows.append((r["customer"] or "(blank)", r["invoice"], open_bal, due, days))
    except ValueError as e:
        print("error: {}".format(e), file=sys.stderr)
        return 1

    if not rows:
        print("No open invoices as of {}.".format(as_of))
        return 0

    by_cust = {}
    totals = dict.fromkeys(BUCKETS, 0.0)
    for cust, _inv, bal, _due, days in rows:
        b = bucket(days)
        by_cust.setdefault(cust, dict.fromkeys(BUCKETS, 0.0))[b] += bal
        totals[b] += bal

    print("## AR aging as of {}\n".format(as_of))
    print("| Customer | " + " | ".join(BUCKETS) + " | Total |")
    print("|---" * (len(BUCKETS) + 2) + "|")
    for cust in sorted(by_cust, key=lambda c: -sum(v for k, v in by_cust[c].items() if k != "Current")):
        vals = by_cust[cust]
        print("| {} | {} | {} |".format(cust, " | ".join(money(vals[b]) for b in BUCKETS), money(sum(vals.values()))))
    grand = sum(totals.values())
    print("| **Total** | {} | **{}** |".format(" | ".join(money(totals[b]) for b in BUCKETS), money(grand)))
    if grand:
        print("| % of total | {} | 100% |".format(" | ".join("{:.0f}%".format(totals[b] / grand * 100) for b in BUCKETS)))

    overdue = sorted([r for r in rows if r[4] > 0], key=lambda r: -(r[2] * r[4]))
    print("\n## Overdue invoices (priority = amount x days)\n")
    if not overdue:
        print("None.")
    else:
        print("| Customer | Invoice | Open amount | Due | Days overdue | Ladder step |")
        print("|---|---|---|---|---|---|")
        for cust, inv, bal, due, days in overdue:
            print("| {} | {} | {} | {} | {} | {} |".format(cust, inv, money(bal), due.isoformat(), days, step(days)))
    print("\nTotal overdue: {} across {} invoice(s).".format(money(sum(r[2] for r in overdue)), len(overdue)))
    return 0


if __name__ == "__main__":
    sys.exit(main())
