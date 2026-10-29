---
name: database-migrations
description: Writes and reviews schema and data migrations that are safe to run on a live production database with zero downtime, using expand/contract, batched backfills, online index builds and explicit rollback plans; includes a SQL migration linter. Use when asked to "add a column", "write a migration", "rename a column/table", "add an index", "change a column type", "backfill data", "review this migration", or before deploying any schema change.
license: MIT
---

# Database Migrations

Change the schema of a database that is serving traffic without locking tables, breaking the currently deployed code, or losing data. Assume old and new application versions run at the same time during every deploy, that tables are larger than they look in development, and that any migration may need to be rolled back halfway. Engine-specific notes are in `references/engine-notes.md`.

## Workflow

1. **Identify the engine, version and migration tool** (Postgres, MySQL, SQLite, SQL Server; Rails, Django, Alembic, Flyway, Liquibase, Prisma, Knex, golang-migrate, EF Core). Follow the tool's file naming and up/down conventions.
2. **Estimate table size and traffic** for every table touched. If unknown, ask or assume large. Locks that take milliseconds on 1k rows take minutes on 100M rows.
3. **Classify the change** as additive (safe), destructive (needs contract phase), or rewriting (needs expand/contract). Use the table below.
4. **Plan the deploy sequence** as numbered steps, each deployable and reversible on its own.
5. **Write the migration(s)** following the rules.
6. **Lint the SQL.** For raw SQL or generated SQL (`manage.py sqlmigrate`, `alembic upgrade --sql`, `rails db:migrate` dry output), run `python3 scripts/check_migration.py path/to/migration.sql` (add `--engine mysql` for MySQL). Resolve every error or justify it in the migration's comment.
7. **Test up and down** on a copy of production-like data: apply, roll back, apply again. Run the app's test suite against the migrated schema.

## Expand/contract (the default for anything non-additive)

To rename `users.name` to `users.full_name`:

1. **Expand:** add `full_name` (nullable). Deploy.
2. **Dual write:** application writes both columns, reads old. Deploy.
3. **Backfill** `full_name` from `name` in batches. Verify counts match.
4. **Switch reads** to `full_name`. Deploy.
5. **Stop writing** `name`. Deploy and wait one full release cycle.
6. **Contract:** drop `name` in a later migration.

Never rename or drop a column that the currently deployed code reads, in one deploy. The old pods will crash during rollout.

## Rules

- **Additive changes first, destructive changes last**, in separate deploys.
- **New columns are nullable or have a constant default.** Adding `NOT NULL` without a default to a populated table fails or rewrites the table. Add nullable, backfill, then add the constraint (Postgres: `CHECK ... NOT VALID`, then `VALIDATE CONSTRAINT`, then `SET NOT NULL`).
- **Build indexes online:** Postgres `CREATE INDEX CONCURRENTLY` (outside a transaction; most tools need a flag to disable the wrapping transaction), MySQL `ALGORITHM=INPLACE, LOCK=NONE`. Same for dropping indexes.
- **Add foreign keys without a full scan under lock:** Postgres `ADD CONSTRAINT ... NOT VALID` then `VALIDATE CONSTRAINT` separately.
- **Set a lock timeout** at the top of every migration (Postgres `SET lock_timeout = '5s';` MySQL `SET SESSION lock_wait_timeout = 5;`) so a blocked DDL fails fast instead of queuing all traffic behind it. Retry later.
- **Backfill in batches** of 1k to 10k rows by primary key range, each in its own short transaction, with a pause between batches and progress logging. Never `UPDATE big_table SET ...` in one statement. Make the backfill idempotent and resumable (`WHERE new_col IS NULL`).
- **Keep data migrations out of schema migrations** when they touch many rows. Run them as a separate job so a slow backfill does not hold the deploy.
- **Do not use application models inside migrations**; the model will change later and break old migrations. Use raw SQL or a frozen schema snapshot (Django `apps.get_model`, Alembic `op.execute`).
- **Changing a column type** (int to bigint, varchar length shrink, text to enum) is a rewrite: use expand/contract with a new column, or the engine's online tool (`pg-osc`, `gh-ost`, `pt-online-schema-change`).
- **Every migration has a down path or an explicit note** that it is irreversible and how to restore (e.g. "restore from backup taken at step 0"). Dropping a column destroys data; take a backup or keep the column for a release.
- **Never edit a migration that has run in any shared environment.** Write a new one.
- **One concern per migration file.** Easier to retry and roll back.

## Change classification

| Change | Safe in one deploy? | Approach |
|---|---|---|
| Add nullable column / new table | Yes | Plain migration |
| Add column with constant default | Yes on Postgres 11+, MySQL 8.0.12+ | Plain migration; older versions rewrite |
| Add index | Yes if online | CONCURRENTLY / INPLACE |
| Add NOT NULL | No | Nullable, backfill, validate, set |
| Rename column/table | No | Expand/contract or view alias |
| Drop column | No | Stop reading/writing first, drop a release later |
| Change type | No | New column + backfill or online schema tool |

## Example

Bad:

```sql
ALTER TABLE orders RENAME COLUMN total TO total_cents;
ALTER TABLE orders ALTER COLUMN total_cents SET NOT NULL;
CREATE INDEX idx_orders_user ON orders(user_id);
UPDATE orders SET status = 'open' WHERE status IS NULL;
```

Good (first deploy only):

```sql
SET lock_timeout = '5s';
ALTER TABLE orders ADD COLUMN total_cents bigint;
-- separate migration, no transaction:
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_user ON orders(user_id);
-- backfill runs as a batched job: scripts/backfill_total_cents.py
```

## Output

Produce: (1) the deploy plan as numbered steps, marking which are schema migrations, code deploys and background jobs; (2) the migration files; (3) the backfill script if any, batched and resumable; (4) the rollback procedure for each step; (5) the `check_migration.py` result; (6) estimated lock impact per statement ("metadata lock only", "full table scan under ShareLock", etc.).
