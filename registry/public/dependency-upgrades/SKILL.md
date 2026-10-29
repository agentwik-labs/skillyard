---
name: dependency-upgrades
description: Upgrades project dependencies safely by inventorying what is outdated, reading changelogs for breaking changes, upgrading in small risk-ordered batches, and verifying each batch with tests; includes a stdlib script that classifies pending upgrades by semver risk. Use when asked to "update dependencies", "bump packages", "upgrade React/Django/Spring to vN", "fix this Dependabot/Renovate PR", "resolve npm audit / pip-audit findings", or "we're on an old version of X".
license: MIT
---

# Dependency Upgrades

Keep dependencies current without breaking production. Upgrades fail in two ways: a big-bang bump of everything that breaks in ten places at once, or never upgrading until a security fix forces a three-major-version jump. Upgrade in small, verified, risk-ordered batches, and read what changed before changing it.

## Workflow

1. **Find the package manager and lockfile.** npm/pnpm/yarn (`package-lock.json`, `pnpm-lock.yaml`, `yarn.lock`), pip/uv/poetry (`requirements*.txt`, `uv.lock`, `poetry.lock`), Go (`go.mod`), Cargo, Bundler, Maven/Gradle, Composer, NuGet. Never edit a lockfile by hand.
2. **Get a green baseline.** Run the build and full test suite before changing anything. If it is red, stop and report; you cannot attribute failures otherwise.
3. **Inventory outdated packages** with the native tool:
   - `npm outdated --json`, `pnpm outdated --format json`, `yarn outdated`
   - `pip list --outdated --format json`, `uv pip list --outdated`, `poetry show --outdated`
   - `go list -m -u -json all`, `cargo outdated`, `bundle outdated`, `./gradlew dependencyUpdates`
   - Security: `npm audit --json`, `pip-audit -f json`, `govulncheck ./...`, `cargo audit`
4. **Classify by risk.** Pipe the JSON into `python3 scripts/classify_upgrades.py --format npm outdated.json` (formats: `npm`, `pip`, `simple`; see `--help`). It sorts packages into patch / minor / major / pre-1.0 buckets and highlights security-relevant ones you name with `--security`.
5. **Plan batches** in this order:
   1. Security fixes (smallest version that fixes the advisory).
   2. Patch updates, all together.
   3. Minor updates, grouped by ecosystem area (test tooling, lint tooling, runtime libs).
   4. Each major update on its own, and each `0.x` minor on its own (semver allows breaking changes there).
   5. Runtime/language upgrades (Node, Python, JDK) last and separately.
6. **For every major or 0.x bump, read the changelog / release notes / migration guide** between the current and target versions. List the breaking changes that touch APIs this codebase uses (search for them).
7. **Apply one batch**, using the tool (`npm install pkg@^5`, `uv add 'pkg>=5,<6'`, `go get pkg@v5`), then build, run tests, lint and typecheck. Fix breakages caused by the upgrade in the same batch; nothing else.
8. **Commit each batch separately** with the versions in the message (`build(deps): bump express 4.19.2 -> 4.21.1`) so a bad batch can be reverted alone.

## Rules

- **Do not upgrade and refactor in the same change.** Only make the code changes the upgrade requires.
- **Respect declared ranges** for libraries you publish; widening or narrowing peer ranges is a breaking change for your users.
- **Prefer the latest patch of the current major** when a major upgrade is not in scope.
- **Deduplicate after upgrading** (`npm dedupe`, `pnpm dedupe`) and check that you did not end up with two copies of a framework (two Reacts, two protobuf runtimes).
- **Transitive vulnerabilities:** first upgrade the direct dependency that pulls them in. Use overrides/resolutions (`overrides` in package.json, `constraints.txt`, `replace` in go.mod) only as a documented, temporary last resort.
- **Check runtime compatibility**: the new version's minimum Node/Python/JDK version and your deployed runtime.
- **Watch for silent behavior changes** that tests may not catch: default timeouts, serialization formats, date parsing, TLS defaults, log formats. Note them for the reviewer.
- **Do not pin to exact versions in libraries** to "fix" an issue; pin in the application lockfile.
- **If a major upgrade needs more than roughly a day of changes**, stop and propose a plan (codemods, compatibility shims, incremental migration) instead of a giant diff.

## Reviewing a bot PR (Dependabot, Renovate)

1. Read the release notes the bot links; do not trust the version number alone.
2. Check the lockfile diff for unexpected transitive changes (new packages, removed packages, install scripts).
3. Confirm CI ran the full suite, not a cached or skipped job.
4. For grouped PRs that fail, split out the failing package rather than closing the whole group.
5. New maintainers, a sudden new install script, or a package that was renamed or transferred are supply-chain signals; flag them before merging.

## Example

Bad: `npm update && npx npm-check-updates -u && npm install` across 140 packages, tests fail in 23 places, one commit "update deps".

Good:

1. `fix(deps): bump jsonwebtoken 8.5.1 -> 9.0.2 (GHSA-8cf7-32gw-wr33)`; read migration notes, code relied on default `algorithms`, now set explicitly.
2. `build(deps): bump 31 patch versions`; tests green.
3. `build(deps): bump eslint plugins (minor)`; tests green.
4. `build(deps): bump express 4 -> 5`; read migration guide, updated 3 `req.param()` calls and path syntax in 2 routes; tests green.

## Output

Return: (1) the risk-classified inventory (script output); (2) the batch plan; (3) per applied batch: packages and versions, breaking changes found in release notes and how each was handled, test results; (4) upgrades deferred and why (e.g. "Django 5 needs Python 3.10, prod runs 3.9").
