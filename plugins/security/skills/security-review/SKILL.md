---
name: security-review
description: Reviews code changes, pull requests or whole modules for exploitable security flaws (injection, broken authz, SSRF, unsafe deserialization, secrets, crypto misuse) and reports only findings with a concrete attack path. Use when asked to "security review this PR", "is this code safe", "check for vulnerabilities", "audit this endpoint", or before merging changes that touch auth, input parsing, file paths, shell calls, SQL or outbound HTTP.
license: MIT
---

# Security Review

Find vulnerabilities an attacker could actually exploit in the code in front of you, and explain each one with the input that triggers it, the sink it reaches, and the fix. A short list of real, reproducible findings beats a long list of theoretical ones: every false positive teaches the reader to ignore the next report.

## Workflow

1. **Scope.** Identify exactly what is under review: a diff, a PR, a directory. If it is a diff, also read the surrounding functions and callers you need to understand data flow. Do not review the whole repo when asked about a PR.
2. **Map trust boundaries.** List where untrusted data enters: HTTP params, headers, cookies, request bodies, file uploads, webhooks, message queues, CLI args, environment from CI, data read back from the database that users wrote earlier.
3. **Trace sources to sinks.** For each source, follow it to dangerous sinks (table below). A finding needs a path from source to sink with no effective validation in between. Write that path down.
4. **Check authorization separately.** For every handler that reads or mutates a resource, confirm it checks that the *current user* may act on *this specific object*, not only that they are logged in.
5. **Check configuration and secrets.** Debug flags, permissive CORS, cookies without `Secure`/`HttpOnly`/`SameSite`, hard-coded credentials, verbose error pages.
6. **Rate each finding** (severity rubric below) and drop anything you cannot tie to a plausible attacker.
7. **Write the report** in the Output format. Propose a minimal fix for each finding.

## Sinks to trace

| Class | Sinks |
|---|---|
| SQL / NoSQL injection | string-built queries, `raw()`, `$where`, ORM `extra()` |
| Command injection | `subprocess(..., shell=True)`, `os.system`, `exec`, backticks, `child_process.exec` |
| Path traversal | `open(base + user_path)`, `send_file`, archive extraction (zip slip) |
| SSRF | server-side fetch of a user-supplied URL, webhooks, image proxies, PDF renderers |
| XSS | `innerHTML`, `dangerouslySetInnerHTML`, `|safe`, `v-html`, unescaped templates |
| Deserialization | `pickle.loads`, `yaml.load` (non-safe), Java `ObjectInputStream`, `unserialize` |
| Crypto misuse | MD5/SHA1 for passwords, ECB mode, static IVs, `Math.random` for tokens, JWT `alg: none` |
| Open redirect | redirect to `next`/`returnUrl` param without allow-list |

See `references/checklist.md` for the per-language detail and safe replacements.

## Rules

- **Exploitability first.** Report a finding only if you can describe the attacker, the input and the consequence in one or two sentences. "Could be risky" is not a finding.
- **Do not report** missing hardening that has no attack path (e.g. "add rate limiting" on an internal health check), style issues, or outdated dependencies without a known reachable CVE.
- **Authz beats authn.** IDOR (changing an ID in the URL to read someone else's data) is the most common real bug in web apps; check every object lookup.
- **Validation must be at the sink's level.** Escaping HTML does not protect SQL. Allow-lists beat deny-lists.
- **Trust nothing from the client**, including hidden form fields, JWT claims you did not verify, and `X-Forwarded-For`.
- **Say what you did not check.** If a helper lives in another repo or you lacked context, list it under "Not reviewed".

## Severity rubric

- **Critical**: unauthenticated remote code execution, auth bypass, mass data exposure.
- **High**: authenticated RCE, IDOR on sensitive data, SQL injection, SSRF to internal metadata endpoints.
- **Medium**: stored XSS, CSRF on state-changing actions, path traversal limited to readable app files.
- **Low**: reflected XSS needing unusual interaction, information disclosure of non-sensitive internals.

## Example

Bad finding:
> "User input is used in a query; this might lead to SQL injection. Consider sanitizing inputs."

Good finding:
> **High - SQL injection in `GET /api/orders`** (`orders/views.py:42`)
> `sort` from the query string is interpolated into `ORDER BY {sort}`. An authenticated user can send `sort=(CASE WHEN (SELECT substr(password,1,1) FROM users WHERE id=1)='a' THEN id ELSE total END)` to extract data via boolean ordering.
> Fix: map `sort` through an allow-list `{"date": "created_at", "total": "total"}` and reject anything else.

## Output

Produce a markdown report:

```
## Security review: <scope>

Summary: <N findings: x critical, y high, ...> | <one-line overall verdict: block merge / fix before release / ok to merge>

### <Severity> - <short title> (<file>:<line>)
- Source -> sink: <how the data flows>
- Exploit: <concrete input and impact>
- Fix: <minimal code change or pattern>

### Not reviewed
- <areas outside scope or lacking context>
```

If there are no findings, say so plainly and list what you checked, so the reader knows the review was real.
