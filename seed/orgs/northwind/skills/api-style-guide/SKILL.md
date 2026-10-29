---
name: api-style-guide
description: Defines how Northwind Pay designs and reviews HTTP APIs in its Python and Go services, covering resource naming, money representation, idempotency keys, errors, versioning and pagination. Use when someone says "design an endpoint", "review this API", "add a field to the API", "what should this error look like", or writes an OpenAPI spec at Northwind Pay.
license: Proprietary
---

# Northwind Pay API Style Guide

Our public API is used by finance teams and their developers. Mistakes in money handling
are expensive and permanent, so this guide is strict.

## Workflow

1. Start from the OpenAPI 3.1 spec in `api-specs/<service>/openapi.yaml`, not from code.
2. Apply the rules below. Run `make api-lint` (Spectral ruleset `nw-api`) on the spec.
3. For public endpoints, open a review in #api-council and tag `@northwind/api-council`;
   two approvals are required before implementation.
4. Generate server stubs (`make api-gen`) for Go (oapi-codegen) or Python (FastAPI models).
5. Add the change to `CHANGELOG-API.md` with the version date.

## Rules

Resources and naming
- A1. Paths are plural nouns, kebab-case: `/v1/payment-intents`, `/v1/payouts`.
- A2. JSON fields are snake_case. IDs are prefixed strings: `pi_`, `po_`, `acct_`, `cus_`.
  Reason: prefixes make support tickets and logs self-describing.
- A3. Actions that are not CRUD use a sub-resource verb: `POST /v1/payouts/{id}/cancel`.

Money
- A4. Amounts are integers in minor units with an ISO 4217 currency:
  `{"amount": 1050, "currency": "usd"}`. Never floats, never decimal strings.
  Reason: float rounding caused a ledger mismatch in 2024.
- A5. Exchange rates are decimal strings with up to 8 places: `"rate": "1.08420000"`.

Safety
- A6. Every POST that moves money requires an `Idempotency-Key` header (UUID v4). Keys are
  stored 24 hours; a replay with a different body returns `409 idempotency_conflict`.
- A7. Timestamps are RFC 3339 UTC strings ending in `Z`.
- A8. Never return PAN, full bank account numbers or tax IDs. Return `last4` fields.

Errors
- A9. Error body: `{"error": {"type": "...", "code": "...", "message": "...", "param": "...", "request_id": "..."}}`.
  `type` is one of `invalid_request`, `authentication`, `permission`, `not_found`,
  `conflict`, `rate_limit`, `api_error`.
- A10. Messages are for developers, in plain English, and never leak internal service names.

Lists and versions
- A11. Lists use cursor pagination: `limit` (default 20, max 100), `starting_after`,
  `ending_before`; response has `data` and `has_more`.
- A12. Versioning is date-based via the `Northwind-Version` header (e.g. `2026-07-01`).
  Additive changes need no new version; removals and type changes do, with 12 months notice.

## Example

Proposed: `POST /v1/createPayout` with `{"amountUSD": 10.50}`.
Corrected: `POST /v1/payouts` with `Idempotency-Key` header and body
`{"amount": 1050, "currency": "usd", "destination": "ba_..."}`. Cites A1, A2, A4, A6.

## Output

Return the corrected spec snippet (YAML), a list of findings citing rule IDs, and
whether the change needs #api-council review or a new API version.
