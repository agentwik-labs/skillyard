---
name: commit-messages
description: Writes and checks git commit messages in Conventional Commits format with an imperative subject, a body that explains why, and correct breaking-change footers; includes a dependency-free linter. Use when asked to "write a commit message", "commit this", "fix my commit message", "squash and reword", or before any git commit the agent makes.
license: MIT
---

# Commit Messages

Write commit messages that let a future reader understand why a change was made without opening the diff, and that tools (changelog generators, semantic-release, `git log --grep`) can parse. Follow Conventional Commits 1.0 unless the repository clearly uses another convention, in which case follow the repository.

## Workflow

1. **Check the repo's convention first.** Run `git log --oneline -20`. If recent commits use a different style (ticket prefixes like `ABC-123:`, gitmoji, plain sentences), match it and skip the type prefix rules below. Check for `commitlint.config.*`, `.commitlintrc*` or a `commit-msg` hook; they override this skill.
2. **Inspect what is staged.** Run `git diff --staged --stat` and read `git diff --staged`. Commit only what is staged; never stage extra files to "complete" the commit without being asked.
3. **Split if needed.** If the staged diff contains two unrelated changes (a bug fix and a refactor, a feature and a dependency bump), propose splitting it into separate commits. One commit, one logical change.
4. **Pick the type and scope** (table below).
5. **Write the subject, then the body, then footers.**
6. **Lint it.** Save the message to a file and run `python3 scripts/lint_commit.py <file>` (or pipe it: `git log -1 --format=%B | python3 scripts/lint_commit.py -`). Fix every error before committing. Warnings are judgment calls.
7. **Commit with the file** (`git commit -F <file>`) so line breaks survive. Never use `--no-verify` to skip hooks.

## Types

| Type | Use for |
|---|---|
| `feat` | A user-visible capability is added |
| `fix` | A user-visible bug is fixed |
| `perf` | Faster or cheaper, same behavior |
| `refactor` | Internal restructuring, no behavior change |
| `test` | Tests only |
| `docs` | Documentation only |
| `build` | Build system, packaging, dependencies |
| `ci` | CI configuration |
| `chore` | Anything else that does not touch src or tests |
| `revert` | Reverts a previous commit |

Scope is optional, lowercase, and names the area (`feat(auth): ...`). Use the module or package name the team already uses; do not invent a new one per commit.

## Subject rules

- Format: `type(scope)!: summary` — the `!` only for breaking changes.
- Imperative mood: "add", "fix", "remove" — not "added", "fixes", "adding". Test: "If applied, this commit will <summary>."
- Lowercase first word after the colon, no trailing period.
- 72 characters maximum for the whole line; aim for 50.
- Say what changed in behavior, not which file: `fix(cart): keep discount when quantity changes`, not `fix: update cart.ts`.

## Body rules

- Blank line between subject and body.
- Wrap at 72 columns.
- Explain **why** and the **user-visible effect**. The diff already shows what.
- Mention the alternative you rejected if a reviewer would ask.
- Do not paste the diff, a file list, or "this commit does X".

## Footers

- `BREAKING CHANGE: <what breaks and how to migrate>` — required whenever `!` is used, and whenever a public API, config key, CLI flag, or stored format changes incompatibly.
- `Refs: #123`, `Closes: #123` — use the tracker's syntax.
- Only add trailers (`Co-authored-by`, `Signed-off-by`) the project or user asks for.

## Example

Bad:

```
Updated stuff in the user service.
```

Good:

```
fix(users): reject signup when email differs only by case

Signups for "Ann@x.com" and "ann@x.com" created two accounts because
the uniqueness check compared raw strings. Normalize to lowercase
before the lookup and add a unique index on lower(email).

Closes: #482
```

Breaking:

```
feat(api)!: return amounts as integer cents

BREAKING CHANGE: `amount` in /v2/invoices is now an integer number of
cents instead of a decimal string. Clients must divide by 100.
```

## Output

Return the final commit message in a fenced code block, followed by one line with the linter result (`lint_commit.py: OK` or the warnings you chose to keep and why). If you are making the commit yourself, show the message and the resulting `git log -1 --oneline`.
