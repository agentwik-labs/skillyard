---
name: definition-of-done
description: What "done" means on TODO team before an agent reports a coding task as finished: tests, types, lint, docs, migrations and the PR description. Use when finishing any code change, before saying "done", before opening a pull request, or when asked "is this ready?".
license: Proprietary
---

# Definition of Done

Agents tend to stop when the code compiles. On this team a change is done when a reviewer can merge it without
asking a question. Check every item; report any you could not do instead of skipping it silently.

## Checklist

1. **Tests:** new behavior has a test that fails without the change. Run `TODO test command` and paste the summary.
2. **Types and lint:** `TODO typecheck command` and `TODO lint command` pass with no new warnings.
3. **No leftovers:** no debug prints, commented-out code, `TODO` without a ticket, or unrelated formatting changes.
4. **Data changes:** schema changes come with a migration (TODO path) and a rollback note.
5. **Config and flags:** new settings are documented in TODO (e.g. `.env.example`) and default to off.
6. **Docs:** user-visible changes update TODO (README / docs site / changelog).
7. **PR description:** what changed, why, how it was tested, and anything risky, in that order.

## Rules

- Never claim a check passed without running it. If a command can't run here, say so.
- If finishing would take an item out of scope (a big refactor, a new dependency), stop and ask.

## Output

End with the checklist: each item marked done, not applicable (with a reason), or not done (with what's missing).
