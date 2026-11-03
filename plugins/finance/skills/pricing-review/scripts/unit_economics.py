#!/usr/bin/env python3
"""Compute unit economics (gross margin, CAC payback, LTV, LTV:CAC).

Single scenario from flags, or one row per segment from a CSV with columns
segment,price,cogs,cac,churn  (price and cogs are monthly per customer,
churn is monthly as a fraction, e.g. 0.03 for 3%).

Exit codes: 0 ok, 1 invalid input, 2 file not found.
Stdlib only, no network.
"""
import argparse
import csv
import sys


def compute(price, cogs, cac, churn):
    if price <= 0:
        raise ValueError("price must be > 0")
    if cogs < 0 or cac < 0:
        raise ValueError("cogs and cac must be >= 0")
    if not 0 < churn <= 1:
        raise ValueError("churn must be a monthly fraction between 0 and 1, e.g. 0.03")
    gross_profit = price - cogs
    margin = gross_profit / price
    payback = cac / gross_profit if gross_profit > 0 else float("inf")
    lifetime = 1.0 / churn
    ltv = gross_profit * lifetime
    ratio = ltv / cac if cac > 0 else float("inf")
    flags = []
    if gross_profit <= 0:
        flags.append("negative gross profit")
    if payback > 12:
        flags.append("payback > 12 mo")
    if ratio < 3:
        flags.append("LTV:CAC < 3")
    if margin < 0.6:
        flags.append("gross margin < 60%")
    return {
        "gross_margin": margin,
        "gross_profit": gross_profit,
        "payback_months": payback,
        "lifetime_months": lifetime,
        "ltv": ltv,
        "ltv_cac": ratio,
        "flags": flags,
    }


def fmt(x, kind):
    if x == float("inf"):
        return "n/a"
    if kind == "pct":
        return "{:.1f}%".format(x * 100)
    if kind == "money":
        return "{:,.2f}".format(x)
    return "{:.1f}".format(x)


def render(rows):
    out = [
        "| Segment | Price/mo | COGS/mo | CAC | Churn/mo | Gross margin | Payback (mo) | Lifetime (mo) | LTV | LTV:CAC | Flags |",
        "|---|---|---|---|---|---|---|---|---|---|---|",
    ]
    for name, inp, r in rows:
        out.append("| {} | {} | {} | {} | {} | {} | {} | {} | {} | {} | {} |".format(
            name, fmt(inp["price"], "money"), fmt(inp["cogs"], "money"), fmt(inp["cac"], "money"),
            fmt(inp["churn"], "pct"), fmt(r["gross_margin"], "pct"), fmt(r["payback_months"], "n"),
            fmt(r["lifetime_months"], "n"), fmt(r["ltv"], "money"), fmt(r["ltv_cac"], "n"),
            ", ".join(r["flags"]) or "ok"))
    return "\n".join(out)


def main(argv=None):
    p = argparse.ArgumentParser(description="Unit economics: gross margin, CAC payback, LTV, LTV:CAC (markdown table).")
    p.add_argument("--price", type=float, help="monthly revenue per customer")
    p.add_argument("--cogs", type=float, default=0.0, help="monthly cost to serve per customer (default 0)")
    p.add_argument("--cac", type=float, help="customer acquisition cost")
    p.add_argument("--churn", type=float, help="monthly churn as a fraction, e.g. 0.03")
    p.add_argument("--csv", help="CSV with columns segment,price,cogs,cac,churn")
    a = p.parse_args(argv)

    rows = []
    try:
        if a.csv:
            try:
                fh = open(a.csv, newline="", encoding="utf-8-sig")
            except FileNotFoundError:
                print("error: file not found: {}".format(a.csv), file=sys.stderr)
                return 2
            with fh:
                reader = csv.DictReader(fh)
                need = {"segment", "price", "cogs", "cac", "churn"}
                if not reader.fieldnames or not need.issubset({f.strip().lower() for f in reader.fieldnames}):
                    raise ValueError("CSV needs columns: segment,price,cogs,cac,churn")
                for i, raw in enumerate(reader, start=2):
                    row = {k.strip().lower(): (v or "").strip() for k, v in raw.items() if k}
                    try:
                        inp = {k: float(row[k].replace(",", "").replace("$", "")) for k in ("price", "cogs", "cac", "churn")}
                    except ValueError:
                        raise ValueError("line {}: non-numeric value".format(i))
                    rows.append((row["segment"] or "line {}".format(i), inp, compute(**inp)))
            if not rows:
                raise ValueError("CSV has no data rows")
        else:
            if a.price is None or a.cac is None or a.churn is None:
                p.print_usage(sys.stderr)
                raise ValueError("give --price, --cac and --churn (and optionally --cogs), or --csv")
            inp = {"price": a.price, "cogs": a.cogs, "cac": a.cac, "churn": a.churn}
            rows.append(("all", inp, compute(**inp)))
    except ValueError as e:
        print("error: {}".format(e), file=sys.stderr)
        return 1

    print(render(rows))
    print("\nPayback = CAC / monthly gross profit. LTV = monthly gross profit / monthly churn (undiscounted).")
    return 0


if __name__ == "__main__":
    sys.exit(main())
