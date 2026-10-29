#!/usr/bin/env python3
"""Scan files for hard-coded secrets and print file:line:rule:masked-value.

Exit codes: 0 = no findings, 1 = findings, 2 = usage error.
Python 3.9+, standard library only.
"""
import argparse
import math
import os
import re
import sys
from typing import Iterable, Iterator, List, Optional, Tuple

SKIP_DIRS = {
    ".git", "node_modules", "vendor", "dist", "build", ".venv", "venv", "env",
    "__pycache__", ".tox", ".mypy_cache", ".pytest_cache", ".next", "target",
    ".terraform", "coverage",
}
TEST_HINTS = ("test", "tests", "fixtures", "__fixtures__", "spec", "testdata")
SKIP_EXT = {
    ".png", ".jpg", ".jpeg", ".gif", ".ico", ".pdf", ".zip", ".gz", ".tar",
    ".woff", ".woff2", ".ttf", ".eot", ".mp4", ".mov", ".mp3", ".so", ".dll",
    ".exe", ".bin", ".class", ".jar", ".pyc", ".lock", ".svg", ".webp",
}
MAX_BYTES = 2_000_000

RULES: List[Tuple[str, "re.Pattern[str]"]] = [
    ("aws-access-key-id", re.compile(r"\b((?:AKIA|ASIA|AGPA|AIDA|AROA)[0-9A-Z]{16})\b")),
    ("aws-secret-access-key", re.compile(
        r"(?i)aws.{0,20}?(?:secret|private).{0,20}?['\"=:\s]([A-Za-z0-9/+=]{40})(?![A-Za-z0-9/+=])")),
    ("github-token", re.compile(r"\b((?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{36,})\b")),
    ("github-fine-grained-pat", re.compile(r"\b(github_pat_[A-Za-z0-9_]{60,})\b")),
    ("slack-token", re.compile(r"\b(xox[abposr]-[A-Za-z0-9-]{10,})\b")),
    ("stripe-live-key", re.compile(r"\b((?:sk|rk)_live_[A-Za-z0-9]{20,})\b")),
    ("google-api-key", re.compile(r"\b(AIza[0-9A-Za-z_\-]{35})\b")),
    ("private-key-block", re.compile(r"(-----BEGIN (?:RSA |EC |DSA |OPENSSH |PGP |ENCRYPTED )?PRIVATE KEY(?: BLOCK)?-----)")),
    ("jwt", re.compile(r"\b(eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,})\b")),
    ("connection-string-password", re.compile(
        r"\b(?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?|redis|amqp)://[^:\s/'\"]+:([^@\s'\"]{4,})@")),
]
GENERIC = re.compile(
    r"(?i)\b[\w.-]*(?:password|passwd|pwd|secret|token|api[_-]?key|apikey|access[_-]?key|auth[_-]?key|client[_-]?secret)[\w.-]*"
    r"\s*(?:=|:|:=|=>)\s*['\"]([^'\"\s]{16,})['\"]")
PLACEHOLDER = re.compile(r"(?i)(example|placeholder|changeme|your[_-]|dummy|sample|xxxx|<|\$\{|\{\{|redacted|fake|test)")


def entropy(s: str) -> float:
    if not s:
        return 0.0
    counts = {}
    for ch in s:
        counts[ch] = counts.get(ch, 0) + 1
    n = len(s)
    return -sum(c / n * math.log2(c / n) for c in counts.values())


def mask(secret: str) -> str:
    keep = 4 if len(secret) > 8 else 1
    return "%s%s(%d chars)" % (secret[:keep], "*" * 8, len(secret))


def scan_line(line: str) -> Iterator[Tuple[str, str]]:
    seen = set()
    for name, rx in RULES:
        for m in rx.finditer(line):
            val = m.group(1)
            if name != "private-key-block" and PLACEHOLDER.search(val):
                continue
            if val not in seen:
                seen.add(val)
                yield name, val
    for m in GENERIC.finditer(line):
        val = m.group(1)
        if val in seen or PLACEHOLDER.search(val):
            continue
        if entropy(val) >= 3.5:
            seen.add(val)
            yield "generic-high-entropy-assignment", val


def scan_text(label: str, lines: Iterable[str]) -> List[str]:
    out = []
    for i, line in enumerate(lines, 1):
        if len(line) > 5000:
            line = line[:5000]
        for rule, val in scan_line(line):
            out.append("%s:%d:%s:%s" % (label, i, rule, mask(val)))
    return out


def iter_files(root: str, include_tests: bool) -> Iterator[str]:
    if os.path.isfile(root):
        yield root
        return
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = [
            d for d in dirnames
            if d not in SKIP_DIRS and (include_tests or d.lower() not in TEST_HINTS)
        ]
        for fn in filenames:
            if os.path.splitext(fn)[1].lower() in SKIP_EXT:
                continue
            yield os.path.join(dirpath, fn)


def read_text(path: str) -> Optional[List[str]]:
    try:
        if os.path.getsize(path) > MAX_BYTES:
            return None
        with open(path, "rb") as fh:
            data = fh.read()
    except OSError:
        return None
    if b"\x00" in data[:4096]:
        return None
    return data.decode("utf-8", errors="replace").splitlines()


def main(argv: Optional[List[str]] = None) -> int:
    ap = argparse.ArgumentParser(
        description="Regex scan for hard-coded secrets. Prints file:line:rule:masked-value. "
                    "Exit 0 = clean, 1 = findings, 2 = usage error.")
    ap.add_argument("paths", nargs="*", help="files or directories to scan")
    ap.add_argument("--stdin", action="store_true", help="scan text from stdin (e.g. `git log -p --all`)")
    ap.add_argument("--include-tests", action="store_true", help="also scan test/fixture directories")
    args = ap.parse_args(argv)

    if not args.paths and not args.stdin:
        ap.print_usage(sys.stderr)
        print("error: give at least one path or --stdin", file=sys.stderr)
        return 2

    findings: List[str] = []
    if args.stdin:
        findings += scan_text("<stdin>", sys.stdin.read().splitlines())
    for p in args.paths:
        if not os.path.exists(p):
            print("error: no such path: %s" % p, file=sys.stderr)
            return 2
        for f in iter_files(p, args.include_tests):
            lines = read_text(f)
            if lines is not None:
                findings += scan_text(os.path.relpath(f), lines)

    for line in findings:
        print(line)
    print("%d finding(s)" % len(findings), file=sys.stderr)
    return 1 if findings else 0


if __name__ == "__main__":
    sys.exit(main())
