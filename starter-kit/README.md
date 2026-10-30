# Team skills starter kit

Get your team's AI agents (Claude Code, Codex, Cursor, anything that reads AGENTS.md) following the way your team
actually works. Plan on about three hours of total team time over two weeks.

```sh
npx -y https://github.com/agentwik-labs/skillyard/archive/refs/heads/main.tar.gz kit .   # copies this kit into your repo
```

## What you get

| File | What it's for |
|---|---|
| `SESSION.md` | The 30-minute kickoff: find what your team keeps re-explaining to agents |
| `REVIEW.md` | The checklist every skill PR goes through (from 12 real failure modes) |
| `templates/new-skill/` | Copy this to start a new skill: SKILL.md, skill.json, evals |
| `skills/data-handling/` | Fill-in-the-blanks rules for customer and sensitive data. Do this one first |
| `skills/definition-of-done/` | What "done" means on your team, so agents stop at the right place |
| `skills.json` | Which agents get which skills |
| `.github/workflows/skills.yml` | CI: format check and security scan on every skill change |

## The plan

**Week 1**
1. Run the kickoff (`SESSION.md`). You leave with a ranked list of 5 skills and an owner for each.
2. Fill in `skills/data-handling/` with your security or compliance lead. Replace every `TODO`.

**Week 2**
3. Each owner copies `templates/new-skill/` to `skills/<name>/` and writes their skill: 40–120 lines, rules a model couldn't guess.
4. Each owner adds 1–3 eval cases (a real task plus checks) and runs:
   `npx … eval skills/<name> --model haiku --runs 3`. Keep the skill if the score goes up; rewrite it if not.
5. Open a PR. A teammate reviews it with `REVIEW.md`; CI runs the format check and scan.
6. Merge, then everyone runs: `npx … install ./skills/* --agent claude,codex,cursor` (or `--agent all`).

**Every month (15 minutes)**
- The owner re-runs the evals after model upgrades. Skills that stopped helping get cut: they cost context on
  every task.
- Anyone who corrects an agent twice for the same thing writes it down as a skill change.

## Rules that save you later

- **Company content stays in company repos.** Never paste internal skills into personal repos or public registries.
- **Secrets never go in skills.** Skills reference environment variables or the secrets manager by name.
- **One job per skill, one owner per skill.** Contradictions come from shared, ownerless handbooks.
- **Measure.** In our tests a clear company runbook took an agent from 10% to 100%; a confident but wrong skill
  scored the same as no skill at all; and the generic version of `data-handling` added nothing, because current
  models already handle obvious personal data safely. Its value is your specifics. You can't tell which kind of
  skill you have without running it.
