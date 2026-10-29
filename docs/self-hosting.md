# Self-hosting

## Configuration

| Variable | Default | Meaning |
|---|---|---|
| `PORT` / `--port` | `7420` | Listen port |
| `HOST` / `--host` | `127.0.0.1` | Bind address (`0.0.0.0` in containers) |
| `SKILLYARD_DATA` / `--data` | `./data` | Where `db.json` and skill files live |
| `SKILLYARD_ADMIN_TOKEN` | unset | Bearer token with admin rights (create orgs over the API) |
| `SKILLYARD_ALLOWED_ORIGINS` | localhost only | Comma-separated browser origins allowed to call `/mcp` |

## Storage

`<data>/db.json` holds orgs, hashed tokens, skill metadata, scan results and the last 1,000 audit events. It is
written atomically (temp file + rename). Skill files live under `<data>/blobs/<scope>/<name>/<version>/`. Back up
the whole directory. A single process owns the data directory; run one replica, and scale reads with a CDN in
front of `GET /api/skills/*` for public skills if needed.

## Access model

- **Scopes**: every skill belongs to an org. `@skillyard` is the community scope that `seed` creates.
- **Tokens**: `read` sees the org's private skills; `publish` also publishes, changes visibility, deletes, manages
  the org's tokens and reads its activity log. Admin tokens (`skillyard token create --admin` or
  `SKILLYARD_ADMIN_TOKEN`) can do anything. Tokens are shown once and stored as SHA-256 hashes.
- **Private by default**: an org skill is private unless its `skill.json` or the publish request says `public`.
  Callers without access get `404`, so private skill names do not leak.

## Publishing pipeline

1. Validate: frontmatter, name rules, semver, path safety, 200 files / 1 MB per file / 5 MB per skill.
2. Scan: see `src/scan.js`. Critical findings block the publish with `422`; warnings are stored with the version.
3. Store: the version is immutable; republishing the same version returns `409`.
4. Audit: the event goes to the org's activity log.

## Hardening checklist

- Terminate TLS in front (Caddy, nginx, a cloud load balancer).
- Set `SKILLYARD_ADMIN_TOKEN` only when you need API org creation; prefer the local CLI on the server.
- Give CI and people separate read tokens; give publish tokens to maintainers only; revoke from the org page.
- Mount the data directory on persistent storage and back it up.
