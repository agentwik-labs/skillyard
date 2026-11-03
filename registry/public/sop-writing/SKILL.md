---
name: sop-writing
description: Writes standard operating procedures that someone new can follow without asking questions, with a clear trigger, owner, numbered steps that each start with a verb, decision points, quality checks and a review date. Use when asked to "write an SOP", "document this process", "turn this into a checklist", "make a playbook for this task", "how do we hand this off", or when given a recording, chat thread or rough notes describing how a recurring task is done.
license: MIT
---

# SOP Writing

An SOP lets the business run the same way when the person who knows the process is on vacation, has left, or is being replaced by an agent. The test is simple: can a capable new hire complete the task correctly on the first try, using only the document? Write to that test.

## Workflow

1. **Capture the process as it is done today.** Use a recording, a walkthrough, notes, or ask the process owner to talk through the last time they did it. Note every tool, login, file, and handoff.
2. **Define the frame**: purpose (one sentence), trigger (what starts it), frequency, owner, inputs, output, and time it should take.
3. **Write steps.** One action per step, starting with a verb, in the order done. Name the exact screen, field, file or template. Put the why in a short note only where skipping it causes errors.
4. **Mark decision points** as "If X, do Y; otherwise go to step N." Keep branches shallow; move a long branch into its own SOP and link to it.
5. **Add quality checks** at the points where mistakes are expensive, and a "done when" definition at the end.
6. **Add exceptions and escalation**: what can go wrong, what to do, who to contact.
7. **Fill** `templates/sop.md`.
8. **Test it.** Ask the user to have someone who has not done the task follow it once and note every question they had; each question is a missing step.

## Rules

- **One action per step, verb first.** "Export the report and send it to finance after checking totals" is three steps; combined steps get half done.
- **Be specific about names.** "Open Settings > Billing > Invoices", not "go to the billing area". Vague references are where new people get stuck.
- **Write for the least experienced person who will run it,** not for the expert who wrote it.
- **Checks where errors are costly.** A check before money moves or a customer is emailed saves more than a check on formatting.
- **No credentials in the SOP.** Reference the password manager entry or access request instead; SOPs get shared widely.
- **Owner and review date on every SOP.** Tools and processes drift; an unowned SOP becomes wrong without anyone noticing.
- **Keep it under about 25 steps.** Longer processes should split into linked SOPs.
- **Regulated processes** (payroll, safety, health data, financial controls): flag for a professional to confirm the procedure meets the applicable rules.

## Example

Bad:
> Onboarding new clients: Set up their account, send the welcome stuff, and make sure billing is configured. Let the team know.

Good:
> Trigger: Signed contract appears in the Closed-Won stage in the CRM.
> 1. Open the client record in the CRM and copy the billing contact email.
> 2. Create the customer in the billing tool: Customers > New > paste email; set terms to Net 15.
> 3. Check: plan and price in the billing tool match the signed order form. If they differ, stop and message the account owner in the deals channel.
> 4. Send the "Welcome - Kickoff" email template from the shared inbox; propose two kickoff times within 5 business days.
> Done when: customer exists in billing with correct plan, welcome email sent, kickoff on the calendar.

## Output

Fill `templates/sop.md`. Short form:

```
# SOP: <process name>
Owner: <role>  Last reviewed: <date>  Next review: <date>
Purpose: <one sentence>
Trigger: <what starts it>   Frequency: <...>   Time: <minutes>
Inputs: <...>   Output: <...>   Tools and access: <...>

## Steps
1. <Verb> <specific action>.
2. Check: <what to verify>. If <problem>, <what to do>.

## Done when
- <observable end state>

## Exceptions
| Situation | What to do | Escalate to |
|---|---|---|

## Change log
- <date> <change> <by>
```
