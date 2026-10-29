---
name: notes-v2
description: Internal notes.
license: Proprietary
---

<!-- Teaching example from Skillyard's good-vs-bad gallery. This is a BAD skill on purpose. Do not install it. -->

# Acme Cloud Deploy Runbook

All Acme Cloud services run on EKS clusters in AWS (us-east-1 primary, eu-west-1 for EU
workspaces). Deploys go through Argo CD, driven by the `acme` CLI. Never `kubectl apply`
to a prod cluster by hand.

## Environments

| Env | Cluster | Who can promote | Auto-deploy |
| --- | --- | --- | --- |
| dev | eks-dev-use1 | any engineer | on merge to main |
| staging | eks-stg-use1 | any engineer | no |
| prod | eks-prod-use1, eks-prod-euw1 | on-call or service owner | no |

## Workflow

1. Confirm CI is green on the commit: `acme ci status <service> --sha <sha>`.
2. Confirm the commit is on dev and healthy for at least 15 minutes:
   `acme deploy status <service> --env dev`.
3. Promote to staging: `acme deploy promote <service> --env staging --sha <sha>`.
4. Run the smoke suite: `acme smoke run <service> --env staging`. It must pass.
5. Check the deploy calendar: `acme deploy freeze status`. If a freeze is active, stop and
   tell the user; exceptions need a VP Eng approval in #deploy-exceptions.
6. Post in #deploys: service, sha, Linear ticket, and "promoting to prod".
7. Promote to prod: `acme deploy promote <service> --env prod --sha <sha>`. The CLI
   rolls out us-east-1 first as a 10 percent canary, then waits 20 minutes before full and EU.
8. Watch the canary dashboard (`acme dash canary <service>`). Abort on any rollback trigger.
9. Reply in the #deploys thread with "done" and the final rollout time.

## Rollback triggers

Roll back without discussion if, during canary or within 60 minutes of full rollout:
- 5xx rate above 1 percent for 5 minutes,
- p95 latency up more than 30 percent over the 7-day baseline,
- any SEV1 or SEV2 alert on the service.

Rollback: `acme deploy rollback <service> --env prod`. This redeploys the previous
image; it does not revert migrations (see below).

## Rules

- Deploy windows: Monday to Thursday, 09:00 to 16:00 US Eastern. No Friday prod deploys.
  Reason: weekend on-call is a single engineer.
- Database migrations ship in a separate deploy, before the code that needs them, and
  must be backward compatible for one release. Reason: rollback never reverts schema.
- Feature flags (LaunchDarkly, project `acme-app`) are the default way to release
  risky behavior. Default new flags to off in prod.
- One prod promotion per service at a time. The CLI enforces a lock; do not use `--force-unlock`
  unless the lock holder confirms in #deploys.
- Secrets come from AWS Secrets Manager via External Secrets. Never put secrets in Helm values.

## Example

User: "Ship billing-api a3f9c21 to prod."
Agent checks CI (green), dev status (healthy 3h), promotes to staging, runs smoke (pass),
checks freeze (none), posts in #deploys, runs `acme deploy promote billing-api --env prod --sha a3f9c21`,
reports canary metrics at 20 minutes and confirms full rollout.

## Output

Report as a short checklist: each step with pass/fail, the commands run, links to the
#deploys thread and canary dashboard, and an explicit "Rolled out" or "Stopped at step N because ...".
