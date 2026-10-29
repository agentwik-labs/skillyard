# Connecting agents

Skillyard reaches an agent in one of two ways. Use both if you like: installed skills for the handful a project
always needs, MCP for the long tail.

| Agent | Installed skills go to | Global (`-g`) | MCP config |
|---|---|---|---|
| Claude Code | `.claude/skills/<name>/` | `~/.claude/skills/<name>/` | `claude mcp add --transport http skillyard <url>/mcp --header "Authorization: Bearer …"` or `.mcp.json` |
| OpenAI Codex | `.codex/skills/<name>/` | `~/.codex/skills/<name>/` | `~/.codex/config.toml` → `[mcp_servers.skillyard]` with `url` + `bearer_token_env_var` |
| Cursor | `.cursor/rules/<name>.mdc` + `.cursor/skills/<name>/` | project only | `.cursor/mcp.json` |
| AGENTS.md agents (Gemini CLI, Copilot, Windsurf, Aider, Zed…) | `.agents/skills/<name>/` + index in `AGENTS.md` | project only | per agent (`skillyard connect vscode`, `gemini`) |
| Claude Desktop / other stdio clients | — | — | `command: npx -y skillyard mcp` with `SKILLYARD_REGISTRY` / `SKILLYARD_TOKEN` env |

`skillyard connect <agent>` prints the exact config for your registry and token; add `--write` to apply it.
Project-level configs reference the token through an environment variable, so they are safe to commit.

## How installs stay safe

- Each installed folder carries a `.skillyard-install.json` marker (id, version, checksum). Skillyard never
  overwrites or deletes a folder without one unless you pass `--force`.
- Paths in a bundle are checked again on install (`..`, absolute paths and backslashes are refused).
- Scripts under `scripts/` are made executable; nothing is run at install time.
- `AGENTS.md` is edited only between `<!-- skillyard:start -->` and `<!-- skillyard:end -->`.

## MCP surface

| Kind | Name | Purpose |
|---|---|---|
| tool | `search_skills` `{query, scope?, category?, limit?}` | Find skills the token can see |
| tool | `get_skill` `{skill}` | Full SKILL.md plus the file list (`@acme/deploy-runbook`, `code-review`, `@acme/x@1.2.0`) |
| tool | `read_skill_file` `{skill, path}` | A supporting file |
| prompt | `<scope>.<name>` | The skill as a ready-to-use prompt (optional `task` argument) |
| resource | `skill://@scope/name/<path>` | Any file in a skill |

The server's `instructions` tell the agent to search before non-trivial tasks and to prefer company skills over
community ones when they conflict. The HTTP endpoint answers JSON (no SSE stream) and rejects browser `Origin`s
it does not know, per the MCP spec's DNS-rebinding guidance; allow more with `SKILLYARD_ALLOWED_ORIGINS`.

## Team setup in one file

```json
{
  "registry": "https://skills.acme.example",
  "agents": ["claude", "codex", "cursor"],
  "skills": {
    "code-review": "^1.0.0",
    "@acme/deploy-runbook": "^1.0.0",
    "@acme/code-standards": "latest"
  }
}
```

Commit `skills.json`; teammates run `skillyard sync`. Add `.claude/skills/`, `.codex/skills/` etc. to `.gitignore` if
you would rather not commit the installed copies.
