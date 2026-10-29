---
name: performance-profiling
description: Diagnoses and fixes slow code by measuring first, profiling the real workload, finding the dominant cost, changing one thing, and proving the improvement with before/after numbers; covers CPU, memory, I/O, database and frontend latency across languages. Use when asked "why is this slow", "speed up this endpoint/script/query/page", "reduce memory usage", "profile this", "p99 latency went up", or "this job takes too long".
license: MIT
---

# Performance Profiling

Make code measurably faster where it matters, and only there. Intuition about where time goes is usually wrong; the profiler is usually right. Measure, find the single biggest cost, fix it, measure again. Stop when the target is met.

## Workflow

1. **Define the target.** What metric (p50/p95/p99 latency, throughput, wall time, peak RSS, page LCP), current value, goal value, and on what workload. "Faster" is not a target. If no goal is given, propose one.
2. **Build a repeatable benchmark** that exercises the real path with realistic data sizes. Run it at least 5 times; report median and spread. Warm up JITs and caches first, or measure cold explicitly if cold start is the issue.
3. **Classify the bottleneck** before optimizing: CPU-bound (a core at 100%), I/O or network-bound (low CPU, waiting), database-bound (time in queries), memory-bound (GC pauses, swapping), or lock contention. `time` (user+sys vs real), `top`/`htop`, and request tracing usually answer this in a minute.
4. **Profile with the right tool** (table below). Prefer sampling profilers on production-like builds; instrumenting profilers distort small functions.
5. **Read the profile top-down**: find the widest frames in the flame graph / highest cumulative time. Look for the one thing that dominates. If the top item is under 10% of total, the cost is spread out and needs an algorithmic or architectural change, not micro-tuning.
6. **Form a hypothesis and change one thing.**
7. **Re-run the same benchmark.** Keep the change only if the improvement is larger than the run-to-run noise. Verify the output is still identical (same results, same tests pass).
8. **Repeat from step 5** until the target is met, then stop.

## Tools by stack

| Stack | CPU | Memory | Notes |
|---|---|---|---|
| Python | `py-spy record -o out.svg -- python app.py`, `cProfile` + `snakeviz` | `tracemalloc`, `memray` | `py-spy dump` on a hung process |
| Node.js | `node --cpu-prof`, `0x`, Chrome DevTools | `--heap-prof`, heap snapshots | `clinic doctor` for event-loop blocking |
| Go | `pprof` (`net/http/pprof`, `go test -cpuprofile`) | `pprof -alloc_space` | `go tool trace` for scheduler/GC |
| JVM | async-profiler, JFR | JFR, heap dump + MAT | Warm up before measuring |
| Rust/C/C++ | `perf record -g` + flamegraph, `cargo flamegraph` | `heaptrack`, `valgrind --tool=massif` | Profile release builds with debug symbols |
| .NET | `dotnet-trace`, PerfView | `dotnet-gcdump` | |
| SQL | `EXPLAIN (ANALYZE, BUFFERS)` (Postgres), `EXPLAIN ANALYZE` (MySQL 8) | | Check `pg_stat_statements` for top queries |
| Browser | DevTools Performance panel, Lighthouse | Memory panel | Measure on throttled CPU/network |

## Common root causes (check these first)

- **N+1 queries**: one query per item in a loop. Fix with a join, `IN (...)` batch, or the ORM's eager loading (`select_related`/`prefetch_related`, `includes`, `JOIN FETCH`, DataLoader).
- **Missing index** or an index unusable because of a function/cast on the column; sequential scans on large tables in `EXPLAIN`.
- **Quadratic algorithms**: nested loops over the same collection, `list.contains`/`in list` inside a loop (use a set/map), repeated string concatenation in a loop.
- **Repeated work**: recomputing the same value, re-parsing config/regex per call, re-creating clients/connections per request (use pools).
- **Serial I/O that could be concurrent**: independent network calls awaited one after another.
- **Over-fetching**: `SELECT *`, loading whole tables to filter in memory, huge JSON payloads.
- **Allocation churn** in hot loops causing GC pressure.
- **Logging/serialization in hot paths**, debug logging left enabled.
- **Frontend**: render-blocking scripts, unoptimized images, layout thrash, re-rendering large lists without virtualization or memoization.

## Rules

- **No optimization without a profile pointing at it.** Note the profile evidence for every change.
- **Algorithmic and I/O fixes beat micro-optimizations.** Removing 1,000 queries beats making a loop 5% faster.
- **Benchmark like production**: same build mode, realistic data size and distribution, same concurrency.
- **Report percentiles, not averages**, for latency.
- **Caching is a last resort, not a first move**: it adds invalidation bugs and staleness. If you add a cache, state the key, TTL, invalidation rule and memory bound.
- **Keep readability unless the gain is large.** An unreadable 3% win on a non-hot path is a net loss.
- **Add a regression guard** where practical: a benchmark in CI, a query-count assertion in a test, or an alert on the metric.

## Example

Bad: "The endpoint is slow, so I added Redis caching and switched JSON libraries." No measurement, cache invalidation bug ships next week.

Good: `/orders` p95 is 1.8 s, target 300 ms. Trace shows 92% of time in DB, 201 queries per request. Profile: `serialize_order` loads `customer` per order (N+1). Fix: `prefetch_related("customer", "items")`. Benchmark (10 runs, 200 orders): p95 1.8 s to 140 ms, queries 201 to 3. Added test asserting at most 5 queries for the endpoint.

## Output

Report: (1) target metric with before and after numbers, number of runs and spread; (2) how you measured (benchmark command, data size, environment); (3) profile evidence for each bottleneck (top frames or query plan excerpt); (4) each change and its individual effect; (5) regression guard added; (6) remaining hotspots and the next thing you would try if the target is not met.
