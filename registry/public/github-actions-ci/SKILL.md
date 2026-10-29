---
name: github-actions-ci
description: Writes and reviews GitHub Actions workflows that are fast, cached, least-privilege and safe against supply-chain and injection attacks, with pinned actions, scoped permissions, concurrency control and required checks. Use when asked to "set up CI", "add a GitHub Actions workflow", "speed up CI", "fix this workflow", "why is CI slow/flaky", "add a release/deploy workflow", or when reviewing any file under .github/workflows/.
license: MIT
---

# GitHub Actions CI

Build CI that gives a trustworthy signal in minutes and cannot be used to steal secrets or push malicious code. Treat workflow files as production code with write access to your repository: least privilege, pinned dependencies, no untrusted input in shell commands.

## Workflow

1. **Inventory.** Read every file in `.github/workflows/`, plus the project's build, lint and test commands (package scripts, Makefile, task runner). CI should call the same commands developers run locally; do not re-implement build logic in YAML.
2. **Decide the jobs.** Typical: `lint` (format, lint, typecheck), `test` (unit, possibly matrixed), `build`; then `integration`/`e2e` if they exist. Independent jobs run in parallel.
3. **Write or fix the workflow** following the rules.
4. **Validate.** Run `actionlint` if available (`actionlint .github/workflows/*.yml`); otherwise check YAML syntax. For a push, use a branch and confirm the run is green with `gh run watch`.
5. **Measure.** Compare wall-clock time before and after with `gh run list --workflow <name> --limit 10`.

## Security rules

- **Set `permissions:` explicitly** at the workflow level, starting from `contents: read`, and grant more per job only where needed (`pull-requests: write`, `id-token: write` for OIDC). The default token is often read-write on everything.
- **Pin third-party actions to a full commit SHA** with the version in a comment: `uses: actions/checkout@<40-char-sha> # v4.1.7`. Tags can be moved by whoever controls the action. Let Dependabot (`package-ecosystem: github-actions`) bump them.
- **Never interpolate untrusted input into `run:`.** `${{ github.event.pull_request.title }}`, `head_ref`, issue bodies, commit messages and branch names are attacker-controlled. Pass them through `env:` and quote the variable:
  ```yaml
  env:
    TITLE: ${{ github.event.pull_request.title }}
  run: echo "$TITLE"
  ```
- **Avoid `pull_request_target`** and `workflow_run` with checkout of the PR head. They run with secrets on code from forks. If unavoidable, never check out or execute PR code in that job.
- **Use OIDC for cloud deploys** (`aws-actions/configure-aws-credentials` with `role-to-assume`, GCP workload identity, Azure federated credentials) instead of long-lived keys in secrets.
- **Scope secrets with environments** (`environment: production`) with required reviewers for deploys.
- **Set `persist-credentials: false`** on `actions/checkout` unless a later step needs to push.

## Speed and reliability rules

- **Cancel superseded runs:**
  ```yaml
  concurrency:
    group: ${{ github.workflow }}-${{ github.ref }}
    cancel-in-progress: ${{ github.ref != 'refs/heads/main' }}
  ```
- **Cache dependencies** with the setup action's built-in cache (`actions/setup-node` `cache: npm`, `actions/setup-python` `cache: pip`, `actions/setup-go` caches by default) keyed on the lockfile. Cache build outputs only if restoring is faster than rebuilding.
- **Install with lockfile-exact commands** (`npm ci`, `pip install -r requirements.txt` with hashes, `uv sync --frozen`, `go mod download`).
- **Set `timeout-minutes`** on every job (default is 6 hours).
- **Use path filters** (`on.pull_request.paths`) or `dorny/paths-filter` for monorepos so unrelated changes skip expensive jobs. Required checks that are skipped by path filters block merges; gate with a final always-run job instead.
- **Matrix only what you support.** Test the min and max supported runtime versions, not every version in between. Use `fail-fast: false` so one failure does not hide others.
- **Shard slow test suites** across matrix jobs rather than buying bigger runners first.
- **Do not retry flaky tests silently.** Quarantine and fix them; a retry loop hides real failures.
- **Upload test reports and artifacts on failure** (`if: failure()`), with `retention-days` set.

## Triggers

- `pull_request` for checks on PRs; `push` on `main` only (not every branch, or PRs run twice).
- `workflow_dispatch` for manual reruns of deploy/release workflows.
- `schedule` for nightly jobs; note scheduled workflows are disabled after 60 days of repo inactivity.

## Example

Bad:

```yaml
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@master
      - run: echo "Testing ${{ github.event.pull_request.title }}"
      - run: npm install && npm test
```

Good:

```yaml
name: ci
on:
  pull_request:
  push:
    branches: [main]
permissions:
  contents: read
concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: ${{ github.ref != 'refs/heads/main' }}
jobs:
  test:
    runs-on: ubuntu-24.04
    timeout-minutes: 15
    strategy:
      fail-fast: false
      matrix:
        node: [18, 22]
    steps:
      - uses: actions/checkout@692973e3d937129bcbf40652eb9f2f61becf3332 # v4.1.7
        with:
          persist-credentials: false
      - uses: actions/setup-node@1e60f620b9541d16bece96c5465dc8ee9832be0b # v4.0.3
        with:
          node-version: ${{ matrix.node }}
          cache: npm
      - run: npm ci
      - run: npm run lint
      - run: npm test -- --ci
```

Verify any SHA you write against the action's release page; do not copy SHAs from examples.

## Output

Return: (1) the workflow file(s); (2) a short list of changes and the reason for each (security, speed, correctness); (3) `actionlint` output or the validation you did; (4) required repository settings the user must apply by hand (branch protection required checks, environments and reviewers, Dependabot config, OIDC trust policy).
