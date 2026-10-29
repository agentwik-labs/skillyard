---
name: customer-comms-review
description: Reviews Northwind Pay customer-facing communications such as emails, in-app messages, push notifications, fee notices and incident notices for regulated wording, required disclosures and banned phrases before they are sent. Use when someone says "review this email", "can we send this to customers", "check this copy for compliance", "draft a fee change notice", or writes any outbound customer message at Northwind Pay.
license: Proprietary
---

# Northwind Pay Customer Comms Review

Northwind Pay is not a bank. Our partner bank, consumer-protection rules and card network
rules constrain what we can say. Misleading wording is a regulatory finding, not a style issue.

## Workflow

1. Classify the message: marketing, transactional (receipts, payout notices), service
   (incident, maintenance), or regulatory (fee change, terms change, account closure, adverse action).
2. Run the banned-phrase check:
   `python3 scripts/check_banned_phrases.py <file>` (or pipe text on stdin).
   Exit code 0 means clean, 1 means findings, 2 means usage error.
3. Fix every finding. Do not argue with the list; propose compliant wording.
4. Check required disclosures for the message class (see Rules).
5. Route for approval:
   - Marketing: Marketing lead plus Compliance (Jira project COMMS, label `marketing`).
   - Transactional and service: Support lead; Compliance only if templates change.
   - Regulatory: Compliance and Legal, always, with at least 30 days notice for fee and terms changes.
6. Attach the script output and the approved version to the COMMS ticket.

## Rules

- Say "Northwind Pay accounts are provided by our partner bank, Harbor Trust Bank, Member FDIC"
  wherever deposits or balances are described. Never call Northwind a bank or say "your
  Northwind bank account". Reason: bank-partner agreement and consumer-protection guidance.
- Never say funds are "FDIC insured" without "through Harbor Trust Bank, Member FDIC" and
  "pass-through insurance applies if certain conditions are met".
- Never promise returns, yields or guaranteed timing. Use "typically" with the documented
  window: "Payouts typically arrive in 1 to 2 business days."
- No urgency or fear tactics ("act now", "your account will be closed") outside of real
  regulatory notices, which use the approved templates.
- Fee notices state the fee, the effective date, and how to close the account without
  penalty.
- Never include full account numbers, card numbers or tax IDs. Last four digits only.
- Incident notices never speculate on cause and never name vendors.
- Plain English at grade 8 or below; avoid jargon such as "ACH return R01" in customer copy.
- Every message names a way to get help: support@northwind.example or the in-app Help center.

## Example

Draft: "Get guaranteed returns of 4% APY in your Northwind bank account - act now!"
Script flags: "guaranteed returns", "bank account" (Northwind), "act now".
Rewrite: "Earn interest on your balance, currently 4.00% APY, variable and subject to change.
Northwind Pay accounts are provided by Harbor Trust Bank, Member FDIC."
Route: Marketing plus Compliance.

## Output

Return: message class, the script findings, the revised copy, the disclosures added,
and the approval route with the Jira COMMS label.
