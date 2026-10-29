---
name: incident-response
description: Runs Acme Cloud incident response from first page to postmortem, including severity assignment, roles, the inc-war-room Slack channel, status page updates and customer comms. Use when someone says "we have an incident", "prod is down", "I got paged", "is this a SEV1", "write a status update", or "start the postmortem" at Acme Cloud.
license: Proprietary
---

# Acme Cloud Incident Response

Acme Cloud uses PagerDuty-style on-call with two rotations: `platform-primary` and
`app-primary`. Incidents are run in Slack and tracked in Linear (team INC).

## Severity

| Sev | Definition | Update cadence | Status page |
| --- | --- | --- | --- |
| SEV1 | Workflows not running for many workspaces, data loss, or security breach | every 30 min | required within 15 min |
| SEV2 | Major feature broken or degraded for many workspaces, no workaround | every 60 min | required within 30 min |
| SEV3 | Partial degradation, workaround exists, or single enterprise workspace | every 4 h | optional |
| SEV4 | Minor or internal-only | none | no |

When unsure between two levels, pick the higher one. Downgrading is cheap; a late
upgrade costs customer trust.

## Workflow

1. Declare: run `/incident declare` in Slack with a one-line summary and severity. This
   creates `#inc-YYYYMMDD-<slug>`, a Linear INC ticket, and pages the Incident Commander
   rotation for SEV1/SEV2.
2. Assign roles in the channel topic: Incident Commander (IC), Ops lead (hands on keyboard),
   Comms lead. For SEV3/4 the on-call can hold all three.
3. Cross-post the channel link in #inc-war-room. All SEV1/SEV2 coordination across teams
   happens there.
4. Stabilize before diagnosing. First options: roll back the last deploy
   (`acme deploy rollback <service> --env prod`), disable the feature flag, or scale out.
5. Post status updates using `templates/status-update.md` at the cadence above.
6. Update the public status page (status.acme.example) through `/incident statuspage`.
   Comms lead writes; IC approves.
7. For enterprise customers on the Premier plan, the Comms lead pings #support-premier so CSMs
   can contact them directly.
8. Resolve: `/incident resolve` once metrics are at baseline for 30 minutes.
9. Postmortem: SEV1/SEV2 require a written postmortem within 5 business days, reviewed in
   Thursday's reliability review. Use the Linear INC ticket to track action items.

## Rules

- Blameless. Write "the deploy" not "Sam's deploy". Reason: people hide information when blamed.
- Never post customer names, workspace IDs, or data samples in #inc-war-room or the status page.
  Use the incident channel, which is restricted.
- Never give an ETA publicly unless the fix is deployed and verifying.
- Security incidents (suspected breach, leaked credentials) go to #sec-incident instead and page
  `security-oncall`; do not use the public status page until Security approves.

## Example

Page: "billing-api 5xx rate 12%". On-call declares SEV2, sees billing-api deployed 18 minutes
ago, rolls back, 5xx drops to 0.2 percent in 6 minutes. Posts status updates at 0 and 60
minutes, resolves after 30 minutes stable, opens a postmortem.

## Output

Return: the severity with a one-line reason, the next three concrete actions, and a
ready-to-post status update filled from `templates/status-update.md`.
