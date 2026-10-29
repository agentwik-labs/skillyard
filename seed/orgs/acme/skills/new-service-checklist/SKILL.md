---
name: new-service-checklist
description: Walks through standing up a new Acme Cloud backend service, from repo scaffold and Kubernetes manifests to observability, on-call ownership and the production readiness review. Use when someone says "create a new service", "spin up a microservice", "is this service ready for prod", or "production readiness review" at Acme Cloud.
license: Proprietary
---

# Acme Cloud New Service Checklist

New services are rare and expensive to own. First confirm a new service is warranted;
most features belong in an existing service in the `acme-api` monorepo.

## Step 0: should this be a service?

Proceed only if at least one is true: different scaling profile, different data store,
different on-call owner, or a hard isolation requirement. Otherwise, add a module to `acme-api`.
Write the answer in the design doc (template in Notion: Eng > Design docs).

## Workflow

1. Name it `<domain>-<role>` in kebab-case, e.g. `billing-worker`, `connectors-gateway`.
   Max 30 characters. It becomes the Kubernetes namespace and Datadog service tag.
2. Scaffold: `acme service new <name> --template node-fastify` (or `--template node-worker`).
   This creates the package, Helm chart, Dockerfile, CI workflow and CODEOWNERS entry.
3. Register ownership in `catalog/services.yaml`: owning team, Slack channel, Linear team,
   on-call rotation, tier (T1 customer-facing, T2 internal, T3 batch).
4. Infra: request database or queue via the `infra-requests` Linear template. Terraform
   lives in `acme-infra/services/<name>`; platform team reviews.
5. Secrets in AWS Secrets Manager at `/acme/<env>/<name>/*`, wired with External Secrets.
6. Observability: Datadog APM enabled by the template; add at least the three golden
   monitors (error rate, p95 latency, saturation) with `acme monitors init <name>`.
7. Deploy to dev and staging using deploy-runbook.
8. Book a production readiness review (PRR) in #platform-prr at least 5 business days before
   the target launch.

## PRR must-haves

- [ ] Owner, on-call rotation and escalation path in `catalog/services.yaml`
- [ ] Runbook at `docs/runbooks/<name>.md` with top 3 failure modes
- [ ] Monitors routed to the owning rotation; at least one tested page
- [ ] Health endpoints `/healthz` (liveness) and `/readyz` (readiness)
- [ ] Resource requests and limits set; HPA configured for T1
- [ ] Data class documented (see data-access-policy); no C3 data without Security sign-off
- [ ] Load test result at 2x expected peak
- [ ] Rollback tested in staging

## Rules

- T1 services need two people on the rotation before launch. Reason: single-owner T1
  services paged the same engineer 40 nights in 2025.
- No service launches to prod without a passed PRR. Platform will not create the prod Argo app.
- Services must not share databases. Reason: shared schemas block independent deploys.

## Example

"We want a service to send webhooks." Agent checks Step 0 (different scaling profile: yes),
proposes `webhooks-dispatcher`, tier T1, scaffolds with `--template node-worker`, lists
SQS request, monitors, and books the PRR.

## Output

Return the Step 0 verdict, the proposed name and tier, the commands to run, and the PRR
checklist with each item marked done, todo, or n/a.
