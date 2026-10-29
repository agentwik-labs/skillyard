| Skill | Agent / model | Without skill | With skill | Lift |
|---|---|---|---|---|
| notes-v2 | claude / haiku | 10% | 100% | +90 pts |
| quick-commits | claude / haiku | 50% | 50% | +0 pts |

<details><summary>notes-v2: per-check results</summary>

- **ship-to-prod** (without skill): FAIL uses the acme deploy CLI; FAIL promotes with --env prod; FAIL checks the deploy freeze; FAIL announces in #deploys; FAIL gives the rollback command
- **ship-to-prod** (without skill): FAIL uses the acme deploy CLI; pass promotes with --env prod; FAIL checks the deploy freeze; FAIL announces in #deploys; FAIL gives the rollback command
- **ship-to-prod** (with skill): pass uses the acme deploy CLI; pass promotes with --env prod; pass checks the deploy freeze; pass announces in #deploys; pass gives the rollback command
- **ship-to-prod** (with skill): pass uses the acme deploy CLI; pass promotes with --env prod; pass checks the deploy freeze; pass announces in #deploys; pass gives the rollback command

</details>

<details><summary>quick-commits: per-check results</summary>

- **breaking-change** (without skill): FAIL Conventional Commits subject; FAIL marks the breaking change; pass imperative mood; pass has a body
- **breaking-change** (without skill): FAIL Conventional Commits subject; FAIL marks the breaking change; pass imperative mood; pass has a body
- **breaking-change** (with skill): FAIL Conventional Commits subject; FAIL marks the breaking change; pass imperative mood; pass has a body
- **breaking-change** (with skill): FAIL Conventional Commits subject; FAIL marks the breaking change; pass imperative mood; pass has a body

</details>

