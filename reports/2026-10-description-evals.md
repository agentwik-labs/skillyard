| Skill | Agent / model | Without skill | With skill | Lift |
|---|---|---|---|---|
| notes-v2 | claude / haiku | 0% | 60% | +60 pts |
| deploy-runbook | claude / haiku | 0% | 100% | +100 pts |

<details><summary>notes-v2: per-check results</summary>

- **ship-to-prod** (without skill): FAIL uses the acme deploy CLI; FAIL promotes with --env prod; FAIL checks the deploy freeze; FAIL announces in #deploys; FAIL gives the rollback command
- **ship-to-prod** (without skill): FAIL uses the acme deploy CLI; FAIL promotes with --env prod; FAIL checks the deploy freeze; FAIL announces in #deploys; FAIL gives the rollback command
- **ship-to-prod** (with skill): FAIL uses the acme deploy CLI; pass promotes with --env prod; FAIL checks the deploy freeze; FAIL announces in #deploys; FAIL gives the rollback command
- **ship-to-prod** (with skill): pass uses the acme deploy CLI; pass promotes with --env prod; pass checks the deploy freeze; pass announces in #deploys; pass gives the rollback command

</details>

<details><summary>deploy-runbook: per-check results</summary>

- **ship-to-prod** (without skill): FAIL uses the acme deploy CLI; FAIL promotes with --env prod; FAIL checks the deploy freeze; FAIL announces in #deploys; FAIL gives the rollback command
- **ship-to-prod** (without skill): FAIL uses the acme deploy CLI; FAIL promotes with --env prod; FAIL checks the deploy freeze; FAIL announces in #deploys; FAIL gives the rollback command
- **ship-to-prod** (with skill): pass uses the acme deploy CLI; pass promotes with --env prod; pass checks the deploy freeze; pass announces in #deploys; pass gives the rollback command
- **ship-to-prod** (with skill): pass uses the acme deploy CLI; pass promotes with --env prod; pass checks the deploy freeze; pass announces in #deploys; pass gives the rollback command

</details>


_Setup note (added Oct 30): these runs used the author's normal Claude Code setup, so personal instructions and memory were loaded in both conditions. `skillyard eval` now runs locked down (no shell, edit, web or MCP tools; reads confined to the test folder; `--bare` when an API key is set), so reruns may differ slightly._
