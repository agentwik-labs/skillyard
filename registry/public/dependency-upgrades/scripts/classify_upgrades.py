#!/usr/bin/env python3
"""Classify pending dependency upgrades by semver risk and print a batch plan.

Input formats:
  npm     JSON from `npm outdated --json` (or `pnpm outdated --format json`)
  pip     JSON from `pip list --outdated --format json`
  simple  text lines: "<name> <current> <target>" (comments with #)

Usage:
  npm outdated --json > outdated.json; python3 classify_upgrades.py --format npm outdated.json
  pip list --outdated --format json | python3 classify_upgrades.py --format pip -
  python3 classify_upgrades.py --format simple deps.txt --security lodash,urllib3
  python3 classify_upgrades.py --format npm outdated.json --json

Exit code 0 on success, 1 on unreadable input. Stdlib only, Python 3.9+.
"""
import argparse
import json
import re
import sys

VERSION_RE = re.compile(r"(\d+)(?:\.(\d+))?(?:\.(\d+))?(.*)")
ORDER = ["security", "patch", "minor", "pre-1.0", "major", "prerelease", "unknown"]
ADVICE = {
    "security": "batch 1: apply first, smallest version that fixes the advisory",
    "patch": "batch 2: apply together, run tests once",
    "minor": "batch 3: group by area (test tooling, lint, runtime libs)",
    "pre-1.0": "one at a time: 0.x minors may break; read the changelog",
    "major": "one at a time: read the migration guide, search for affected APIs",
    "prerelease": "skip unless explicitly requested",
    "unknown": "inspect manually: version string not semver-like",
}


def parse(v):
    m = VERSION_RE.match(str(v).strip().lstrip("v^~=<> "))
    if not m:
        return None
    major, minor, patch, rest = m.groups()
    return int(major), int(minor or 0), int(patch or 0), rest or ""


def classify(current, target):
    c, t = parse(current), parse(target)
    if c is None or t is None:
        return "unknown"
    if re.search(r"(alpha|beta|rc|dev|pre|canary|next)", t[3], re.I):
        return "prerelease"
    if t[:3] <= c[:3]:
        return "unknown"
    if t[0] != c[0]:
        return "major"
    if c[0] == 0 and t[1] != c[1]:
        return "pre-1.0"
    if t[1] != c[1]:
        return "minor"
    return "patch"


def load(fmt, text):
    rows = []
    if fmt == "npm":
        data = json.loads(text or "{}")
        for name, info in data.items():
            if isinstance(info, list):  # workspaces may return a list per package
                info = info[0] if info else {}
            current = info.get("current") or info.get("wanted")
            target = info.get("latest")
            if current and target:
                rows.append((name, current, target))
    elif fmt == "pip":
        for item in json.loads(text or "[]"):
            rows.append((item["name"], item["version"], item["latest_version"]))
    else:
        for line in text.splitlines():
            line = line.split("#", 1)[0].strip()
            if not line:
                continue
            parts = line.replace("->", " ").split()
            if len(parts) >= 3:
                rows.append((parts[0], parts[1], parts[2]))
    return rows


def main(argv=None):
    p = argparse.ArgumentParser(
        description="Classify pending dependency upgrades into patch/minor/major/pre-1.0 "
        "batches. Exit 0 on success, 1 on bad input."
    )
    p.add_argument("file", help="input file, or '-' for stdin")
    p.add_argument("--format", choices=["npm", "pip", "simple"], default="simple")
    p.add_argument("--security", default="",
                   help="comma-separated package names with known advisories (put in batch 1)")
    p.add_argument("--json", action="store_true", help="emit JSON instead of text")
    a = p.parse_args(argv)

    try:
        text = sys.stdin.read() if a.file == "-" else open(a.file, encoding="utf-8").read()
        rows = load(a.format, text)
    except (OSError, ValueError, KeyError, TypeError) as exc:
        print("error: cannot parse input as %s: %s" % (a.format, exc), file=sys.stderr)
        return 1

    security = {s.strip().lower() for s in a.security.split(",") if s.strip()}
    buckets = {k: [] for k in ORDER}
    for name, cur, tgt in rows:
        kind = classify(cur, tgt)
        if name.lower() in security:
            buckets["security"].append({"name": name, "current": cur, "target": tgt, "semver": kind})
        else:
            buckets[kind].append({"name": name, "current": cur, "target": tgt, "semver": kind})

    if a.json:
        print(json.dumps({k: v for k, v in buckets.items() if v}, indent=2))
        return 0

    total = sum(len(v) for v in buckets.values())
    print("%d outdated package(s)" % total)
    for kind in ORDER:
        items = sorted(buckets[kind], key=lambda r: r["name"].lower())
        if not items:
            continue
        print("\n[%s] %d -- %s" % (kind, len(items), ADVICE[kind]))
        for r in items:
            extra = " (%s)" % r["semver"] if kind == "security" else ""
            print("  %-40s %s -> %s%s" % (r["name"], r["current"], r["target"], extra))
    return 0


if __name__ == "__main__":
    sys.exit(main())
