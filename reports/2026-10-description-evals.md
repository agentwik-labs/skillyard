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

