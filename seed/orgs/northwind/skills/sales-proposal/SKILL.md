---
name: sales-proposal
description: Drafts Northwind Pay sales proposals and RFP responses using the approved outline, current price book, discount approval matrix and pre-approved security and compliance claims. Use when someone says "write a proposal", "draft an RFP response", "what discount can I offer", "put together pricing for this prospect", or prepares a commercial document for a Northwind Pay prospect.
license: Proprietary
---

# Northwind Pay Sales Proposal

Proposals become contract exhibits. Every number and claim must come from an approved source.

## Workflow

1. Gather inputs from the Salesforce opportunity: company, segment (SMB under $5M volume,
   Mid-market $5M to $100M, Enterprise above $100M annual processing volume), products,
   expected volume, close date, competitor.
2. Start from `templates/proposal-outline.md`. Keep section order; delete only optional sections.
3. Pricing: use the current price book (Confluence: Sales > Price Book, version stated on
   the page). Quote the version in the proposal footer.
4. Discounts: apply the approval matrix below. Record approvals in the opportunity's
   "Deal Desk" field before sending.
5. Security and compliance claims: copy only from `references/approved-claims.md`. For
   anything else, open a Jira ticket in project SECQ; Security answers within 3 business days.
6. Send the draft to Deal Desk (#deal-desk) for any non-standard term, then to the prospect.

## Discount approval matrix (off list processing rate)

| Discount | Approver |
| --- | --- |
| up to 10 percent | Account Executive |
| 10 to 20 percent | Sales Director |
| 20 to 30 percent | VP Sales plus Finance |
| above 30 percent, or any fee waiver over 12 months | CFO |

## Rules

- Never quote interchange as fixed. Say "interchange-plus pricing; interchange is set by
  the card networks and passed through at cost". Reason: networks change it twice a year.
- Never promise payout timing faster than the documented window (typically 1 to 2 business days)
  or uptime above the SLA in the MSA (99.95 percent monthly).
- Never share our SOC 2 report or PCI Attestation of Compliance in the proposal. Offer them
  under NDA via the trust portal (trust.northwind.example).
- Never name other customers unless they are on the approved reference list in Salesforce.
- Proposal validity is 30 days; state it on the cover page.
- Do not describe Northwind as a bank; deposits are held at our partner bank.

## Example

Mid-market prospect, $40M volume, asking for 18 percent off. Agent drafts using the
outline, applies the price book, notes Sales Director approval is required, includes the
interchange-plus wording and the trust portal link, and leaves pricing marked
"pending approval" until the Deal Desk field is set.

## Output

Return the proposal draft in Markdown following the outline, then a "Before sending" list:
approvals needed, claims that need SECQ review, and the price book version used.
