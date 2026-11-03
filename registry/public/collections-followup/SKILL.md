---
name: collections-followup
description: Chases overdue invoices with an aging report and an escalation ladder by days overdue, drafting firm, polite reminders and call notes that get paid while keeping the customer relationship. Use when asked to "chase overdue invoices", "write a payment reminder", "who owes us money", "build an AR aging report", "follow up on this unpaid invoice", "the client is 60 days late", or when given an invoice list or accounts receivable export.
license: MIT
---

# Collections Follow-up

Most late invoices are late because of process, not bad faith: the invoice went to the wrong person, a PO number was missing, or nobody asked. Collect by being early, specific, and consistent, and escalate on a schedule rather than on frustration. The customer you chase today is often the customer you renew next year.

## Workflow

1. **Get the receivables.** A CSV of open invoices with columns `invoice,customer,amount,due_date` (optional `paid`, `contact`). Dates as YYYY-MM-DD.
2. **Build the aging report.** From the skill directory:
   `python3 scripts/aging_report.py invoices.csv --as-of 2026-11-03`
   It buckets open balances into Current, 1-30, 31-60, 61-90 and 90+ days overdue, totals per customer and bucket, and lists each overdue invoice with its ladder step. Exit codes: 0 ok, 1 bad data, 2 file not found. See `python3 scripts/aging_report.py --help`.
3. **Check before chasing.** For each overdue invoice confirm: it was sent to the right contact, it had any PO or reference the customer requires, there is no open dispute or credit, and no payment is in transit. Fix process issues first.
4. **Apply the ladder** below. Draft the message for each invoice's step using `templates/reminder-emails.md`.
5. **Prioritize** by amount times age; the largest, oldest balances get a call, not another email.
6. **Log every touch** (date, channel, person, promise to pay date) and follow up the day after a missed promise.

## Escalation ladder

| Days overdue | Step | Channel | Tone |
|---|---|---|---|
| -3 to 0 | Friendly heads-up before due date | Email | Helpful |
| 1-7 | Reminder with invoice attached and pay link | Email | Matter of fact |
| 8-30 | Second reminder, ask if anything blocks payment | Email + call | Direct |
| 31-60 | Call the payer and the account owner; agree a date | Call, then written recap | Firm |
| 61-90 | Escalate to a senior contact; pause new work per contract terms | Email from owner or finance lead | Firm, formal |
| 90+ | Final notice; decide on payment plan, collections agency, or write-off | Letter/email | Formal |

## Rules

- **Never threaten, insult, or shame.** It rarely speeds payment, damages the relationship, and in many places aggressive collection language has legal consequences.
- **Be specific.** Invoice number, amount, due date, and how to pay in every message. Vague reminders get vague responses.
- **Ask what is blocking payment.** "Is there anything on your side holding this up?" surfaces missing POs and disputes fast.
- **Get a date, not a promise.** "We'll pay soon" is not a commitment; "Friday the 14th by ACH" is.
- **Separate the relationship from the money.** Let finance or the owner do the firm steps so the account manager can stay the friendly contact.
- **Offer a payment plan before writing off,** with the first installment due quickly.
- **Pausing work, late fees, interest, agencies, or legal action** depend on the contract and local law. Flag for a professional before using them; only mention fees the contract actually allows.
- **Fix the process upstream.** Repeat late payers need different terms (deposit, card on file, shorter terms).

## Example

Bad:
> Your invoice is WAY overdue. This is unacceptable. Pay immediately or we will take legal action.

Good:
> Hi Priya, invoice INV-1042 for $6,400 was due on Oct 3 and is now 31 days past due. Is anything on your side holding it up, such as a PO number or a missing approval? If it is already scheduled, could you let me know the payment date? You can pay by ACH or card here: <link>. I'll call Thursday morning if that's easier to sort out by phone.

## Output

```
## AR summary (as of <date>)
<bucket table from scripts/aging_report.py>
Total overdue: <$> across <n> invoices, <n> customers

## Priority actions
| Customer | Invoice | Amount | Days overdue | Step | Action | Owner | By |
|---|---|---|---|---|---|---|---|

## Drafts
### <Customer> - <invoice> (<step>)
Subject: <...>
<message>

## Process fixes
- <customer or pattern> - <change to terms or invoicing>

## For a professional
- <invoices where fees, pausing work, agencies, or legal steps are being considered>
```
