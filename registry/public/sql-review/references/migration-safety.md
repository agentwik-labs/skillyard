# Migration safety (Postgres-first, MySQL notes)

Assume the table is large and hot unless told otherwise. A migration is safe when it holds no lock that blocks reads/writes for more than a second or two, and when both the old and new application versions work against the schema during the deploy.

## Postgres
| Operation | Risk | Safer pattern |
|---|---|---|
| `CREATE INDEX` | blocks writes for the build | `CREATE INDEX CONCURRENTLY` (no transaction; check for INVALID index if it fails) |
| `ADD COLUMN ... DEFAULT <const>` | safe on PG 11+ (no rewrite) | volatile defaults (`now()`, `random()`) still rewrite: add nullable, backfill, then set default |
| `ADD COLUMN ... NOT NULL` without default | fails on non-empty table | add nullable -> backfill in batches -> `ADD CONSTRAINT ... CHECK (col IS NOT NULL) NOT VALID` -> `VALIDATE CONSTRAINT` -> `SET NOT NULL` |
| `ALTER COLUMN TYPE` | full rewrite + ACCESS EXCLUSIVE lock | new column, dual-write, backfill, swap reads, drop old |
| `ADD FOREIGN KEY` | scans and locks both tables | `ADD CONSTRAINT ... NOT VALID`, then `VALIDATE CONSTRAINT` separately |
| `ADD CONSTRAINT UNIQUE` | builds index under lock | `CREATE UNIQUE INDEX CONCURRENTLY`, then `ADD CONSTRAINT ... USING INDEX` |
| `RENAME COLUMN/TABLE` | breaks running code | add new, dual-write, migrate readers, drop old later |
| `DROP COLUMN` | running code may still select it | stop reading it in code first, deploy, then drop |
| Large `UPDATE`/`DELETE` | long transaction, bloat, replication lag | batch by primary key ranges (1k-10k rows), commit per batch, sleep between |

Always set `SET lock_timeout = '3s';` (and a `statement_timeout`) at the top of DDL migrations so a blocked ALTER fails fast instead of queueing every other query behind it.

## MySQL (InnoDB, 8.0)
- Many `ALTER TABLE` operations are online (`ALGORITHM=INPLACE, LOCK=NONE`); state them explicitly so MySQL errors instead of silently copying the table.
- Changing column type, charset, or adding a column in the middle on older versions copies the table; use gh-ost or pt-online-schema-change for large tables.
- Metadata locks: a long-running transaction blocks the ALTER, and the waiting ALTER then blocks everyone. Check `information_schema.innodb_trx` first.

## Expand / contract
For any change that existing code depends on: (1) expand: add the new shape, keep the old; (2) deploy code that writes both and reads new; (3) backfill; (4) contract: remove the old shape in a later release. Each step is a separate deploy.
