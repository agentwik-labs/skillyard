# Engine notes

## PostgreSQL

- `ALTER TABLE` takes an `ACCESS EXCLUSIVE` lock for most operations. Even a fast operation will wait behind a long-running query, and every new query then queues behind the waiting DDL. Always `SET lock_timeout`.
- Adding a column with a non-volatile default is metadata-only since 11. A volatile default (`now()`, `gen_random_uuid()`) rewrites the table.
- `CREATE INDEX CONCURRENTLY` cannot run inside a transaction. Rails: `disable_ddl_transaction!` + `algorithm: :concurrently`. Django: `AddIndexConcurrently` with `atomic = False`. Alembic: `with op.get_context().autocommit_block():` + `postgresql_concurrently=True`.
- A failed concurrent build leaves an `INVALID` index. Drop it (`DROP INDEX CONCURRENTLY`) before retrying; `IF NOT EXISTS` will otherwise skip it.
- `SET NOT NULL` scans the table under lock unless a validated `CHECK (col IS NOT NULL)` constraint already exists (12+). Sequence: add `CHECK ... NOT VALID`, `VALIDATE CONSTRAINT` (weaker lock), `SET NOT NULL`, drop the check.
- Foreign keys: `ADD CONSTRAINT fk ... NOT VALID`, then `VALIDATE CONSTRAINT fk` in a separate transaction.
- Changing `varchar(n)` to a larger `n` or to `text` is metadata-only. Shrinking or changing type rewrites.
- `int` primary keys overflow at 2.1B; migrate to `bigint` long before then with a new column plus trigger plus backfill.

## MySQL / MariaDB (InnoDB)

- Prefer `ALGORITHM=INSTANT` (8.0+, add column at end, etc.), then `ALGORITHM=INPLACE, LOCK=NONE`. Specify them explicitly so MySQL errors instead of silently falling back to a copying rebuild.
- Long DDL plus replicas means replication lag; online tools (`gh-ost`, `pt-online-schema-change`) throttle on lag.
- DDL is not transactional: a multi-statement migration that fails halfway leaves partial changes. One DDL statement per migration.
- Metadata lock waits: `SET SESSION lock_wait_timeout = 5`.

## SQLite

- Limited `ALTER TABLE`: no drop of constrained columns before 3.35, no type changes. Most tools recreate the table (create new, copy, drop, rename) inside a transaction. Fine for small embedded DBs; check foreign keys with `PRAGMA foreign_key_check` after.

## SQL Server

- Online index ops need Enterprise edition: `CREATE INDEX ... WITH (ONLINE = ON)`.
- Adding a `NOT NULL` column with a default is metadata-only since 2012 for runtime-constant defaults.

## Batched backfill template (Postgres, any language)

```sql
-- repeat until 0 rows updated; sleep 50-200 ms between batches
WITH batch AS (
  SELECT id FROM orders
  WHERE total_cents IS NULL AND id > :last_id
  ORDER BY id
  LIMIT 5000
)
UPDATE orders o SET total_cents = round(o.total * 100)
FROM batch WHERE o.id = batch.id
RETURNING o.id;
-- record max(id) returned as :last_id for resumability
```
