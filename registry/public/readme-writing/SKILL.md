---
name: readme-writing
description: Writes or rewrites a project README that gets a new user from zero to a working result fast, verified against the actual code (install commands, entry points, config, scripts). Use when asked to "write a README", "improve the README", "document this repo", "make this project easier to get started with", or when preparing a repository for open-sourcing or a first release.
license: MIT
---

# README Writing

Write the README a stranger needs in the first five minutes: what this is, whether it is for them, how to install it, and a copy-pasteable example that works. Everything in it must be verified against the repository, because a README with a broken quickstart is worse than none.

## Workflow

1. **Read the project before writing.** Inspect the package manifest (`package.json`, `pyproject.toml`, `Cargo.toml`, `go.mod`), entry points, CLI definitions, `Makefile`/scripts, `.env.example`, Dockerfile, CI config, LICENSE, and any existing docs. Note the real install command, minimum runtime version, and the commands CI runs.
2. **Identify the reader.** Library user, CLI user, self-hoster, or contributor. The top of the README serves the primary reader; contributor detail goes lower or into `CONTRIBUTING.md`.
3. **Write the one-line description**: what it does, for whom, in plain words. No "blazingly fast", "powerful", or "simple".
4. **Write the quickstart** as the shortest path to a visible result: install, minimal config, one command or code snippet, and the expected output.
5. **Verify every command you can.** Run the install and quickstart in a scratch environment if allowed; otherwise trace each command to the code (script exists, flag exists, env var is read). Mark anything unverified for the user.
6. **Add the rest only as needed**: configuration table, usage examples, how it works (short), development setup, license.
7. **Preserve what is valuable** in an existing README (badges that work, acknowledgements, links); remove stale content rather than leaving it.

## Section order (default)

1. Title and one-line description
2. Short paragraph or 3-5 bullets: what problem it solves, key features with concrete nouns
3. Quickstart (install + first result)
4. Usage (common tasks, each with a runnable snippet)
5. Configuration (table: name, default, description)
6. How it works (optional, a few sentences or a diagram)
7. Development (clone, install deps, run tests, lint)
8. Contributing, License

## Rules

- **Copy-pasteable commands.** No `$` prompts in code blocks, no placeholders inside commands unless called out (`<your-token>`), one command per line.
- **Show output.** After the main example, show what success looks like so the reader can tell it worked.
- **State requirements with versions**: "Python 3.10+", "Node 20+", "Docker 24+".
- **Configuration from code, not memory.** Every env var in the table must be read somewhere in the source; grep for it.
- **Concrete over abstract.** "Converts Markdown to PDF with a table of contents" beats "a flexible document processing toolkit".
- **No walls of badges.** At most build, version, license.
- **Link, don't duplicate.** Long API references go in `docs/`; the README links to them.
- **Keep it honest about status**: say "alpha", "unmaintained", or "not production-ready" when true.

## Example

Bad opening:
> # DataFlow
> DataFlow is a powerful, flexible, next-generation framework for all your data needs.

Good opening:
> # dataflow
> Sync rows from Postgres tables to a BigQuery dataset every few minutes, with schema changes applied automatically. For teams who want a warehouse copy without running Airbyte or Fivetran.
>
> ```bash
> pip install dataflow-sync
> dataflow init --source postgres://localhost/app --dest bq://my-project.analytics
> dataflow run --once
> ```
> ```
> synced 12 tables, 48,210 rows in 9.4s
> ```

## Output

- Write `README.md` at the repo root (use `templates/README.md` as a skeleton; drop sections that do not apply).
- In your reply, list: commands you verified by running, commands you verified only by reading code, and anything you could not verify or had to guess.
