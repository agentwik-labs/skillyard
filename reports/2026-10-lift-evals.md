# Do skills actually help? We measured.

*October 29, 2026. Claude Code with Claude Haiku, 1 task per skill, 2 runs per condition. Rerun:*
`npx skillyard eval <skill-dir> --model haiku --runs 3`

Same task, same model, twice: once in an empty folder, once with the skill installed in `.claude/skills/`. Each answer
is graded by fixed checks in the skill's `evals/evals.json` (no AI judge). Lift = with-skill score minus without.

| Skill | Agent / model | Without skill | With skill | Lift |
|---|---|---|---|---|
| deploy-runbook | claude / haiku | 10% | 100% | +90 pts |
| database-migrations | claude / haiku | 100% | 100% | +0 pts |
| dockerfile-hardening | claude / haiku | 83% | 100% | +17 pts |
| commit-messages | claude / haiku | 50% | 88% | +38 pts |

<details><summary>deploy-runbook: per-check results</summary>

- **ship-to-prod** (without skill): FAIL uses the acme deploy CLI; FAIL promotes with --env prod; pass checks the deploy freeze; FAIL announces in #deploys; FAIL gives the rollback command
- **ship-to-prod** (without skill): FAIL uses the acme deploy CLI; FAIL promotes with --env prod; FAIL checks the deploy freeze; FAIL announces in #deploys; FAIL gives the rollback command
- **ship-to-prod** (with skill): pass uses the acme deploy CLI; pass promotes with --env prod; pass checks the deploy freeze; pass announces in #deploys; pass gives the rollback command
- **ship-to-prod** (with skill): pass uses the acme deploy CLI; pass promotes with --env prod; pass checks the deploy freeze; pass announces in #deploys; pass gives the rollback command

</details>

<details><summary>database-migrations: per-check results</summary>

- **rename-column** (without skill): pass adds the new column first; pass backfills; pass backfills in batches; pass sets a lock timeout; pass drops the old column in a later step
- **rename-column** (without skill): pass adds the new column first; pass backfills; pass backfills in batches; pass sets a lock timeout; pass drops the old column in a later step
- **rename-column** (with skill): pass adds the new column first; pass backfills; pass backfills in batches; pass sets a lock timeout; pass drops the old column in a later step
- **rename-column** (with skill): pass adds the new column first; pass backfills; pass backfills in batches; pass sets a lock timeout; pass drops the old column in a later step

</details>

<details><summary>dockerfile-hardening: per-check results</summary>

- **review-dockerfile** (without skill): pass runs as a non-root user; FAIL adds a HEALTHCHECK; pass uses npm ci; pass mentions .dockerignore; pass pins the base image by digest; pass exec-form CMD
- **review-dockerfile** (without skill): pass runs as a non-root user; FAIL adds a HEALTHCHECK; pass uses npm ci; pass mentions .dockerignore; pass pins the base image by digest; pass exec-form CMD
- **review-dockerfile** (with skill): pass runs as a non-root user; pass adds a HEALTHCHECK; pass uses npm ci; pass mentions .dockerignore; pass pins the base image by digest; pass exec-form CMD
- **review-dockerfile** (with skill): pass runs as a non-root user; pass adds a HEALTHCHECK; pass uses npm ci; pass mentions .dockerignore; pass pins the base image by digest; pass exec-form CMD

</details>

<details><summary>commit-messages: per-check results</summary>

- **breaking-change** (without skill): FAIL Conventional Commits subject; FAIL marks the breaking change; pass imperative mood; pass has a body
- **breaking-change** (without skill): FAIL Conventional Commits subject; FAIL marks the breaking change; pass imperative mood; pass has a body
- **breaking-change** (with skill): pass Conventional Commits subject; pass marks the breaking change; pass imperative mood; pass has a body
- **breaking-change** (with skill): FAIL Conventional Commits subject; pass marks the breaking change; pass imperative mood; pass has a body

</details>


## What it says

- **Company knowledge is where skills earn their keep (+90).** No model can guess that Acme ships with
  `acme deploy promote --env prod`, checks a deploy freeze first and announces in `#deploys`. Without the skill the
  agent wrote a plausible generic runbook that would be wrong at that company.
- **Format and house rules help a lot (+38, +17).** Without the skill, both commit messages skipped the Conventional
  Commits format and the breaking-change marker; both Dockerfile reviews left out a HEALTHCHECK.
- **Some skills teach the model what it already knows (+0).** Haiku already writes a textbook expand/contract
  migration. That skill costs context on every task and moves nothing for this model; keep it only if it helps a
  weaker model or encodes your own rules.

Limits: tiny sample (1 task, 2 runs each), one model, deterministic regex checks that can miss a good answer phrased
differently. Your own skills, models and tasks will differ, which is the point: measure them.
