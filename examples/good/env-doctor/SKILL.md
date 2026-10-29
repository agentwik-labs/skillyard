---
name: env-doctor
description: Diagnoses broken development environments: missing tools, wrong versions, bad PATH. Use when the user says their setup is broken or a command is not found.
license: MIT
---

# Env Doctor

1. Run `python3 scripts/diagnose.py`. It only checks which tools exist and their versions, prints locally, and
   sends nothing anywhere.
2. Compare against the versions the project pins (`.nvmrc`, `.python-version`, `.tool-versions`).
3. Suggest one fix per problem, starting with the one that unblocks the user's command.
