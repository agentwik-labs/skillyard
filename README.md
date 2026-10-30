# Skillyard

A skill registry for AI agents. Keep open-source skills and your company's private ones in one place, and install
them into **Claude Code, OpenAI Codex, Cursor and any AGENTS.md agent** (Gemini CLI, Copilot, Windsurf, Aider), or let
agents search and load them live over **MCP**.

A *skill* is a folder with a `SKILL.md` (YAML frontmatter + instructions) and optional `scripts/`, `references/` and
`templates/`, following the [Agent Skills](https://agentskills.io) format. Skillyard adds what a team needs around
that format: private org scopes with access tokens, immutable versions, a security scan on every publish, one-command
installs for every agent, a project manifest teammates can sync, and an audit log.

```
npx skillyard install code-review @acme/deploy-runbook --agent claude,codex --save
```

**Live demo:** https://agentwik-labs.github.io/skillyard/ (read-only; click *Sign in* and type `acme` or `northwind`
to see two fictional companies' private skills).

**Reports:** [We scanned the 34 most-installed skill repos](reports/2026-10-top-skills-scan.md) ·
[Do skills actually help? Lift evals](reports/2026-10-lift-evals.md) ·
[Good skills, bad skills: 12 examples and why](examples/README.md)

## What's in the box

| | |
|---|---|
| **Registry server** | REST API, web UI, and an MCP endpoint at `/mcp`. Zero dependencies (Node ≥ 20), file-backed storage. |
| **Private skills** | Every skill lives under a scope (`@acme/…`). Org skills are private by default, visible only to that org's tokens; a company can still publish selected skills publicly. |
| **Security scan** | Every publish is scanned for prompt-injection phrasing, instructions to hide actions from the user, invisible Unicode, embedded secrets, `curl \| sh`, credential-file reads and secret exfiltration. Critical findings block the publish; warnings are shown on the skill page. |
| **Cross-agent install** | `skillyard install` writes each skill where each agent looks: `.claude/skills/`, `.codex/skills/`, `.cursor/rules/*.mdc` (+ files), and `.agents/skills/` with a managed index in `AGENTS.md`. |
| **MCP server** | Tools `search_skills`, `get_skill`, `read_skill_file`; every skill as an MCP prompt and resource. Over HTTP from the registry, or as a stdio bridge (`skillyard mcp`). |
| **Lift evals** | `skillyard eval <skill>` runs the skill's `evals/evals.json` tasks through Claude Code or Codex with and without the skill, grades both with fixed checks, and reports the lift. Skills that don't help are context you pay for on every task. |
| **Scan any folder** | `skillyard scan <dir>` finds every skill under a folder (a repo, `~/.claude/skills`) and reports what runs code, talks to the network or hides instructions. |
| **Project manifest** | `skills.json` lists a project's skills and agents; `skillyard sync` reproduces the set on any machine. |
| **Claude plugin marketplace** | This repo is a Claude Code marketplace of the open-source skills, and `skillyard export claude-marketplace --scope acme` turns an org's private skills into a marketplace for a private git repo. |
| **Seed content** | 24 open-source skills in [`registry/public`](registry/public) and two fictional companies with 13 private skills in [`seed/orgs`](seed/orgs). |

## Quick start

```sh
npm run dev                # loads the bundled skills, then serves http://127.0.0.1:7420
```

`seed` prints a demo token for each fictional company (also saved to `data/demo-tokens.json`). Paste one into
**Sign in** in the web UI to see that company's private skills, or use it from the CLI:

```sh
export SKILLYARD_REGISTRY=http://127.0.0.1:7420
node bin/skillyard.js search review
node bin/skillyard.js login --token sy_…          # an acme token
node bin/skillyard.js search deploy               # now includes @acme/deploy-runbook
node bin/skillyard.js install @acme/deploy-runbook code-review --agent all
```

## Use from your agent

**Install** copies skills into the agent's own folder, so they load automatically and work offline:

```sh
skillyard install code-review                    # detected agents in this project (default: claude)
skillyard install @acme/incident-response -g     # user-wide (Claude Code, Codex)
skillyard install sql-review --agent cursor      # writes .cursor/rules/sql-review.mdc + .cursor/skills/sql-review/
skillyard list && skillyard update
```

**MCP** lets the agent search everything your token can see and pull in a skill when a task calls for it:

```sh
skillyard connect claude --write    # runs `claude mcp add --transport http skillyard <registry>/mcp …`
skillyard connect codex --write     # adds [mcp_servers.skillyard] to ~/.codex/config.toml
skillyard connect cursor --write    # .cursor/mcp.json (token read from ${env:SKILLYARD_TOKEN})
skillyard connect vscode | gemini | claude-desktop
```

**Claude Code plugins**: `/plugin marketplace add agentwik-labs/skillyard`, then `/plugin install skillyard-engineering@skillyard`.

See [docs/agents.md](docs/agents.md) for where each agent reads skills and how each config looks.

## Roll it out to your team

```sh
npx -y https://github.com/agentwik-labs/skillyard/archive/refs/heads/main.tar.gz kit .
```

Copies the [team starter kit](starter-kit/README.md) into your repo: a two-week plan, a 30-minute kickoff agenda,
a skill review checklist, fill-in `data-handling` and `definition-of-done` skills with evals, a new-skill template,
and a CI check. No server needed: `skillyard install ./skills/* --agent all` installs straight from the folder.

## Run it for a company

```sh
SKILLYARD_ADMIN_TOKEN=$(openssl rand -hex 24) skillyard serve --host 0.0.0.0 --data /var/lib/skillyard
skillyard org create acme --name "Acme Cloud"            # prints an owner token (read + publish)
skillyard token create --org acme --scopes read --name laptop-dana
skillyard new deploy-runbook && skillyard publish deploy-runbook --org acme
```

Or with Docker: `docker build -t skillyard . && docker run -p 7420:7420 -v skillyard-data:/data skillyard`.
Put it behind TLS (any reverse proxy). Tokens are stored as SHA-256 hashes; org members manage tokens and see the
activity log on their org page. See [docs/self-hosting.md](docs/self-hosting.md).

## Authoring skills

```
my-skill/
  SKILL.md          # required: frontmatter name + description, then instructions
  skill.json        # optional: version, title, summary, category, tags, visibility
  scripts/          # helpers the agent runs (stdlib-only is kindest)
  references/       # long detail the agent reads on demand
  templates/        # fill-in documents
```

Add `evals/evals.json` (tasks plus pass/fail checks) and run `skillyard eval <dir> --model haiku --runs 3` to see
whether the skill helps. `skillyard validate <dir>` checks the format and runs the same security scan as the server. Versions are
immutable; bump `version` in `skill.json` to publish a change. Contribution rules for the open-source set are in
[CONTRIBUTING.md](CONTRIBUTING.md).

## API

| Method | Path | Auth |
|---|---|---|
| GET | `/api/skills?q=&scope=&category=` | optional |
| GET | `/api/skills/@{scope}/{name}?version=` | private: org read |
| GET | `/api/skills/@{scope}/{name}/bundle` · `/files/{path}` | private: org read |
| POST | `/api/skills/@{scope}` `{files: {path: base64}, visibility}` | org publish |
| PATCH / DELETE | `/api/skills/@{scope}/{name}` | org publish |
| GET / POST / DELETE | `/api/orgs/{org}/tokens[/{id}]` | org publish |
| GET | `/api/orgs/{org}/events` | org publish |
| POST | `/api/orgs` | admin |
| POST | `/mcp` (JSON-RPC, MCP 2025-06-18) | optional |

## Development

```sh
npm test           # node:test, no dependencies
npm run validate   # validate + scan every bundled skill
npm run build:marketplace
```

MIT licensed. Skills in `registry/public` are MIT; the `seed/orgs` companies are fictional demo data.
