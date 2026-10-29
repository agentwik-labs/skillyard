# REST conventions reference

Use these defaults when the API has no existing convention. If it has one, follow it.

## Error body

Every non-2xx response uses the same envelope (compatible in spirit with RFC 9457 Problem Details; if the API already uses `application/problem+json`, use that instead):

```json
{
  "error": {
    "code": "validation_failed",
    "message": "One or more fields are invalid.",
    "request_id": "req_01HV9W3",
    "details": [
      {"field": "email", "code": "invalid_format", "message": "Must be a valid email address."},
      {"field": "quantity", "code": "out_of_range", "message": "Must be between 1 and 100."}
    ]
  }
}
```

- `code` is stable, snake_case, documented, and what clients branch on.
- `message` is for humans and may change.
- `request_id` matches the `X-Request-Id` response header and server logs.
- `details` is present for validation errors; one entry per field problem, all problems at once (do not make clients fix one field per round trip).

## Cursor pagination

Request: `GET /orders?limit=50&cursor=<opaque>`

Response:

```json
{
  "data": [ { "id": "ord_1" }, { "id": "ord_2" } ],
  "next_cursor": "eyJpZCI6Im9yZF8yIn0",
  "has_more": true
}
```

- The cursor encodes the sort key(s) of the last item plus the id as tiebreaker, base64url-encoded. Clients must treat it as opaque.
- Query: `WHERE (created_at, id) < (:c_created_at, :c_id) ORDER BY created_at DESC, id DESC LIMIT :limit + 1`. Fetch one extra row to compute `has_more`.
- Default `limit` 25 to 50, max 100 to 200. Reject larger values with 400 rather than silently clamping, or clamp and document it; pick one.
- Do not return total counts by default; `COUNT(*)` on large tables is expensive. Offer `?include=total_count` if needed.

## Idempotency keys

- Header: `Idempotency-Key: <client-generated UUID>`.
- Server stores `(key, caller, request fingerprint) -> (status, response body)` for at least 24 hours.
- Same key + same fingerprint: return the stored response, do not execute again.
- Same key + different fingerprint: 422 with code `idempotency_key_reused`.
- Concurrent request with an in-flight key: 409 with code `request_in_progress`.

## Versioning

- Path versioning (`/v1/...`) is simplest to route and cache. Header/date versioning (`API-Version: 2026-03-01`) allows finer-grained evolution. Use whichever the API already has.
- Deprecations: send `Deprecation: true` (or a date) and `Sunset: <HTTP-date>` headers on deprecated endpoints, plus a `Link` to the migration guide.

## Rate limiting

Return `429` with `Retry-After` (seconds). Also expose `RateLimit-Limit`, `RateLimit-Remaining`, `RateLimit-Reset` on normal responses so clients can back off before hitting the limit.

## Naming quick reference

| Concept | Convention |
|---|---|
| Collection | `/invoices` |
| Item | `/invoices/{invoice_id}` |
| Sub-collection | `/invoices/{invoice_id}/line-items` |
| Action | `POST /invoices/{invoice_id}/void` |
| Search across fields | `GET /invoices?q=acme` |
| Booleans | `is_paid`, `has_attachments` |
| Timestamps | `created_at`, `updated_at`, `voided_at` |
