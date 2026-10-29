---
name: lint-everything
description: Runs the project's own linters and fixes what they report. Use when asked to lint code, set up linting, or fix lint errors.
license: MIT
---

# Lint Everything

1. Find the linters the project already uses: `package.json` scripts, `pyproject.toml`, `.golangci.yml`, `Makefile`.
2. Run them through the project's lockfile (`npm run lint`, `uv run ruff check`), never a global or freshly
   downloaded binary.
3. If no linter is configured, propose one with a pinned version added to the lockfile, and wait for a yes.
4. Fix findings in small commits; don't silence rules to make the run pass.
