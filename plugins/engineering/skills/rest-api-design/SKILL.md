---
name: rest-api-design
description: Designs and reviews HTTP/REST APIs for consistent resource naming, correct methods and status codes, a single error format, cursor pagination, idempotency, versioning and backward compatibility, and produces an OpenAPI sketch. Use when asked to "design an API", "add an endpoint", "review this API", "what status code should this return", "how should I paginate", "write the OpenAPI spec", or when changing a public or partner-facing HTTP interface.
license: MIT
---

# REST API Design

Design HTTP APIs that clients can guess correctly, that fail in predictable ways, and that can evolve without breaking anyone. Consistency across endpoints matters more than any individual choice: if the existing API already has a convention, follow it and note any deviation. Details for error bodies and pagination are in `references/conventions.md`.

## Workflow

1. **Read the existing API first.** Find the router/controllers or OpenAPI file. Record current conventions: casing (`snake_case` vs `camelCase`), error shape, pagination style, auth, versioning, date format. New endpoints must match them.
2. **Model resources, not actions.** List the nouns, their identifiers, and their relationships. Decide which are top-level and which are nested (nest at most one level: `/orders/{id}/items`).
3. **Map operations to methods and status codes** (table below).
4. **Define request and response schemas** with types, required fields, formats and examples. Decide what is server-generated (`id`, `created_at`) and therefore read-only.
5. **Define failure modes** for each endpoint: validation, auth, not found, conflict, rate limit. Each maps to a status code and the shared error format.
6. **Check evolution and safety** against the rules below.
7. **Write the OpenAPI 3.1 fragment** for the new or changed endpoints.

## Methods and status codes

| Operation | Method and path | Success | Notes |
|---|---|---|---|
| List | `GET /orders` | 200 | Always paginated |
| Read | `GET /orders/{id}` | 200 | 404 if missing *or not visible to caller* |
| Create | `POST /orders` | 201 + `Location` | Support `Idempotency-Key` |
| Replace | `PUT /orders/{id}` | 200 | Full representation; idempotent |
| Partial update | `PATCH /orders/{id}` | 200 | JSON Merge Patch unless stated |
| Delete | `DELETE /orders/{id}` | 204 | Repeat delete returns 204 or 404, document which |
| Action that is not CRUD | `POST /orders/{id}/cancel` | 200/202 | Acceptable when a state transition has no natural field |
| Long-running | `POST /exports` | 202 + status URL | Poll `GET /exports/{id}` |

Errors: 400 malformed, 401 unauthenticated, 403 authenticated but forbidden, 404 not found, 409 conflict/state violation, 412 precondition (ETag) failed, 415 wrong content type, 422 well-formed but invalid, 429 rate limited (with `Retry-After`), 500 server bug, 503 temporarily unavailable. Never return 200 with an error in the body.

## Rules

- **Plural nouns, lowercase, hyphenated paths:** `/payment-methods/{id}`. No verbs in paths except explicit actions.
- **One casing for JSON fields** across the whole API.
- **IDs are opaque strings** to clients, even if integers internally. Prefer non-sequential IDs for public resources.
- **Timestamps are RFC 3339 UTC strings** (`2026-03-01T12:00:00Z`). Money is integer minor units plus an ISO 4217 currency code, never floats.
- **Every list is paginated** from day one, cursor-based (`?limit=50&cursor=...`, response `next_cursor`). Offset pagination breaks under concurrent inserts and is slow on large tables. Cap `limit`.
- **One error format everywhere** (`references/conventions.md`), with a stable machine-readable `code` that clients branch on, never the message text.
- **Make POST retry-safe** with an `Idempotency-Key` header for anything that creates or charges.
- **Use ETags / `If-Match` for concurrent updates** where lost updates matter.
- **Authorization is per object.** Every handler checks the caller can access this specific resource. Return 404 rather than 403 when existence itself is sensitive.
- **Filtering and sorting** via query params: `?status=open&sort=-created_at`. Whitelist sortable fields.
- **Do not leak internals:** no stack traces, SQL errors, internal hostnames, or ORM field names in responses.

## Compatibility rules

Safe (non-breaking): adding an endpoint, adding an optional request field, adding a response field, adding an enum value *only if clients were told to tolerate unknown values*.

Breaking: removing or renaming a field, changing a type or format, making an optional field required, changing a status code, tightening validation, changing default sort or page size, changing auth requirements. Breaking changes need a new version (`/v2` or a dated version header, whichever the API already uses), a deprecation period announced with `Deprecation` and `Sunset` headers, and a migration note.

## Example

Bad: `POST /api/getUserOrders` with body `{"userId": 5}` returning `200 {"success": false, "error": "not found"}`.

Good: `GET /v1/users/usr_8f2k/orders?status=open&limit=25` returning `200 {"data": [...], "next_cursor": "b3JkXzEyMw"}`; unknown user returns `404 {"error": {"code": "user_not_found", "message": "User usr_8f2k was not found.", "request_id": "req_91x"}}`.

## Output

Produce: (1) a table of endpoints with method, path, purpose, success code and error codes; (2) request/response JSON examples for each new endpoint; (3) an OpenAPI 3.1 YAML fragment; (4) a list of compatibility impacts on existing clients, or "no breaking changes"; (5) open questions that need a product decision.
