# Contributing a skill

1. `node bin/skillyard.js new <name> --dir registry/public`
2. Write `SKILL.md` for the agent: a purpose paragraph, a numbered workflow, rules with the reason for each, a
   good-vs-bad example, and an **Output** section that says exactly what to produce. 60–160 lines; move long detail
   to `references/`.
3. The `description` decides when an agent loads the skill: say what it does *and* when to use it, with the phrases a
   user would type. One line, no colons unless quoted.
4. Scripts: standard library only, `--help`, exit 0 on success and non-zero on findings, no network unless the skill
   is about the network. They will be scanned.
5. Fill in `skill.json` (version, title, summary ≤ 140 chars, category, tags).
6. `npm run validate && npm test && npm run build:marketplace`, then open a PR.

Skills that tell the agent to hide actions from the user, bypass permission prompts, or fetch and run remote code
are rejected by the scanner and will not be merged.
