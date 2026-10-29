---
name: systematic-debugging
description: Finds the root cause of a bug by reproducing it, forming one falsifiable hypothesis at a time, bisecting, and proving the fix with a failing-then-passing test, instead of guessing and patching symptoms. Use when the user reports an error, stack trace, crash, flaky test, wrong output, regression, "it works locally but not in CI/prod", "this broke after the deploy", or when a first fix attempt did not work.
license: MIT
---

# Systematic Debugging

Find the actual cause before changing code. Most wasted debugging time comes from fixing a guess, seeing the symptom move, and stacking a second guess on top. Work like an experiment: reproduce, observe, hypothesize, test, and only then fix. Every step should shrink the search space.

## Workflow

1. **Capture the symptom exactly.** Full error message, stack trace, exit code, input, environment (OS, runtime version, commit SHA, config, feature flags). Copy text; do not paraphrase errors.
2. **Reproduce it.** Get a command that shows the failure on demand. Shrink it: smallest input, fewest steps, single test (`pytest path::test -x`, `go test -run Name`, `jest -t name`). If you cannot reproduce, go to "Cannot reproduce" below; do not start editing code.
3. **Write the failing test now** if the bug is testable. It is your reproduction and your proof of fix.
4. **Read the error from the bottom of your own code up.** Find the first stack frame in project code (not library code). Read that function fully, plus its callers.
5. **List hypotheses, then rank them** by likelihood times cheapness to check. Write them down.
6. **Test one hypothesis at a time** with an observation that can prove it wrong: a log line, a debugger breakpoint, an assertion, printing the actual value. Change one variable per experiment.
7. **Bisect when the cause is not obvious.**
   - In history: `git bisect start <bad> <good>` then `git bisect run <repro command>`.
   - In code: comment out or short-circuit half the path; see which half the bug lives in.
   - In data: halve the input until the minimal failing case remains.
   - In environment: diff dependency lockfiles, env vars and config between working and failing setups.
8. **State the root cause** in one sentence that explains every observed symptom. If it does not explain all of them, you are not done.
9. **Fix the cause, not the symptom.** Then run the failing test (now passing), the surrounding test suite, and the original reproduction.
10. **Clean up.** Remove debug prints, temporary flags and commented-out code.

## Rules

- **No fix without a reproduction**, except for trivially provable bugs (typo with an obvious trace). A fix you cannot demonstrate is a guess.
- **Read the actual value, never assume it.** "It should be a list here" is a hypothesis; print it.
- **Two failed fixes means stop and re-observe.** Revert both, go back to step 4, and question the assumption both fixes shared.
- **Do not add try/except, null checks, retries or sleeps to make the symptom disappear** unless the root cause is genuinely external and you say so. They hide bugs.
- **Distrust "it can't be X".** Check X anyway if it is cheap: the cache, the stale build, the wrong virtualenv, the env var not loaded, the file you edited is not the file that runs.
- **Check recent changes first.** `git log -p --since=3.days -- <path>` and dependency bumps are the cheapest hypotheses.
- **Flaky tests are real bugs.** Usual causes: shared state between tests, ordering, time, randomness without a seed, network, timeouts too tight, unawaited async. Run the test in a loop (`for i in $(seq 50); do <cmd> || break; done`) to confirm flakiness and then the fix.

## Stack-specific quick wins

- **Python:** `python -X dev`, `PYTHONFAULTHANDLER=1`, `breakpoint()`, `pytest --pdb -x`, `py-spy dump --pid` for hangs.
- **Node.js:** `node --inspect-brk`, `NODE_OPTIONS=--trace-warnings`, `--unhandled-rejections=strict` to surface lost promise errors.
- **Go:** `go test -race`, `GOTRACEBACK=all`, `dlv test`; send SIGQUIT to dump all goroutines on a hang.
- **JVM:** `jstack <pid>` for deadlocks, `-XX:+HeapDumpOnOutOfMemoryError`.
- **Browsers:** DevTools "Pause on caught exceptions", the Network tab's actual response body, disable cache.
- **Containers/CI:** reproduce inside the same image (`docker run -it <ci-image> sh`), not on your laptop.

## Cannot reproduce

- Collect more evidence instead of guessing: logs around the timestamp, request IDs, the exact build/commit deployed, data that differs from local.
- Compare environments systematically: runtime version, dependency versions, OS, locale/time zone, CPU count, env vars, file system case sensitivity.
- Add targeted logging or metrics on the suspected path, ship it, and wait for the next occurrence. Say so explicitly instead of shipping a speculative fix.

## Example

Bad: "TypeError: cannot read 'id' of undefined" in `renderOrder` → add `if (!order) return null` → bug now shows as a blank screen.

Good: reproduce with order 551 → print `order` in `renderOrder`: undefined → caller `useOrder` returns undefined when the API responds 200 with `{data: null}` for archived orders → hypothesis confirmed by curl → root cause: API returns null for archived orders and the client treats 200 as found → fix: API returns 404 for archived, client shows "Order archived" on 404 → regression test `test_archived_order_returns_404` fails before, passes after.

## Output

Report in this order:

1. **Symptom** — the exact error and the reproduction command.
2. **Root cause** — one or two sentences, with `file:line`.
3. **Evidence** — the observations that confirmed it (and the hypotheses ruled out, one line each).
4. **Fix** — what changed and why it addresses the cause.
5. **Verification** — the test added and the commands run with results.
6. **Open risks** — related places that may have the same bug, if any.
