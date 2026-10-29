#!/usr/bin/env python3
"""Lint a git commit message against Conventional Commits 1.0.

Usage:
  python3 lint_commit.py MESSAGE_FILE
  git log -1 --format=%B | python3 lint_commit.py -
  python3 lint_commit.py --types feat,fix,chore MESSAGE_FILE

Exit code 0 if there are no errors (warnings allowed), 1 otherwise.
Stdlib only, Python 3.9+.
"""
import argparse
import re
import sys

DEFAULT_TYPES = [
    "feat", "fix", "perf", "refactor", "test", "docs",
    "build", "ci", "chore", "revert", "style",
]
SUBJECT_RE = re.compile(
    r"^(?P<type>[a-z]+)(?:\((?P<scope>[^()\s]+)\))?(?P<bang>!)?: (?P<summary>.+)$"
)
NON_IMPERATIVE = re.compile(
    r"^(added|adds|adding|fixed|fixes|fixing|updated|updates|updating|"
    r"removed|removes|removing|changed|changes|changing|created|creates|"
    r"implemented|implements|refactored|refactors|renamed|renames)\b",
    re.IGNORECASE,
)
FOOTER_RE = re.compile(r"^([A-Za-z-]+|BREAKING CHANGE)(: | #)")


def lint(message, types, max_subject=72, max_body=72):
    errors, warnings = [], []
    lines = [l for l in message.splitlines() if not l.startswith("#")]
    while lines and not lines[-1].strip():
        lines.pop()
    if not lines or not lines[0].strip():
        return ["message is empty"], warnings

    subject = lines[0]
    if subject.startswith(("Merge ", 'Revert "', "fixup! ", "squash! ")):
        return errors, ["git-generated subject; skipped type checks"]

    m = SUBJECT_RE.match(subject)
    if not m:
        errors.append(
            "subject must match 'type(scope)!: summary' (got: %r)" % subject
        )
    else:
        if m.group("type") not in types:
            errors.append(
                "unknown type %r; allowed: %s" % (m.group("type"), ", ".join(types))
            )
        summary = m.group("summary")
        if summary.endswith("."):
            errors.append("subject must not end with a period")
        if summary[:1].isupper() and not summary.split()[0].isupper():
            warnings.append("start the summary with a lowercase word")
        if NON_IMPERATIVE.match(summary):
            errors.append(
                "use imperative mood ('add', not '%s')" % summary.split()[0]
            )
        if len(summary.split()) < 2:
            warnings.append("summary is a single word; say what changed")
    if len(subject) > max_subject:
        errors.append("subject is %d chars; max %d" % (len(subject), max_subject))

    if len(lines) > 1 and lines[1].strip():
        errors.append("line 2 must be blank (separate subject from body)")

    for i, line in enumerate(lines[2:], start=3):
        if len(line) > max_body and not re.match(r"^\s*(https?://|\S+$)", line):
            warnings.append("line %d is %d chars; wrap at %d" % (i, len(line), max_body))

    body = "\n".join(lines[2:])
    has_breaking_footer = re.search(r"^BREAKING[ -]CHANGE: \S", body, re.M)
    if m and m.group("bang") and not has_breaking_footer:
        warnings.append("'!' used without a 'BREAKING CHANGE:' footer explaining migration")
    if re.search(r"^breaking change:", body, re.M | re.I) and not has_breaking_footer:
        errors.append("breaking change footer must be exactly 'BREAKING CHANGE: <text>'")
    return errors, warnings


def main(argv=None):
    p = argparse.ArgumentParser(
        description="Lint a commit message against Conventional Commits. "
        "Exit 0 when there are no errors, 1 otherwise."
    )
    p.add_argument("file", help="path to the message file, or '-' for stdin")
    p.add_argument("--types", default=",".join(DEFAULT_TYPES),
                   help="comma-separated allowed types (default: %(default)s)")
    p.add_argument("--max-subject", type=int, default=72)
    p.add_argument("--strict", action="store_true", help="treat warnings as errors")
    a = p.parse_args(argv)

    if a.file == "-":
        message = sys.stdin.read()
    else:
        try:
            with open(a.file, encoding="utf-8") as fh:
                message = fh.read()
        except OSError as exc:
            print("error: %s" % exc, file=sys.stderr)
            return 1

    errors, warnings = lint(message, [t.strip() for t in a.types.split(",") if t.strip()],
                            max_subject=a.max_subject)
    for e in errors:
        print("error: " + e)
    for w in warnings:
        print("warning: " + w)
    failed = bool(errors) or (a.strict and bool(warnings))
    if not errors and not warnings:
        print("OK")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
