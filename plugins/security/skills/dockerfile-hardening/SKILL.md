---
name: dockerfile-hardening
description: Hardens Dockerfiles and container images for production by pinning base images, using multi-stage builds, running as a non-root user, keeping secrets out of layers, shrinking the image and adding health checks; includes a dependency-free Dockerfile auditor. Use when asked to "write a Dockerfile", "review/secure/harden this Dockerfile", "make the image smaller", "why is my image so big", "containerize this app", or before shipping a container to production.
license: MIT
---

# Dockerfile Hardening

Produce container images that are small, reproducible, run with least privilege and contain no secrets. Every extra package is attack surface and every unpinned tag is a build that can change under you. Optimize in this order: security, reproducibility, build cache efficiency, size.

## Workflow

1. **Audit what exists.** Run `python3 scripts/audit_dockerfile.py path/to/Dockerfile` from this skill's directory. It flags root user, `latest`/unpinned tags, missing `HEALTHCHECK`, secrets in `ENV`/`ARG`, `ADD` from URLs, `curl | sh`, missing package-cache cleanup and more. Also read `.dockerignore`.
2. **Identify the runtime needs**: language and version, build tools needed only at build time, native libraries needed at runtime, port, entrypoint, writable paths.
3. **Restructure into multi-stage**: a `build` stage with compilers and dev dependencies, a minimal `runtime` stage that copies only artifacts.
4. **Apply the rules below.**
5. **Build and verify**: `docker build -t app:test .`, then `docker run --rm app:test id` (must not be uid 0), `docker image ls app:test` (size), run the container and hit the health endpoint. If available, scan with `trivy image app:test` or `docker scout cves app:test`.
6. **Re-run the auditor** until it reports no errors.

## Rules

**Base image**
- Pin a specific version tag, never `latest` or a bare name: `python:3.12.4-slim-bookworm`. For maximum reproducibility pin the digest as well: `python:3.12.4-slim-bookworm@sha256:...`, and let Renovate/Dependabot bump it.
- Use the smallest base that works: distroless (`gcr.io/distroless/static`, `.../python3`, `.../nodejs`), `-slim`, or `alpine` (musl: test native wheels and DNS behavior), `scratch` for static Go/Rust binaries.

**User and permissions**
- Create and switch to a non-root user in the final stage: `RUN useradd --uid 10001 --no-create-home app` then `USER 10001`. Use a numeric UID so Kubernetes `runAsNonRoot` can verify it.
- Copy files with `COPY --chown=10001:10001`; do not `chmod -R 777`.
- Make the root filesystem read-only-friendly: write only to declared paths (`/tmp`, a volume).

**Secrets**
- Never put secrets in `ENV`, `ARG`, or copied files. They persist in image layers and `docker history`.
- Use BuildKit secrets for build-time credentials: `RUN --mount=type=secret,id=npmrc,target=/root/.npmrc npm ci`.
- Inject runtime secrets via the orchestrator (env from secret store, mounted files).
- `.dockerignore` must exclude `.git`, `.env*`, `*.pem`, `*.key`, `node_modules`, build output, local config.

**Layers and cache**
- Copy dependency manifests first, install, then copy source, so code changes do not bust the dependency cache.
- Use lockfile-exact installs: `npm ci`, `pip install --require-hashes -r requirements.txt` or `uv sync --frozen`, `go mod download`, `bundle install --frozen`.
- Combine `apt-get update && apt-get install -y --no-install-recommends ... && rm -rf /var/lib/apt/lists/*` in one `RUN`. Pin critical package versions.
- Use `COPY`, not `ADD`, unless you need tar extraction. Never `ADD https://...`; download with checksum verification.
- Never `curl ... | sh`. Download, verify checksum or signature, then run.

**Runtime**
- Exec-form `ENTRYPOINT`/`CMD` (`["node", "server.js"]`) so the process is PID 1 and receives SIGTERM. Add `--init` or `tini` if the app spawns children.
- Add a `HEALTHCHECK` (or document that the orchestrator's probe replaces it).
- `EXPOSE` the real port; listen on a non-privileged port (>1024).
- Set `PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1`, `NODE_ENV=production` as relevant.
- Add OCI labels: `org.opencontainers.image.source`, `.revision`, `.version`.

## Example

Bad:

```dockerfile
FROM node:latest
ENV DATABASE_URL=postgres://admin:CHANGE_ME@db/prod
ADD . /app
WORKDIR /app
RUN npm install
CMD npm start
```

Good:

```dockerfile
# syntax=docker/dockerfile:1.7
FROM node:20.15.1-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci
COPY . .
RUN npm run build && npm prune --omit=dev

FROM gcr.io/distroless/nodejs20-debian12:nonroot
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build --chown=65532:65532 /app/node_modules ./node_modules
COPY --from=build --chown=65532:65532 /app/dist ./dist
USER 65532
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s CMD ["/nodejs/bin/node", "dist/healthcheck.js"]
CMD ["dist/server.js"]
```

## Output

Return: (1) the hardened Dockerfile; (2) the `.dockerignore`; (3) the auditor output before and after; (4) the verification results (`id` output, image size before and after, scanner summary if run); (5) any rule you deliberately did not apply and why (e.g. "kept root: app binds to port 80 inside a legacy orchestrator").
