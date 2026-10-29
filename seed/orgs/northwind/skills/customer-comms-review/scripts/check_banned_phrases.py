#!/usr/bin/env python3
"""Flag non-compliant phrases in Northwind Pay customer communications.

Usage:
  check_banned_phrases.py FILE [FILE ...]
  cat draft.txt | check_banned_phrases.py -

Exit codes: 0 = clean, 1 = findings, 2 = usage or read error.
Python 3.9+, standard library only.
"""
import argparse
import re
import sys

# (pattern, reason, suggestion)
RULES = [
    (r"guaranteed\s+(returns?|yields?|income|profits?)", "Promises returns", "Describe the rate as variable"),
    (r"\bguarantee[sd]?\b", "Guarantee language", "Use 'typically' with the documented window"),
    (r"\brisk[- ]free\b", "Implies no risk", "Remove"),
    (r"\b(northwind|our|your)\s+(pay\s+)?bank\s+account\b", "Implies Northwind is a bank", "Say 'Northwind Pay account'"),
    (r"\bwe\s+are\s+a\s+bank\b", "Northwind is not a bank", "Name the partner bank"),
    (r"\bfdic[- ]insured\b", "FDIC claim without partner bank", "Add 'through Harbor Trust Bank, Member FDIC'"),
    (r"\bact\s+now\b|\blimited\s+time\b|\bdon'?t\s+miss\s+out\b", "Urgency tactic", "Remove urgency"),
    (r"\binstant(ly)?\s+(payouts?|transfers?|deposits?)\b", "Timing promise", "Use 'typically within ...'"),
    (r"\bno\s+fees?\s+ever\b|\bfree\s+forever\b", "Absolute fee promise", "State current fees and that they may change"),
    (r"\b\d{13,19}\b", "Possible full card or account number", "Show last four digits only"),
]
COMPILED = [(re.compile(p, re.IGNORECASE), r, s) for p, r, s in RULES]


def check(text, source):
    findings = []
    for lineno, line in enumerate(text.splitlines(), 1):
        for rx, reason, suggestion in COMPILED:
            for m in rx.finditer(line):
                findings.append((source, lineno, m.group(0), reason, suggestion))
    return findings


def main(argv=None):
    ap = argparse.ArgumentParser(
        description="Flag banned or non-compliant phrases in Northwind Pay customer copy.",
        epilog="Exit codes: 0 clean, 1 findings, 2 usage or read error.",
    )
    ap.add_argument("files", nargs="+", help="Files to check, or '-' for stdin")
    args = ap.parse_args(argv)

    findings = []
    for path in args.files:
        try:
            if path == "-":
                text = sys.stdin.read()
            else:
                with open(path, encoding="utf-8") as fh:
                    text = fh.read()
        except OSError as exc:
            print("error: cannot read %s: %s" % (path, exc), file=sys.stderr)
            return 2
        findings.extend(check(text, "<stdin>" if path == "-" else path))

    for source, lineno, phrase, reason, suggestion in findings:
        print('%s:%d: "%s" - %s. Fix: %s' % (source, lineno, phrase, reason, suggestion))
    if findings:
        print("%d finding(s)." % len(findings), file=sys.stderr)
        return 1
    print("No banned phrases found.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
