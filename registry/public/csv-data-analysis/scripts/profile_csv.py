#!/usr/bin/env python3
"""Profile a CSV file and print a markdown report of its columns.

For each column: inferred type, non-null/null counts, distinct count,
min/max/mean (numbers) or min/max (dates), and the most common values.
Exit codes: 0 = ok, 2 = bad arguments or unreadable file.
Python 3.9+, standard library only.
"""
import argparse
import csv
import re
import sys
from collections import Counter
from datetime import datetime
from typing import Dict, List, Optional

NULL_TOKENS = {"", "na", "n/a", "nan", "null", "none", "-", "--", "?", "nil", "#n/a"}
DATE_FORMATS = (
    "%Y-%m-%d", "%Y-%m-%dT%H:%M:%S", "%Y-%m-%d %H:%M:%S", "%Y-%m-%dT%H:%M:%SZ",
    "%Y/%m/%d", "%m/%d/%Y", "%d/%m/%Y", "%d.%m.%Y", "%Y-%m-%dT%H:%M:%S.%f",
)
NUM_CLEAN = re.compile(r"^[\s$€£¥]*([-+]?[\d,]*\.?\d+(?:[eE][-+]?\d+)?)\s*%?$")
BOOL_TOKENS = {"true", "false", "yes", "no", "y", "n", "t", "f"}


def parse_number(s: str) -> Optional[float]:
    m = NUM_CLEAN.match(s)
    if not m:
        return None
    raw = m.group(1)
    if "," in raw and not re.match(r"^[-+]?\d{1,3}(,\d{3})+(\.\d+)?$", raw):
        return None
    try:
        return float(raw.replace(",", ""))
    except ValueError:
        return None


def parse_date(s: str) -> Optional[datetime]:
    s = s.strip()
    if len(s) < 8 or len(s) > 32:
        return None
    for fmt in DATE_FORMATS:
        try:
            return datetime.strptime(s, fmt)
        except ValueError:
            continue
    return None


class Column:
    def __init__(self, name: str) -> None:
        self.name = name
        self.nulls = 0
        self.values: Counter = Counter()
        self.nums: List[float] = []
        self.num_fail = 0
        self.dates: List[datetime] = []
        self.date_fail = 0
        self.bool_ok = 0

    def add(self, raw: str) -> None:
        v = raw.strip()
        if v.lower() in NULL_TOKENS:
            self.nulls += 1
            return
        self.values[v] += 1
        n = parse_number(v)
        if n is None:
            self.num_fail += 1
        else:
            self.nums.append(n)
        if self.date_fail <= 50 or self.dates:
            d = parse_date(v)
            if d is None:
                self.date_fail += 1
            else:
                self.dates.append(d)
        if v.lower() in BOOL_TOKENS:
            self.bool_ok += 1

    @property
    def non_null(self) -> int:
        return sum(self.values.values())

    def kind(self) -> str:
        nn = self.non_null
        if nn == 0:
            return "empty"
        if len(self.nums) == nn:
            return "integer" if all(x.is_integer() for x in self.nums) else "float"
        if len(self.dates) == nn:
            return "date"
        if self.bool_ok == nn:
            return "boolean"
        if len(self.nums) >= 0.9 * nn:
            return "mostly numeric (%d non-numeric)" % (nn - len(self.nums))
        if len(self.dates) >= 0.9 * nn:
            return "mostly date (%d unparsed)" % (nn - len(self.dates))
        return "text"


def fmt(x: float) -> str:
    if x.is_integer() and abs(x) < 1e15:
        return "{:,}".format(int(x))
    if abs(x) >= 1e15 or (x != 0 and abs(x) < 1e-3):
        return "{:.4g}".format(x)
    return "{:,.2f}".format(x)


def esc(s: str, limit: int = 40) -> str:
    s = s.replace("|", "\\|").replace("\n", " ")
    return s if len(s) <= limit else s[: limit - 3] + "..."


def main(argv: Optional[List[str]] = None) -> int:
    ap = argparse.ArgumentParser(description="Profile a CSV file and print a markdown report.")
    ap.add_argument("path", help="CSV/TSV file to profile")
    ap.add_argument("--delimiter", help="field delimiter (default: sniffed)")
    ap.add_argument("--top", type=int, default=5, help="top values to show per column (default 5)")
    ap.add_argument("--max-rows", type=int, default=1_000_000, help="stop after this many rows")
    ap.add_argument("--encoding", default="utf-8-sig", help="file encoding (default utf-8-sig)")
    args = ap.parse_args(argv)

    try:
        fh = open(args.path, newline="", encoding=args.encoding, errors="replace")
    except OSError as e:
        print("error: %s" % e, file=sys.stderr)
        return 2
    with fh:
        sample = fh.read(65536)
        fh.seek(0)
        delim = args.delimiter
        if not delim:
            try:
                delim = csv.Sniffer().sniff(sample, delimiters=",;\t|").delimiter
            except csv.Error:
                delim = ","
        reader = csv.reader(fh, delimiter=delim)
        try:
            header = next(reader)
        except StopIteration:
            print("error: file is empty", file=sys.stderr)
            return 2
        names = [h.strip() or "column_%d" % (i + 1) for i, h in enumerate(header)]
        cols: Dict[int, Column] = {i: Column(n) for i, n in enumerate(names)}
        rows = 0
        ragged = 0
        row_counter: Counter = Counter()
        truncated = False
        for row in reader:
            if not any(c.strip() for c in row):
                continue
            if rows >= args.max_rows:
                truncated = True
                break
            rows += 1
            if len(row) != len(names):
                ragged += 1
            row_counter[tuple(row)] += 1
            for i, col in cols.items():
                col.add(row[i] if i < len(row) else "")

    dups = sum(c - 1 for c in row_counter.values() if c > 1)
    print("# Profile: %s\n" % args.path)
    print("- Rows: %s%s" % ("{:,}".format(rows), " (truncated at --max-rows)" if truncated else ""))
    print("- Columns: %d" % len(names))
    print("- Delimiter: %r" % delim)
    print("- Exact duplicate rows: %d" % dups)
    print("- Rows with wrong field count: %d\n" % ragged)

    print("## Columns\n")
    print("| Column | Type | Non-null | Null | Distinct | Min | Max | Mean |")
    print("|---|---|---|---|---|---|---|---|")
    for col in cols.values():
        k = col.kind()
        mn = mx = mean = ""
        if col.nums and (k in ("integer", "float") or k.startswith("mostly numeric")):
            mn, mx = fmt(min(col.nums)), fmt(max(col.nums))
            mean = fmt(sum(col.nums) / len(col.nums))
        elif col.dates and (k == "date" or k.startswith("mostly date")):
            mn, mx = min(col.dates).isoformat(), max(col.dates).isoformat()
        print("| %s | %s | %d | %d | %d | %s | %s | %s |" % (
            esc(col.name), k, col.non_null, col.nulls, len(col.values), mn, mx, mean))

    print("\n## Top values\n")
    for col in cols.values():
        if not col.values:
            continue
        tops = ", ".join("`%s` (%d)" % (esc(v, 30), c) for v, c in col.values.most_common(args.top))
        note = " - all unique" if len(col.values) == col.non_null and col.non_null > 1 else ""
        print("- **%s**%s: %s" % (esc(col.name), note, tops))
    return 0


if __name__ == "__main__":
    sys.exit(main())
