---
name: change-management
description: Raises, classifies, approves and records production changes at Northwind Pay following its SOC 2 and PCI-DSS change-control process in Jira project CHG, including freeze windows and emergency changes. Use when someone says "open a change ticket", "do I need a CHG for this", "emergency change", "can I deploy during the freeze", or prepares a production release at Northwind Pay.
license: Proprietary
---

# Northwind Pay Change Management

Auditors sample our production changes every quarter. Each sampled change must show a
ticket, a peer review, an approval by someone other than the author, a test record and a
deploy record that match. This skill keeps that evidence complete.

## Change types

| Type | Examples | Approval | Lead time |
| --- | --- | --- | --- |
| Standard | Routine app deploy via pipeline, flag toggle in a pre-approved catalog | Pre-approved; ticket auto-created by pipeline | none |
| Normal | Schema migration, infra change, new service, config change in CDE | Change Advisory Board (CAB) | submit by Tuesday 17:00 ET for Thursday CAB |
| Emergency | Fix for active SEV1/SEV2 or security vulnerability | On-call EM plus one CAB member, retro-review at next CAB | none |

## Workflow

1. Classify using the table. When unsure, it is Normal.
2. Create the ticket: `nwctl change new --type normal --service <svc>` (creates a Jira CHG
   issue from `templates/change-request.md`). Standard changes are created by the pipeline.
3. Fill every field: description, risk (low, medium, high), affected services, CDE impact
   (yes or no), test evidence link, rollback plan, deploy window, implementer, approver.
4. Link the PR(s). The PR must be approved by someone other than the author; the CI check
   `chg-link` fails if the PR has no CHG key in its title, e.g. `CHG-1423: add payout index`.
5. CDE impact yes: attach the pci-compliance-review result and add a `pci-reviewers` approver.
6. Get approval (CAB for Normal). Approval must be recorded in Jira before the deploy.
7. Deploy in the approved window. The deploy tool writes the deploy record to the ticket.
8. Verify and close: add post-deploy verification notes within 24 hours, then move to Done.
   Failed changes are set to "Rolled back" with a reason, never deleted.

## Rules

- Segregation of duties: the author cannot approve their own change or their own PR.
  Reason: SOC 2 CC8.1 and PCI-DSS 6.5.
- Freeze windows: no Normal changes from the 25th to the 2nd of each month (month-end
  settlement) and from Black Friday through Cyber Monday. Emergency only.
- Deploy windows for Normal changes: Tuesday to Thursday, 10:00 to 15:00 ET.
- Emergency changes still need a ticket within 2 hours of the deploy and a CAB retro
  review. Reason: missing emergency tickets were our only SOC 2 exception in 2025.
- Never edit an approved ticket's scope. Scope change means a new approval.

## Example

"I need to add an index to the ledger_entries table today." Classify: Normal (schema change
on a high-volume table). Today is Wednesday the 27th, inside the month-end freeze, so it
waits until the 3rd unless it fixes an active incident. Agent drafts the CHG ticket with
`CREATE INDEX CONCURRENTLY`, rollback (`DROP INDEX CONCURRENTLY`) and a staging timing test.

## Output

Return: change type with reason, the filled change request, missing evidence or
approvers, and the earliest allowed deploy window.
