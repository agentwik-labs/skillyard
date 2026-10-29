#!/usr/bin/env python3
"""Audit a Dockerfile for common security and reproducibility problems.

Usage:
  python3 audit_dockerfile.py Dockerfile [other/Dockerfile ...]
  python3 audit_dockerfile.py --strict Dockerfile      # warnings fail too

Checks: final stage runs as root, unpinned or :latest base images, missing
HEALTHCHECK, secret-looking ENV/ARG, ADD from URLs, curl|sh, apt/apk cache
left behind, shell-form CMD/ENTRYPOINT, COPY of the whole context before
dependency install, missing .dockerignore.

Exit code 0 if no errors (warnings allowed), 1 otherwise.
Stdlib only, Python 3.9+.
"""
import argparse
import os
import re
import sys

SECRET_NAME = re.compile(
    r"(PASSWORD|PASSWD|SECRET|TOKEN|API_?KEY|PRIVATE_?KEY|ACCESS_?KEY|CREDENTIALS?|AUTH)",
    re.I,
)
SECRET_VALUE = re.compile(
    r"(AKIA[0-9A-Z]{16}|ghp_[A-Za-z0-9]{30,}|sk_live_[A-Za-z0-9]+|xox[bap]-[A-Za-z0-9-]+|"
    r"-----BEGIN [A-Z ]*PRIVATE KEY-----|://[^/\s:]+:[^@\s]+@)"
)


def logical_lines(text):
    """Join backslash continuations; yield (start_line, instruction, args)."""
    buf, start = "", None
    for i, raw in enumerate(text.splitlines(), start=1):
        line = raw.rstrip()
        if not buf and (not line.strip() or line.lstrip().startswith("#")):
            continue
        if start is None:
            start = i
        if line.endswith("\\"):
            buf += line[:-1] + " "
            continue
        buf += line
        parts = buf.strip().split(None, 1)
        yield start, parts[0].upper(), parts[1] if len(parts) > 1 else ""
        buf, start = "", None
    if buf.strip():
        parts = buf.strip().split(None, 1)
        yield start, parts[0].upper(), parts[1] if len(parts) > 1 else ""


def audit(path):
    findings = []

    def add(sev, line, msg):
        findings.append((sev, line, msg))

    with open(path, encoding="utf-8") as fh:
        lines = list(logical_lines(fh.read()))

    stages, aliases = [], set()
    for ln, ins, args in lines:
        if ins == "FROM":
            stages.append({"line": ln, "user": None, "args": args})
            m = re.search(r"\bAS\s+(\S+)", args, re.I)
            if m:
                aliases.add(m.group(1).lower())
        elif ins == "USER" and stages:
            stages[-1]["user"] = args.strip()

    if not stages:
        return [("error", 1, "no FROM instruction found")]

    for st in stages:
        tokens = [t for t in st["args"].split() if not t.startswith("--")]
        image = tokens[0] if tokens else ""
        if image.lower() in aliases or image == "scratch" or image.startswith("$"):
            continue
        if "@sha256:" in image:
            continue
        name_tag = image.rsplit("/", 1)[-1]
        if ":" not in name_tag:
            add("error", st["line"], "base image %r has no tag (implicit :latest); pin a version" % image)
        elif name_tag.endswith(":latest"):
            add("error", st["line"], "base image %r uses :latest; pin a version" % image)
        else:
            add("info", st["line"], "consider pinning %r by digest (@sha256:...) for reproducible builds" % image)

    final_user = stages[-1]["user"]
    if final_user is None:
        final_image = stages[-1]["args"]
        if "nonroot" not in final_image:
            add("error", stages[-1]["line"], "final stage never sets USER; container runs as root")
    elif final_user.split(":")[0] in ("root", "0"):
        add("error", stages[-1]["line"], "final stage runs as root (USER %s)" % final_user)

    names = [ins for _, ins, _ in lines]
    if "HEALTHCHECK" not in names:
        add("warning", 1, "no HEALTHCHECK; add one or confirm the orchestrator probes the container")

    copied_all_before_install = False
    for ln, ins, args in lines:
        if ins in ("ENV", "ARG"):
            for key, val in re.findall(r"([A-Za-z_][A-Za-z0-9_]*)\s*[= ]\s*(\"[^\"]*\"|\S*)", args) or [(args.split("=")[0], "")]:
                if SECRET_NAME.search(key) and val.strip('"'):
                    add("error", ln, "%s %s looks like a secret baked into the image; use BuildKit secrets or runtime injection" % (ins, key))
                elif SECRET_NAME.search(key) and ins == "ARG":
                    add("warning", ln, "ARG %s: build args are visible in image history; use --mount=type=secret" % key)
            if SECRET_VALUE.search(args):
                add("error", ln, "%s contains a credential-looking value" % ins)
        if ins == "ADD":
            if re.search(r"https?://", args):
                add("error", ln, "ADD from URL: download with checksum verification instead")
            elif not re.search(r"\.(tar|tgz|tar\.gz|tar\.xz|tar\.bz2)\b", args):
                add("warning", ln, "use COPY instead of ADD unless extracting a tarball")
        if ins == "RUN":
            if re.search(r"(curl|wget)[^|;&]*\|\s*(sudo\s+)?(ba|z)?sh\b", args):
                add("error", ln, "piping a download into a shell; download, verify checksum, then run")
            if "apt-get install" in args:
                if "--no-install-recommends" not in args:
                    add("warning", ln, "apt-get install without --no-install-recommends")
                if "rm -rf /var/lib/apt/lists" not in args:
                    add("warning", ln, "apt cache not removed in the same RUN (rm -rf /var/lib/apt/lists/*)")
            if "apt-get update" in args and "apt-get install" not in args:
                add("warning", ln, "apt-get update in its own RUN gets cached stale; combine with install")
            if re.search(r"\bapk add\b", args) and "--no-cache" not in args:
                add("warning", ln, "apk add without --no-cache")
            if re.search(r"\bpip3? install\b", args) and "--no-cache-dir" not in args and "--mount=type=cache" not in args:
                add("info", ln, "pip install without --no-cache-dir leaves the wheel cache in the layer")
            if re.search(r"\bnpm install\b", args):
                add("warning", ln, "use 'npm ci' for lockfile-exact installs")
            if re.search(r"chmod\s+(-R\s+)?777\b", args):
                add("error", ln, "chmod 777 makes files world-writable")
            if re.search(r"\bsudo\b", args):
                add("warning", ln, "sudo in a Dockerfile; use USER switches instead")
            if copied_all_before_install and re.search(r"\b(npm ci|npm install|pip3? install|bundle install|go mod download|yarn install|pnpm install)\b", args):
                add("info", ln, "dependencies installed after copying the whole context; copy manifests first for better caching")
                copied_all_before_install = False
        if ins == "COPY" and re.search(r"(^|\s)\.\s+\S+$", args) and "--from" not in args:
            copied_all_before_install = True
        if ins in ("CMD", "ENTRYPOINT") and not args.strip().startswith("["):
            add("warning", ln, "%s in shell form; use exec form [\"bin\", \"arg\"] so signals reach the process" % ins)
        if ins == "EXPOSE":
            for port in re.findall(r"\d+", args):
                if int(port) < 1024 and final_user not in (None, "root", "0"):
                    add("info", ln, "non-root process binding port %s needs CAP_NET_BIND_SERVICE; prefer >1024" % port)

    ctx = os.path.dirname(os.path.abspath(path))
    if not os.path.exists(os.path.join(ctx, ".dockerignore")):
        add("warning", 1, "no .dockerignore next to the Dockerfile; .git, .env and keys may enter the build context")
    return findings


def main(argv=None):
    p = argparse.ArgumentParser(
        description="Audit Dockerfiles for root user, unpinned images, secrets, missing "
        "HEALTHCHECK and other hardening issues. Exit 0 if no errors, 1 otherwise."
    )
    p.add_argument("files", nargs="+", help="Dockerfile paths")
    p.add_argument("--strict", action="store_true", help="treat warnings as errors")
    p.add_argument("--quiet", action="store_true", help="hide info-level findings")
    a = p.parse_args(argv)

    errors = warnings = 0
    for path in a.files:
        try:
            findings = audit(path)
        except OSError as exc:
            print("%s: cannot read: %s" % (path, exc))
            errors += 1
            continue
        for sev, line, msg in sorted(findings, key=lambda f: f[1]):
            if sev == "info" and a.quiet:
                continue
            print("%s:%d: %s: %s" % (path, line, sev, msg))
            errors += sev == "error"
            warnings += sev == "warning"
    print("%d error(s), %d warning(s)" % (errors, warnings))
    return 1 if errors or (a.strict and warnings) else 0


if __name__ == "__main__":
    sys.exit(main())
