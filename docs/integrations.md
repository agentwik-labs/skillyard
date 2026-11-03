# Skills in your development process

Where Skillyard plugs into the work a team already does, from a laptop to CI to the team channel.

| Moment | What happens | Set it up |
|---|---|---|
| **Project setup** | The repo's `skills.json` lists the skills and agents the team uses | `skillyard init`, then `skillyard install <skill> --save` |
| **`git pull` / switching branches** | Skills re-sync, so a teammate's skill change reaches every agent without anyone asking | `skillyard hooks install` (post-merge, post-checkout) |
| **Starting a Claude Code session** | Skills sync before the first prompt | `skillyard hooks install --claude` (a SessionStart hook in `.claude/settings.json`) |
| **Mid-task, any agent** | The agent searches the registry and loads the skill that fits, including private company ones | `skillyard connect claude|codex|cursor|vscode|gemini --write` (MCP) |
| **Pull request that changes a skill** | Format check and security scan, with a summary on the run page; blocking findings fail the check | `uses: agentwik-labs/skillyard@main` in a workflow (see below), or `skillyard ci` |
| **Every week** | Studio reads agent logs (with consent), drafts fixes for corrections that repeat, tests each one, and posts the proposals to your channel | `skillyard studio`, turn on review and notifications in Privacy and consent |
| **Approval** | A person approves, edits or rejects each proposal; approvals install into Claude Code and Codex and can be undone | The Studio inbox |
| **Free skills from the community** | Openly licensed skills from public repos are imported with their licence and source commit, after the same scan | `skillyard import` (curated list in `sources/community.json`) or `skillyard import owner/repo` |

## GitHub Action

```yaml
name: skills
on:
  pull_request:
    paths: ["skills/**", ".claude/skills/**"]
permissions:
  contents: read
jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          persist-credentials: false
      - uses: agentwik-labs/skillyard@main
        with:
          paths: skills .claude/skills
```

## Notifications

Studio posts `{ "text": "…" }` to any https webhook: a Slack incoming webhook works as is; Zapier, n8n or Make can
forward it to Linear, Jira, Teams or email. Only proposal titles and test scores are sent, never the corrections
they were drawn from.

## Imports and licences

`skillyard import` clones a public GitHub repository shallowly (no submodules, symlinks off, nothing executed),
keeps a skill only when its licence is permissive (MIT, Apache-2.0, BSD, ISC, CC-BY-4.0, CC0, Unlicense), copies the
licence file into the skill, records the source repository, path and commit, de-duplicates copies of the same skill,
and runs the format check and security scan. Skills without a licence, with a proprietary licence, or with critical
scan findings are skipped and listed with the reason. Re-running updates changed skills and leaves the rest alone.

## How runs are confined

Every model call Studio and `skillyard eval` make goes through `claude -p` with: an empty temp folder, no MCP
servers (`--strict-mcp-config`), an explicit default permission mode (so a user's bypass setting does not carry over),
only the tools the test needs (`--tools Read Skill`, reads limited to the test folder; none at all for review calls),
and shell, edit, web and sub-agent tools blocked. With `ANTHROPIC_API_KEY` set, `--bare` also leaves out the user's
own memory and hooks; without it, your personal CLAUDE.md loads in both conditions of a test.
