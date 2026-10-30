---
name: data-handling
description: Rules for handling customer, patient, employee and other sensitive data when writing code, queries, logs, tests, prompts or tickets at TODO company. Use before reading production data, writing a query or migration that touches personal data, adding logging, creating test fixtures, or pasting anything from a customer record into a chat, ticket or prompt.
license: Proprietary
---

# Data Handling

Sensitive data leaks through ordinary work: a debug log, a fixture copied from prod, a stack trace pasted into a
ticket. Follow these rules whenever personal or regulated data is in reach. When unsure, stop and ask the user.

## Data classes

| Class | Examples at TODO company | Agent may read? | May appear in logs, tests, tickets, prompts? |
|---|---|---|---|
| Restricted | TODO e.g. health records, SSNs, payment cards, credentials | Only with explicit task need and the user's go | Never |
| Confidential | TODO e.g. names, emails, phone numbers, addresses, account ids | Yes, in approved environments | Masked only (`j***@example.com`) |
| Internal | TODO e.g. aggregate metrics, internal docs | Yes | Yes, inside the company |
| Public | Docs, marketing, open-source code | Yes | Yes |

TODO If you're in healthcare: anything that is Protected Health Information under HIPAA is Restricted, including
names or dates when combined with care details. Payment card data follows PCI-DSS.

## Rules

1. **Never copy Restricted data out of its system** into code, fixtures, logs, chat, tickets, commit messages or
   prompts to other tools. Use synthetic data (TODO name your fixture generator, e.g. `make fixtures`).
2. **Production access is read-only and approved.** Only through TODO (e.g. the bastion / read replica / BI tool).
   Never connect an agent session to a production write path.
3. **Logs carry ids, not people.** Log the record id, never names, emails, card numbers or free-text fields.
   Add new fields to the redaction list in TODO (e.g. `src/logging/redact.ts`).
4. **Queries select only the columns the task needs.** No `SELECT *` on tables with personal data; aggregate when
   the question is about counts.
5. **External services:** only TODO approved vendors may receive Confidential data, and none receive Restricted
   data unless TODO (e.g. a signed BAA/DPA is on file).
6. **If you find sensitive data where it shouldn't be** (a log, a repo, a fixture), stop, don't copy it anywhere,
   and tell the user so they can report it to TODO (security contact / channel).

## Example

Bad: `logger.info("updated patient", patient)` dumps the whole record.
Good: `logger.info("patient.updated", { patientId: patient.id, fields: changedFieldNames })`.

## Output

When a task touches personal data, end your reply with one line: the data classes involved and how each rule above
was followed (for example "Confidential: emails masked in logs; fixtures synthetic").
