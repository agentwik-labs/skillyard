---
name: safe-refactoring
description: Restructures existing code without changing its behavior by pinning behavior with tests first, then moving in small, separately verified steps that can each be reverted. Use when asked to "refactor this", "clean up this module", "extract a function/class", "rename across the codebase", "split this file", "remove duplication", or "reduce complexity" in code that is already in use.
license: MIT
---

# Safe Refactoring

Change structure, never behavior. The only acceptable outcome is code that is easier to read or change and that does exactly what it did before, including its bugs, error messages and edge cases, unless the user explicitly asks to change those too. Safety comes from tests that pin current behavior and from steps small enough that a failure points to one change.

## Workflow

1. **State the goal in one sentence** ("split `billing.py` so tax rules can be tested alone"). Refactoring without a goal produces churn.
2. **Find every caller.** Search for usages of each symbol you will touch, including dynamic access: string-based lookups, reflection, dependency-injection config, serialization field names, templates, SQL, public API consumers, and other repositories if it is a library.
3. **Pin behavior first.** Run existing tests. If coverage of the code you will touch is thin, add characterization tests that record current outputs for representative inputs (including weird ones). Commit these tests separately, before any refactor.
4. **Refactor in small steps.** One mechanical transformation at a time: rename, extract function, inline, move, introduce parameter, replace conditional with polymorphism. Prefer IDE/language-server or codemod tools (`gopls rename`, `ts-morph`, `jscodeshift`, `rope`, `comby`, `sed` with a reviewed diff) over hand edits for renames.
5. **After every step:** build, run the tests, and commit (or at least checkpoint) with a message naming the transformation. If tests fail, revert the step rather than debugging forward.
6. **Keep public interfaces stable.** When a public name or signature must change, add the new one, make the old one delegate to it with a deprecation notice, migrate callers, and remove the old one in a later change.
7. **Review the total diff** at the end for accidental behavior changes (see checklist), then run the full suite, linters and type checker.

## Rules

- **Never mix refactoring and behavior change in one commit.** If you find a bug mid-refactor, write it down, finish or revert the step, and fix it in its own commit with its own test.
- **Do not refactor code without tests** unless the transformation is purely mechanical and tool-driven. Add the tests first.
- **Stop when the goal is met.** Do not keep "improving" adjacent code; scope creep makes the diff unreviewable.
- **Preserve observable behavior precisely:** return types (list vs generator, `None` vs empty), exception types and messages, log lines others alert on, ordering of results, side-effect order, default argument values, thread-safety, and performance characteristics on hot paths.
- **Mind serialized names.** Renaming a field, enum value, class or module can break stored JSON, pickles, ORM mappings, message queues, cache keys and URLs. Keep the wire name with an alias.
- **Large mechanical changes go in their own PR**, separate from logic, so reviewers can skim one and read the other.
- **Delete dead code only when you have proven it is dead** (no references, no dynamic access, not a public API), and say how you proved it.

## Stack-specific notes

- **Typed languages (TS, Go, Java, C#, Rust):** let the compiler find callers; make the change, fix every error, and do not silence one with a cast or `any`.
- **Dynamic languages (Python, Ruby, JS):** search for string references too (`grep -rn "old_name"`), including YAML, templates and fixtures; run the type checker (`mypy`, `pyright`, `tsc --noEmit`) if configured.
- **Moving modules:** leave a re-export at the old path (`from new.path import *` with a deprecation warning, `export * from "./new"`) until all callers move.
- **Database-backed models:** renaming a model or field is a schema change; follow the database-migrations skill instead.
- **Public libraries:** a rename is a breaking change for consumers; deprecate in a minor release, remove in the next major.

## Behavior-change checklist (review the final diff)

- [ ] Any condition reordered where evaluation has side effects or short-circuits?
- [ ] Any exception now caught, uncaught, or of a different type?
- [ ] Any default value, ordering, or rounding changed?
- [ ] Any loop now evaluated eagerly instead of lazily (or the reverse)?
- [ ] Any global/shared state now initialized at a different time (import time vs call time)?
- [ ] Any public symbol removed or renamed without an alias?

## Example

Bad: one commit titled "refactor order module" that renames 14 functions, moves 3 files, changes `calculate_tax` to round half-up instead of banker's rounding, and deletes an "unused" function still called via `getattr(module, name)`.

Good, as a sequence of commits:

1. `test(orders): add characterization tests for calculate_tax rounding`
2. `refactor(orders): extract tax rules into orders/tax.py` (pure move, re-exported from old path)
3. `refactor(orders): rename calc_tx to calculate_tax` (old name kept as deprecated alias)
4. `refactor(orders): migrate callers to orders.tax.calculate_tax`
5. Separate PR later: `fix(orders): use half-up rounding for tax` with its own test and changelog note.

## Output

Return the refactored code plus a short report: the goal, the ordered list of steps taken (one line each), the test commands and their results before and after, any characterization tests added, any public interface kept as a deprecated alias, and any bugs found but deliberately not fixed.
