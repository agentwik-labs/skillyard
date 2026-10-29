---
name: incident-postmortem
description: Writes blameless incident postmortems from chat logs, alerts, timelines and notes, with a UTC timeline, measured impact, contributing factors (not a single root cause), and owned, dated action items. Use when asked to "write a postmortem", "do an incident review", "RCA for the outage", "write up what happened yesterday", or after any incident that paged someone or affected customers.
license: MIT
---

# Incident Postmortem

Turn the raw record of an incident into a document that helps the organization stop the same class of failure from recurring. The audience is engineers who were not there and leaders deciding what to fund. A good postmortem is blameless, precise about time and impact, honest about what made the incident worse, and ends with a short list of action items that someone owns and will actually do.

## Workflow

1. **Collect sources.** Ask for or read: alert history, incident channel export, deploy log, graphs or metric values, status page updates, support tickets. Note which sources you did not get.
2. **Build the timeline first, in UTC.** One row per event: detection, page, first responder, each hypothesis, each mitigation attempt, mitigation, resolution, all-clear. Convert every local time to UTC and say so once at the top. Include the triggering change even if it happened days earlier.
3. **Compute the key durations** from the timeline: time to detect (start -> first alert), time to acknowledge, time to mitigate (start -> customer impact ends), time to resolve. Mark any you had to estimate.
4. **Quantify impact.** Users or requests affected, error rate, revenue or SLA/SLO budget consumed, data lost or corrupted, regions. Prefer numbers with their source over adjectives.
5. **Identify contributing factors.** Ask "what made this possible, what made it worse, what made it last longer" across: the change, the system design, detection, tooling, process, and knowledge. Expect three to six factors.
6. **Record what went well.** It tells readers what to preserve.
7. **Draft action items** (rules below), then draft the summary last.
8. **Mark open questions** for the incident owner rather than inventing answers.

## Rules

- **Blameless language.** Describe actions and the system conditions around them, never a person's character or competence. Write "the deploy ran the migration against the primary" not "Alex ran the migration wrong". Use roles ("on-call engineer") rather than names in the narrative. People act reasonably given what they knew; the question is why the system let a reasonable action cause harm.
- **Contributing factors, not "the root cause".** Incidents in complex systems have several necessary conditions. A single root cause invites a single fix and hides the rest. Never write "human error" as a factor; ask what made the error easy and its effect large.
- **UTC everywhere**, ISO format `2026-03-14 09:42 UTC`. Mixed time zones are the most common source of wrong timelines.
- **Separate fact from inference.** Mark guesses with "likely" and say what evidence would confirm them.
- **Action items must be SMART-ish:** one owner (a person, not a team), a due date, a ticket link or "ticket TBD", and a type: prevent, detect, mitigate, or process. Cap at about seven; ten weak items get none done. Prefer items that remove a class of failure (a guardrail, a test, an alert) over "be more careful" or "add documentation".
- **No action item without a factor.** Each item should trace to a contributing factor; each major factor should have at least one item or an explicit "accepted risk".
- **Severity and status** use the organization's scale if given; otherwise SEV1 (major outage or data loss), SEV2 (significant degradation for many users), SEV3 (minor or internal).

## Interviewing and drafting from thin records

When the record is incomplete, ask the responders targeted questions instead of filling gaps:
- "What did you believe was happening at <time>, and what told you that?" (reveals misleading signals)
- "What did you try that did not work, and why did it seem reasonable?" (reveals tooling gaps)
- "What slowed you down?" (access, missing runbook, unclear ownership, noisy alerts)
- "What nearly made this worse?" (feeds "Where we got lucky")
Record answers as facts attributed to roles, not names.

## Factor prompts

Run through these lenses when listing contributing factors; most incidents have one from at least three:
- **Change**: what changed recently, and why did review, tests, or canary not catch it?
- **Design**: what coupling, shared resource, or missing limit let a local fault spread?
- **Detection**: how long until a human knew, and was it an alert or a customer?
- **Response**: were runbooks, dashboards, access, and escalation paths adequate?
- **Recovery**: why did mitigation take as long as it did (rollback speed, data repair)?
- **Knowledge**: did anyone on call know this component; was ownership clear?

## Example

Bad:
> Root cause: engineer pushed a bad config. Action: be more careful with configs. Owner: platform team.

Good:
> **Contributing factors**
> 1. The rate-limit config accepted `0` as a valid value, which the gateway interprets as "block all".
> 2. Config changes bypass the canary stage that code deploys go through.
> 3. The 5xx alert fired at 14:09 UTC but routed to a channel, not a page; the first page came from a customer at 14:31 UTC.
>
> **Action items**
> | # | Action | Type | Owner | Due | Ticket |
> | 1 | Reject rate-limit values <= 0 in config schema validation | prevent | @maria | 2026-04-02 | NET-812 |
> | 2 | Route gateway config through the canary pipeline | prevent | @dev | 2026-04-20 | NET-813 |
> | 3 | Page on 5xx > 2% for 3 min on the public gateway | detect | @sam | 2026-03-28 | OBS-221 |

## Output

Fill `templates/postmortem.md` (copy it, keep the headings). Deliver:
1. The completed postmortem in markdown.
2. A list of open questions for the incident owner, each tied to the section it would change.
3. If asked for a short version, a five-line summary: what broke, impact, duration, key factor, top action item.
