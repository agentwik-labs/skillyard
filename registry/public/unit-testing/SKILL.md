---
name: unit-testing
description: Writes fast, deterministic unit tests that pin down behavior through public interfaces, cover edge cases and error paths, and fail for exactly one reason, using the project's existing test framework and conventions. Use when asked to "write tests for this", "add unit tests", "increase coverage", "test this function", "add a regression test", or after implementing or fixing code that has no tests.
license: MIT
---

# Unit Testing

Write tests that catch regressions and document behavior, not tests that mirror the implementation. A good unit test runs in milliseconds, never flakes, fails for one clear reason, and survives a refactor that keeps behavior the same. Match the project's framework and style; do not introduce a new test library.

## Workflow

1. **Find the existing setup.** Locate the test directory, framework and runner (`pytest`, `unittest`, `jest`, `vitest`, `go test`, `cargo test`, `JUnit`, `RSpec`, `xUnit`). Read two existing test files and copy their structure, naming, fixtures and assertion style.
2. **Run the current suite once** to know the baseline (and which tests already fail).
3. **List behaviors, not functions.** For the unit under test, write down: the main success case, boundary values, empty/null/zero inputs, invalid input and the error raised, and any branch in the code. Each becomes a test.
4. **Write the tests** following the rules below.
5. **Prove each test can fail.** Temporarily break the code under test (flip a condition, return a constant) and confirm the test goes red, then restore. A test that cannot fail is worthless.
6. **Run the full relevant suite** and make sure nothing else broke and the new tests pass in random order if the runner supports it (`pytest -p random_order`, `jest --randomize`, `go test -shuffle=on`).

## Rules

- **Test through the public interface.** Do not test private methods directly or assert on internal state; test what callers observe. Private logic that needs its own tests probably wants to be its own unit.
- **Arrange, Act, Assert.** One act per test. Blank lines between the three phases.
- **One behavior per test**, named as a sentence: `test_rejects_expired_token`, `it("returns empty list when no orders match")`. The name should explain the failure without reading the body.
- **Assert specific values.** `assert total == Decimal("19.98")`, not `assert total` or `assert total is not None`. Check error type *and* message substring for error paths.
- **Deterministic always.** Inject or freeze time (`freezegun`, fake timers, a clock parameter), seed randomness, avoid real network, real file system outside temp dirs, and real sleeps.
- **Mock only at boundaries you do not own**: network, clock, external services, OS. Do not mock the class under test or simple value objects. If a test needs five mocks, the design is telling you something; note it.
- **Prefer fakes over mocks** for repositories and services (an in-memory implementation), so tests assert outcomes, not call sequences.
- **Use table-driven / parametrized tests** for many input-output pairs (`@pytest.mark.parametrize`, `test.each`, Go table tests). Each case gets a readable id.
- **No logic in tests.** No loops or conditionals computing expected values; write the expected value literally.
- **Independent tests.** No shared mutable state, no reliance on order. Each test builds its own data with small factory helpers.
- **Keep them fast.** A unit test over ~100 ms is suspicious; find the I/O.
- **Coverage is a flashlight, not a target.** Use it to find untested branches; do not write assertion-free tests to raise a number.

## Edge-case prompts

Empty string, empty list, single element, duplicates, very large values, negative numbers, zero, `None`/`null`/`undefined`, Unicode and emoji, whitespace-only strings, leap days and DST transitions, time zones, concurrent calls, the exact boundary (`<` vs `<=`) on both sides.

## Example

Bad:

```python
def test_discount():
    cart = Cart()
    cart.add(Item(price=10))
    cart.apply_discount("SAVE10")
    assert cart._discount_applied          # private state
    assert cart.total() is not None        # asserts nothing useful
```

Good:

```python
@pytest.mark.parametrize("subtotal, code, expected", [
    (Decimal("100.00"), "SAVE10", Decimal("90.00")),
    (Decimal("9.99"),   "SAVE10", Decimal("9.99")),   # below minimum
    (Decimal("100.00"), "BOGUS",  Decimal("100.00")),
], ids=["applies", "below-minimum", "unknown-code"])
def test_total_after_discount(subtotal, code, expected):
    cart = make_cart(subtotal=subtotal)

    cart.apply_discount(code)

    assert cart.total() == expected
```

## Output

Return the new or changed test files, then a short report: behaviors covered (one line each), the command used to run them, the pass/fail result, and confirmation that each new test was seen failing when the code was broken. List any behavior you chose not to test and why (e.g. "needs integration test: real DB constraint").
