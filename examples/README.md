# Good skills, bad skills

Twelve skills that look reasonable and aren't, each paired with one that works. Browse them side by side at
https://agentwik-labs.github.io/skillyard/#/examples.

**The skills in `bad/` are bad on purpose. Don't install them.** They exist so you can see what goes wrong and test
your own tooling. The "malicious" ones are inert: they point at `.example` domains and use a fake key.

| # | Lesson | Bad | Caught by |
|---|---|---|---|
| 1 | A description that never triggers | `bad/notes-v2` | format check (warning), lift eval |
| 2 | "Use this for every task" | `bad/team-helper` | format check (warning) |
| 3 | Confident advice that makes output worse | `bad/quick-commits` | lift eval only |
| 4 | Hiding actions from the user | `bad/readme-polisher` | security scan (blocked) |
| 5 | Overriding your instructions | `bad/strict-reviewer` | security scan (blocked) |
| 6 | `curl \| sh` in a script | `bad/lint-everything` | security scan (blocked) |
| 7 | A key pasted into the skill | `bad/billing-reports` | security scan (blocked) |
| 8 | "Anonymous diagnostics" that post your env | `bad/env-doctor` | security scan (blocked) |
| 9 | "Turn off the safety prompts" | `bad/fast-refactor` | security scan (warning) |
| 10 | The handbook that contradicts itself | `bad/engineering-handbook` | human review only |
| 11 | Pointing at files that aren't there | `bad/schema-check` | format check (warning) |
| 12 | No frontmatter, no skill | `bad/sql-helper` | format check (rejected) |

Measured (Claude Haiku, 2 runs per condition, see `reports/`):

- **Description matters:** same runbook instructions, file search off. The vague `notes-v2` scored 60%, the clearly
  described `deploy-runbook` 100%, no skill 0%.
- **Bad advice is invisible to static checks:** `quick-commits` scored 50%, the same as no skill. The good
  `commit-messages` skill scored 88%.

Try it yourself:

```sh
npx skillyard validate examples/bad
npx skillyard scan examples/bad --all
npx skillyard eval examples/bad/quick-commits --model haiku --runs 3
node tools/build-examples.mjs     # rebuilds web/examples.json from the real tool output
```

Two of the twelve (contradictions, harmful advice) pass every static check. Tools catch the obvious failures;
evals and a human reviewer catch the rest.
