---
name: support-escalation
description: Decides when and how Acme Cloud support tickets escalate to engineering, including tier, SLA, the Linear ticket format and customer-facing replies. Use when someone says "escalate this ticket", "is this a bug or a how-to", "what's the SLA for this customer", "file this for engineering", or triages an Acme Cloud support case.
license: Proprietary
---

# Acme Cloud Support Escalation

Support works in the help desk; engineering works in Linear. This skill is the bridge.

## Plans and SLAs (first response / update cadence)

| Plan | P1 | P2 | P3 |
| --- | --- | --- | --- |
| Premier | 30 min / 2 h | 4 h / 1 business day | 1 business day / 3 days |
| Business | 2 h / 4 h | 1 business day / 2 days | 2 business days / weekly |
| Starter | 1 business day | 2 business days | best effort |

Priority: P1 = workflows not running or data at risk; P2 = feature broken with no
workaround; P3 = workaround exists, question, or cosmetic.

## Workflow

1. Reproduce or confirm: get workspace ID (`ws_...`), workflow ID, run ID, timestamps with
   timezone, and the browser or connector version.
2. Search for duplicates in Linear (team SUP-ENG) and the status page. If an incident is
   open, link the ticket to it and reply with the incident template; stop here.
3. Classify: how-to, config error, connector vendor issue, or Acme bug.
4. Only Acme bugs and suspected data issues escalate. How-to and config go back to the
   customer with a docs link.
5. Create a Linear issue in SUP-ENG using the format below. Label with the component
   (`builder`, `runs`, `connectors`, `billing`, `auth`) and plan.
6. P1 on Premier or Business: also page `app-primary` and post in #support-escalations.
   Consider whether it is an incident (see incident-response).
7. Reply to the customer within the SLA, with what you did and when they will hear next.

## Linear issue format

Title: `[<plan>][P<n>] <component>: <symptom in 8 words>`
Body: Customer impact, Steps to reproduce, Expected vs actual, IDs, Help desk link,
What support already tried.

## Rules

- Never ask the customer for passwords, API keys, or connector credentials. Use
  impersonation in the admin console (it is audit-logged) per data-access-policy.
- Never promise a fix date. Say "engineering has confirmed the issue" and the next update time.
- Engineering must acknowledge P1 in 30 minutes and P2 in 1 business day; if not, escalate
  to the component's EM listed in `#support-escalations` topic.
- Workspace IDs are fine in Linear; customer emails and data samples are not. Attach
  redacted screenshots only.

## Example

Premier customer: "All our Salesforce-triggered workflows stopped at 09:10 ET." Support
confirms 0 runs since 09:10 on ws_8k2..., no open incident, Salesforce connector errors
`401`. Files `[Premier][P1] connectors: Salesforce trigger returns 401 since 09:10`,
pages app-primary, replies to customer within 30 minutes.

## Output

Return: classification, priority with reason, the Linear issue text ready to paste, and a
customer reply draft written in Acme brand voice.
