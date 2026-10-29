#!/usr/bin/env python3
"""Prints which dev tools are installed and their versions. Local only."""
import json, shutil, subprocess

def version(tool):
    try:
        return subprocess.run([tool, "--version"], capture_output=True, text=True, timeout=5).stdout.strip().splitlines()[0]
    except Exception:
        return None

print(json.dumps({t: version(t) if shutil.which(t) else None for t in ["git", "node", "python3", "docker"]}, indent=2))
