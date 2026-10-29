#!/usr/bin/env python3
"""Flag risky statements in SQL migration files before they hit production.

Usage:
  python3 check_migration.py migrations/0042_add_total.sql [more.sql ...]
  python3 check_migration.py --engine mysql db/migrate/*.sql
  cat generated.sql | python3 check_migration.py -

Exit code 0 if no errors (warnings allowed), 1 otherwise.
Heuristic, regex-based: it reads SQL text, it does not connect to a database.
Stdlib only, Python 3.9+.
"""
import argparse
import re
import sys

# (severity, engines, pattern, message)
RULES = [
    ("error", {"postgres", "mysql", "any"},
     r"\bALTER\s+TABLE\s+\S+\s+RENAME\s+COLUMN\b",
     "column rename breaks the running app version; use expand/contract"),
    ("error", {"postgres", "mysql", "any"},
     r"\bALTER\s+TABLE\s+\S+\s+RENAME\s+TO\b|\bRENAME\s+TABLE\b",
     "table rename breaks the running app version; use expand/contract or a view"),
    ("error", {"postgres", "any"},
     r"\bCREATE\s+(UNIQUE\s+)?INDEX\s+(?!CONCURRENTLY)",
     "index build locks writes; use CREATE INDEX CONCURRENTLY (outside a transaction)"),
    ("error", {"postgres", "any"},
     r"\bDROP\s+INDEX\s+(?!CONCURRENTLY)",
     "use DROP INDEX CONCURRENTLY to avoid blocking queries"),
    ("error", {"postgres", "mysql", "any"},
     r"\bADD\s+COLUMN\b[^;]*\bNOT\s+NULL\b(?![^;]*\bDEFAULT\b)",
     "NOT NULL column without DEFAULT fails or rewrites a populated table; add nullable, backfill, then constrain"),
    ("error", {"postgres", "any"},
     r"\bALTER\s+COLUMN\s+\S+\s+(SET\s+DATA\s+)?TYPE\b",
     "column type change usually rewrites the table under lock; use a new column + backfill"),
    ("error", {"mysql"},
     r"\bMODIFY\s+(COLUMN\s+)?\S+\s+\w+",
     "MODIFY COLUMN may copy the table; specify ALGORITHM=INPLACE/INSTANT, LOCK=NONE or use gh-ost"),
    ("error", {"postgres", "mysql", "any"},
     r"\bUPDATE\s+\S+\s+SET\b(?![^;]*\bWHERE\b)",
     "UPDATE without WHERE rewrites every row in one transaction; backfill in batches"),
    ("error", {"postgres", "mysql", "any"},
     r"\bDELETE\s+FROM\s+\S+\s*(;|$)",
     "DELETE without WHERE; batch it and confirm intent"),
    ("warning", {"postgres", "mysql", "any"},
     r"\bDROP\s+COLUMN\b",
     "dropping a column destroys data; confirm no deployed code reads it and a backup exists"),
    ("warning", {"postgres", "mysql", "any"},
     r"\bDROP\s+TABLE\b",
     "dropping a table destroys data; confirm it is unused and backed up"),
    ("warning", {"postgres", "any"},
     r"\bADD\s+CONSTRAINT\b[^;]*\bFOREIGN\s+KEY\b(?![^;]*\bNOT\s+VALID\b)",
     "foreign key validates all rows under lock; add NOT VALID, then VALIDATE CONSTRAINT separately"),
    ("warning", {"postgres", "any"},
     r"\bALTER\s+COLUMN\s+\S+\s+SET\s+NOT\s+NULL\b",
     "SET NOT NULL scans the table under lock unless a validated CHECK (col IS NOT NULL) exists"),
    ("warning", {"postgres", "any"},
     r"\bADD\s+COLUMN\b[^;]*\bDEFAULT\s+(now\(\)|gen_random_uuid\(\)|uuid_generate_v4\(\)|clock_timestamp\(\)|random\(\))",
     "volatile DEFAULT rewrites the table; add without default, then backfill"),
    ("warning", {"mysql"},
     r"\bALTER\s+TABLE\b(?![^;]*\bALGORITHM\s*=)",
     "specify ALGORITHM=INSTANT or INPLACE, LOCK=NONE so MySQL fails instead of copying the table"),
]

LOCK_TIMEOUT = {
    "postgres": r"\bSET\s+(LOCAL\s+)?lock_timeout\b",
    "any": r"\bSET\s+(LOCAL\s+|SESSION\s+)?(lock_timeout|lock_wait_timeout)\b",
    "mysql": r"\bSET\s+(SESSION\s+)?lock_wait_timeout\b",
}


def strip_comments(sql):
    sql = re.sub(r"/\*.*?\*/", " ", sql, flags=re.S)
    return re.sub(r"--[^\n]*", "", sql)


def statements(sql):
    """Yield (line_number, statement_text) for each ;-terminated statement."""
    start, line = 0, 1
    for m in re.finditer(r";", sql):
        chunk = sql[start:m.end()]
        stripped = chunk.lstrip()
        lead = chunk[: len(chunk) - len(stripped)]
        if stripped.strip(" ;\n\t"):
            yield line + lead.count("\n"), stripped
        line += chunk.count("\n")
        start = m.end()
    tail = sql[start:]
    if tail.strip():
        stripped = tail.lstrip()
        yield line + tail[: len(tail) - len(stripped)].count("\n"), stripped


def check(sql, engine):
    findings = []
    clean = strip_comments(sql)
    has_ddl = re.search(r"\b(ALTER|CREATE|DROP)\s+(TABLE|INDEX)\b", clean, re.I)
    for lineno, stmt in statements(clean):
        flat = " ".join(stmt.split())
        for sev, engines, pat, msg in RULES:
            if engine in engines or (engine == "any" and "any" in engines):
                if re.search(pat, flat, re.I):
                    findings.append((sev, lineno, msg, flat[:90]))
    if has_ddl and not re.search(LOCK_TIMEOUT[engine], clean, re.I):
        findings.append(("warning", 1, "no lock timeout set; a blocked DDL will queue all traffic behind it", ""))
    if engine in ("postgres", "any") and re.search(r"\bCONCURRENTLY\b", clean, re.I) \
            and re.search(r"\bBEGIN\b|\bSTART\s+TRANSACTION\b", clean, re.I):
        findings.append(("error", 1, "CONCURRENTLY cannot run inside a transaction block", ""))
    return findings


def main(argv=None):
    p = argparse.ArgumentParser(
        description="Flag risky statements in SQL migrations (locks, renames, "
        "unbatched updates, unsafe NOT NULL). Exit 0 if no errors, 1 otherwise."
    )
    p.add_argument("files", nargs="+", help="SQL files, or '-' for stdin")
    p.add_argument("--engine", choices=["postgres", "mysql", "any"], default="postgres",
                   help="database engine (default: %(default)s)")
    p.add_argument("--strict", action="store_true", help="treat warnings as errors")
    a = p.parse_args(argv)

    errors = warnings = 0
    for path in a.files:
        try:
            sql = sys.stdin.read() if path == "-" else open(path, encoding="utf-8").read()
        except OSError as exc:
            print("%s: cannot read: %s" % (path, exc))
            errors += 1
            continue
        for sev, line, msg, snippet in check(sql, a.engine):
            print("%s:%d: %s: %s" % (path, line, sev, msg))
            if snippet:
                print("    %s" % snippet)
            if sev == "error":
                errors += 1
            else:
                warnings += 1
    print("%d error(s), %d warning(s)" % (errors, warnings))
    return 1 if errors or (a.strict and warnings) else 0


if __name__ == "__main__":
    sys.exit(main())
