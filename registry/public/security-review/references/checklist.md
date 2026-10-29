# Security review checklist (per language)

## Python
- `subprocess.run(cmd, shell=True)` with any interpolated value -> use a list argv, `shell=False`.
- `yaml.load(x)` -> `yaml.safe_load(x)`.
- `pickle.loads` / `marshal.loads` on anything from network, cache or user upload -> use JSON.
- Django: `.raw()`, `.extra()`, `RawSQL`, `mark_safe`, `|safe`; `DEBUG=True` in prod settings; `ALLOWED_HOSTS=['*']`.
- Flask: `render_template_string(user_input)` is SSTI; `send_file(request.args[...])` is traversal.
- `requests.get(user_url)` -> SSRF; resolve the host, block private/link-local ranges (169.254.169.254, 10/8, 172.16/12, 192.168/16, ::1, fc00::/7), disable redirects or re-check after each.
- Password hashing: use `bcrypt`, `argon2`, or `hashlib.scrypt`; never bare SHA-256.
- Tokens: `secrets.token_urlsafe`, never `random`.

## JavaScript / TypeScript
- `child_process.exec(\`cmd ${x}\`)` -> `execFile` with argv array.
- `eval`, `new Function`, `vm.runInContext` with user data.
- React `dangerouslySetInnerHTML`, Vue `v-html`, `element.innerHTML =`.
- Prototype pollution: deep-merge of request bodies into objects (`lodash.merge`, custom merges); check for `__proto__`, `constructor`.
- Express: `res.redirect(req.query.next)`; missing `helmet`; `cors({ origin: true, credentials: true })` reflects any origin with cookies.
- JWT: verify with an explicit `algorithms: ['RS256']`; never `jwt.decode` for auth.

## Go
- `fmt.Sprintf` into `db.Query` -> use `$1` placeholders.
- `exec.Command("sh", "-c", x)`.
- `filepath.Join(base, userPath)` does not stop `..`; check `strings.HasPrefix(filepath.Clean(full), base+string(os.PathSeparator))`.
- `http.Client` default has no timeout.

## Java / Kotlin
- `Statement.executeQuery("..." + x)` -> `PreparedStatement`.
- `ObjectInputStream.readObject` on untrusted data.
- XML parsers without disabling external entities (XXE): set `FEATURE_SECURE_PROCESSING`, disallow DOCTYPE.
- Spring: `@RequestMapping` without method restriction, missing `@PreAuthorize` on admin endpoints.

## Any web app
- Every object fetch by ID: is ownership or tenant checked in the query (`WHERE id = ? AND org_id = ?`)?
- State-changing GET endpoints.
- Cookies: `Secure`, `HttpOnly`, `SameSite=Lax` or stricter for session cookies.
- File uploads: content-type sniffing, stored under web root, filename used in path, size limits.
- Error responses leaking stack traces, SQL, or internal hostnames.
- Logs containing tokens, passwords, or full card numbers.
