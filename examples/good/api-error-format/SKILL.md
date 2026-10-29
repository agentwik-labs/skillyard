---
name: api-error-format
description: Formats error responses for the team's public HTTP APIs as RFC 9457 problem+json with stable error codes. Use when adding or changing an API endpoint's error handling, or when someone asks "what should this endpoint return on failure".
license: MIT
---

# API Error Format

Every public endpoint returns errors as `application/problem+json` (RFC 9457) so clients can branch on a stable `code`
instead of parsing messages.

## Workflow

1. Find the failure cases for the endpoint: validation, auth, not found, conflict, rate limit, upstream failure.
2. Map each to a status and a stable `code` from the table. Add a new code only if none fits, and add it to the table.
3. Return the body below; never put stack traces, SQL or internal hostnames in `detail`.
4. Add one test per failure case asserting status and `code`.

| Case | Status | code |
|---|---|---|
| Invalid input | 422 | `validation_failed` (with `errors[]` per field) |
| Missing/invalid auth | 401 | `unauthenticated` |
| Authenticated, not allowed | 403 | `forbidden` |
| Resource missing (or hidden) | 404 | `not_found` |
| Version/state conflict | 409 | `conflict` |
| Rate limited | 429 | `rate_limited` (+ `Retry-After`) |

## Output

```json
{ "type": "https://errors.example.com/validation_failed", "title": "Invalid request", "status": 422,
  "code": "validation_failed", "detail": "email must be a valid address", "errors": [{"field": "email", "code": "format"}] }
```
