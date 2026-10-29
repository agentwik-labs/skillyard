---
name: code-standards
description: Applies Acme Cloud engineering conventions for TypeScript/Node services, the React web app and Postgres when writing, refactoring or reviewing code. Use when someone asks to "review this PR", "write a new endpoint", "add a migration", "follow our conventions", or edits code in an Acme Cloud repository.
license: Proprietary
---

# Acme Cloud Code Standards

Applies to the `acme-api` monorepo (Node 20, TypeScript, Fastify), `acme-web` (React 18,
Vite, TanStack Query) and all Postgres 15 schemas.

## Workflow

1. Detect the area: API service, web app, shared package (`packages/*`), or migration.
2. Read the nearest `CODEOWNERS` entry; the listed team must review the PR.
3. Write or review code against the rules below. Cite the rule number in review comments.
4. Run `pnpm lint && pnpm typecheck && pnpm test --filter <package>` before proposing a change.
5. For migrations, also run `pnpm db:migrate:check` (detects locking operations).
6. Summarize findings by severity: Must fix, Should fix, Nit.

## Rules

TypeScript
- R1. `strict: true` everywhere. No `any`; use `unknown` and narrow. Reason: `any` was the
  root cause of two SEV2s in 2025.
- R2. Validate every external input with zod schemas in `src/schemas/`. Types are inferred
  from schemas, never declared twice.
- R3. Errors: throw `AcmeError` subclasses (`NotFoundError`, `ForbiddenError`,
  `ValidationError`) from `@acme/errors`. Never throw strings.
- R4. Logging through `@acme/logger` only; no `console.log`. Never log tokens, emails, or
  workflow payloads. Reason: logs are shipped to a vendor (see data-access-policy).
- R5. File names kebab-case; exported types PascalCase; functions camelCase.

API
- R6. Routes are `/v1/<plural-noun>`; IDs are prefixed strings (`wf_`, `run_`, `ws_`).
- R7. Every handler checks workspace scope via `requireWorkspace(req)`. Reason: tenant isolation.
- R8. List endpoints paginate with `cursor` and `limit` (max 100). No offset pagination.

React
- R9. Data fetching uses TanStack Query hooks in `src/api/`; components never call `fetch`.
- R10. UI uses `@acme/ui` components. New colors or spacing values must come from tokens.
- R11. Every interactive element is reachable by keyboard and has an accessible name.

Postgres
- R12. Tables snake_case plural (`workflow_runs`); every table has `id`, `workspace_id`,
  `created_at`, `updated_at`.
- R13. New indexes use `CREATE INDEX CONCURRENTLY`. No `ALTER TABLE ... ADD COLUMN ... DEFAULT`
  on tables over 1M rows without a backfill plan.
- R14. Every query on tenant data filters by `workspace_id`. Reason: RLS is defense in depth, not the primary guard.

Testing
- R15. New API handlers ship with an integration test using `testcontainers` Postgres.
- R16. Bug fixes include a regression test that fails before the fix.

## Example

Review comment: "Must fix (R7): `getRun` loads by `run_id` without `requireWorkspace`. A
user in workspace A can read runs from workspace B by guessing IDs. Add the scope check
and a test that asserts 404 across workspaces."

## Output

A review with three headed lists (Must fix, Should fix, Nit), each item citing a rule
number, file and line, and a concrete fix. End with the commands you ran and their result.
