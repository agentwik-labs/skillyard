---
name: data-access-policy
description: Applies Acme Cloud's rules for accessing, querying, exporting or sharing customer data, including who may approve, which tools to use and what is always forbidden. Use when someone asks to "query prod", "pull customer data", "export this workspace", "debug with real data", "give me read access", or handles personal data at Acme Cloud.
license: Proprietary
---

# Acme Cloud Data Access Policy

Customer data is anything inside a workspace: workflow definitions, run payloads, connector
credentials, member emails and uploaded files. Our SOC 2 report and DPAs commit us to
least-privilege access with an audit trail.

## Data classes

| Class | Examples | Default access |
| --- | --- | --- |
| C0 Public | docs, marketing site | everyone |
| C1 Internal | metrics, aggregate usage | all employees |
| C2 Customer | workflow defs, run metadata, member emails | support and engineering via approved tools |
| C3 Restricted | run payloads, connector credentials, uploaded files | break-glass only |

## Workflow

1. Ask what question the person is trying to answer. Most questions can be answered from
   C1 aggregates in the `analytics` warehouse (Snowflake, schema `acme_agg`).
2. If C2 is needed, use the admin console impersonation or the read replica via
   `acme db shell --replica --reason "<Linear or ticket ID>"`. The reason is required and logged.
3. If C3 is needed, request break-glass: `acme access request --class c3 --workspace <ws_id>
   --ticket <id> --duration 2h`. Approver: a Security team member plus the customer's
   written consent for Premier customers.
4. Run the minimum query. Select only needed columns; always filter by `workspace_id`.
5. Do not copy results out of the session. If an export is needed, see Rules.
6. When finished, `acme access revoke` (break-glass also expires automatically).

## Rules

- Never paste C2 or C3 data into Slack, Linear, LLM tools, or local files. Reason: those
  systems are not in our DPA sub-processor list for customer content.
- Never use the primary prod database for ad-hoc queries; replica only. Reason: lock risk.
- Exports to customers go through the in-app export or a Security-approved S3 presigned link
  (expires in 24 hours). Never email attachments.
- Test and dev environments use synthetic data from `acme seed`. Copying prod data to dev
  or staging is forbidden, even if "anonymized" by hand.
- EU workspaces (region `euw1`) are only queried through the eu-west-1 replica. Reason: data residency.
- Deletion requests (GDPR/CCPA) are handled by `privacy@acme.example`, not by engineers directly.

## Example

Request: "Show me the payloads for failed runs in ws_9xq so I can debug." Agent responds:
start with run metadata (C2) on the replica with a ticket reason; payloads are C3 and need
break-glass with Security approval; suggests reproducing with `acme seed` data first.

## Output

Return: the data class involved, whether access is allowed, the exact tool or command to
use, the approver required, and any rule the request would break.
