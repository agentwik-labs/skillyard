---
name: code-review
description: Reviews a diff, branch or pull request for correctness bugs, security holes, missing tests and maintainability problems, and reports ranked findings with file:line references and concrete fixes. Use when asked to "review this PR", "review my changes", "look over this diff before I merge", "is this safe to ship", or when finishing a change and a second read is needed before committing.
license: MIT
---

# Code Review

Find the defects that would hurt in production, explain each one so the author can act on it in under a minute, and stay quiet about everything else. A review is judged by the bugs it catches and the noise it avoids, not by its length. Read the change in context, verify claims against the code, and rank findings by impact.

## Workflow

1. **Establish the scope.** Get the exact diff (`git diff <base>...HEAD`, the PR diff, or the files named). Note the base branch. Do not review unrelated code unless the change breaks it.
2. **Learn the intent.** Read the PR description, linked issue, commit messages and any tests added. Write one sentence stating what the change is supposed to do. If you cannot, that is your first finding.
3. **Read surrounding code.** For every changed function, open its callers and callees. Most real bugs live at the boundary between changed and unchanged code (a new return value the caller ignores, a renamed field still read elsewhere).
4. **Walk the risk checklist below** against each hunk.
5. **Verify before reporting.** For each suspected bug, trace a concrete input that triggers it. If the project has tests, run the relevant ones. Drop any finding you cannot back with a trace or a reproduction; mark the rest with your confidence.
6. **Rank and write up** using the Output format.

## Risk checklist (in priority order)

1. **Correctness**
   - Off-by-one, inverted conditions, wrong operator precedence, `=` vs `==`.
   - Null/undefined/empty-collection paths. What happens on the first run, with zero items, with one item?
   - Error paths: is every error handled, propagated, or deliberately ignored with a comment? Swallowed exceptions are bugs until proven otherwise.
   - Concurrency: shared mutable state, check-then-act races, missing `await`, unawaited promises, goroutines without cancellation.
   - Time and money: time zones, DST, floating-point currency, integer overflow.
2. **Security**
   - Untrusted input reaching SQL, shell, file paths, HTML, templates, deserializers, or redirects without parameterization/escaping.
   - AuthZ: does every new endpoint or query check that *this* user may access *this* record? Missing object-level checks (IDOR) are the most common real-world hole.
   - Secrets in code, logs, error messages or client bundles.
   - New dependencies: are they maintained, pinned, and actually needed?
3. **Data and compatibility**
   - Schema or API changes that break existing clients, stored data, queued messages or cached values.
   - Migrations that lock large tables or are not reversible (see the database-migrations skill).
4. **Tests**
   - Does a test fail without the change? Tests that only assert "no exception" do not count.
   - Are the edge cases from item 1 covered?
5. **Performance** — only where it matters: N+1 queries, unbounded loops over user-controlled sizes, loading whole tables into memory, work inside hot loops.
6. **Maintainability** — misleading names, duplicated logic that will drift, dead code, comments that contradict the code.

## Rules

- **Severity is about consequences, not taste.** Use: `blocker` (data loss, security hole, crash on a common path), `major` (wrong behavior on a realistic path), `minor` (edge case, maintainability cost), `nit` (style; at most three, and only if no linter covers it).
- **One finding, one problem.** Do not bundle.
- **Always propose a fix**, as a code snippet or a precise instruction. "Consider handling errors" is not a fix.
- **Do not restate the diff.** The author knows what they changed.
- **Do not flag what tooling enforces** (formatting, import order) unless the tooling is missing.
- **Respect project conventions** even when you prefer others. Consistency beats your preference.
- **Say what you did not check** (e.g. "did not run integration tests", "did not review generated files").
- **If the change is good, say so in one line.** Do not invent findings to look thorough.

## Example

Bad finding:

> The error handling here could be improved. Consider adding more robust checks.

Good finding:

> **major** `api/orders.py:88` — `get_order(order_id)` is called without checking `order.user_id == request.user.id`, so any logged-in user can read any order by ID. Trace: user 7 requests `/orders/1234` owned by user 9, returns 200 with the order.
> Fix:
> ```python
> order = get_order(order_id)
> if order is None or order.user_id != request.user.id:
>     raise NotFound()
> ```

## Output

Produce exactly this, in Markdown:

1. **Summary** — one or two sentences: what the change does and your verdict (`approve`, `approve with fixes`, `request changes`).
2. **Findings** — a list ordered by severity. Each item: severity, `path:line`, the problem, a trigger/trace, and the fix. Mark low-confidence items `(unverified)`.
3. **Tests** — what you ran and the result, or "not run" with the reason.
4. **Not reviewed** — anything out of scope or skipped.

If there are no findings above `nit`, say "No blocking issues found" and list at most three nits.
