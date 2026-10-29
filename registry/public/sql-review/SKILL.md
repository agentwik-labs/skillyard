---
name: sql-review
description: Reviews SQL queries and schema migrations for correctness, performance, safety and locking risk (wrong joins, NULL traps, missing indexes, N+1 patterns, table rewrites, unbatched updates). Use when asked to "review this query", "why is this SQL slow", "is this migration safe to run in production", "check my schema change", or before merging any PR with raw SQL or database migrations.
license: MIT
---

# SQL Review

Review SQL the way a careful DBA would before it touches production: first is it correct, then will it stay fast as data grows, then can it be deployed without locking a hot table or losing data. Name the database engine and version before judging anything; Postgres, MySQL, SQLite and warehouses behave differently on the points that matter most.

## Workflow

1. **Establish context.** Engine and version, approximate row counts of involved tables, existing indexes, and whether this is OLTP (request path) or analytics. Ask for or look up the schema (`\d table`, migrations, ORM models). If you cannot get sizes, state your assumption.
2. **Check correctness** (checklist below). A fast wrong query is the worst outcome.
3. **Check performance.** Ask for `EXPLAIN (ANALYZE, BUFFERS)` (Postgres) or `EXPLAIN ANALYZE` (MySQL 8+) on realistic data when the query is on a hot path. Read it for sequential scans on large tables, row-estimate errors over 10x, nested loops over large inputs, sorts spilling to disk.
4. **Check migrations for deploy safety** (see `references/migration-safety.md`): lock level, table rewrite, duration on the real table size, backward compatibility with the currently deployed code.
5. **Check security**: string-concatenated input, overly broad grants, functions with `SECURITY DEFINER`.
6. **Write findings** ordered by severity, each with a concrete rewrite.

## Correctness checklist

- `NOT IN (subquery)` returns no rows if the subquery yields any NULL; use `NOT EXISTS`.
- `= NULL` / `<> NULL` are never true; use `IS [NOT] NULL` or `IS DISTINCT FROM`.
- `LEFT JOIN` followed by a `WHERE` filter on the right table silently becomes an inner join; move the filter into `ON`.
- Joins that fan out (one-to-many) before `SUM`/`COUNT` inflate totals; aggregate first or use `COUNT(DISTINCT ...)` knowingly.
- `GROUP BY` with non-aggregated columns not in the group (MySQL without ONLY_FULL_GROUP_BY) returns arbitrary values.
- `BETWEEN` on timestamps includes the end boundary; prefer `>= start AND < end`.
- Time zones: `timestamp` vs `timestamptz`, `now()` vs app-supplied times, date truncation in the wrong zone.
- Integer division (`1/2 = 0`) and `AVG` on integers in some engines.
- `LIMIT` without `ORDER BY` is nondeterministic; pagination with `OFFSET` skips or repeats rows under concurrent writes.
- `UPDATE`/`DELETE` without `WHERE`, or with a `WHERE` that can match more than intended. Ask what the expected row count is.
- Read-modify-write without a lock or atomic update (`UPDATE ... SET n = n + 1`) loses updates.

## Performance rules

- **Index for the predicate and the sort.** Composite index column order: equality columns first, then range, then sort columns.
- **Functions on indexed columns disable the index** (`WHERE lower(email) = ?`) unless there is an expression index.
- **Leading wildcard `LIKE '%x'`** cannot use a B-tree index; consider trigram or full-text indexes.
- **`SELECT *`** on wide tables in hot paths costs I/O and breaks covering indexes; name columns.
- **Keyset pagination** (`WHERE id > last_id ORDER BY id LIMIT n`) over `OFFSET` for deep pages.
- **N+1**: a query inside a loop in application code; replace with one query using `IN`/`ANY` or a join.
- **Every foreign key column should be indexed** in Postgres, or deletes on the parent scan the child.

## Example

Bad (finds "customers without orders" but returns nothing if any `orders.customer_id` is NULL):
```sql
SELECT id FROM customers WHERE id NOT IN (SELECT customer_id FROM orders);
```
Good:
```sql
SELECT c.id FROM customers c
WHERE NOT EXISTS (SELECT 1 FROM orders o WHERE o.customer_id = c.id);
```

Bad migration on a 200M-row Postgres table:
```sql
CREATE INDEX idx_orders_status ON orders (status);
```
Good: `CREATE INDEX CONCURRENTLY idx_orders_status ON orders (status);` in its own migration, outside a transaction.

## Output

```
## SQL review: <query/migration name> (<engine version>)

Assumptions: <table sizes, workload>

### Blocking
1. <issue> - <why it is wrong or dangerous> - <rewrite>

### Should fix
1. ...

### Consider
1. ...

### Rewritten query / migration
<full corrected SQL>

### Verify with
<EXPLAIN command or test query and the result that would confirm the fix>
```
