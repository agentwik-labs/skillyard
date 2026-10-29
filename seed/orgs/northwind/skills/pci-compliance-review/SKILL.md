---
name: pci-compliance-review
description: Reviews Northwind Pay code changes, designs and data flows that touch cardholder data or the cardholder data environment against PCI-DSS v4.0 and Northwind's internal controls. Use when someone says "PCI review", "does this touch card data", "is this in CDE scope", "review this payment change", or modifies the vault, tokenizer or card-processing services at Northwind Pay.
license: Proprietary
---

# Northwind Pay PCI Compliance Review

Northwind Pay is a PCI-DSS Level 1 service provider. The cardholder data environment (CDE)
is deliberately small; keeping it small is the main goal of every review.

## CDE scope

In scope: `card-vault` (Go), `tokenizer` (Go), `auth-gateway` (Go), the `cde-prod` AWS
account and the `pci` Kubernetes cluster. Everything else must only ever see tokens
(`tok_...`) and the last four digits.

## Workflow

1. Map the data flow: list every field the change reads, writes, logs or sends. Flag any
   PAN, CVV, track data, PIN, or expiry date.
2. Decide scope: does the change run in, connect to, or add a new path into the CDE?
   If no and only tokens are used, mark "Out of scope" and stop after step 6.
3. Check the rules below. Each finding cites the rule ID and PCI-DSS requirement.
4. For in-scope changes, confirm the PR has a second reviewer from `@northwind/pci-reviewers`
   (required by CODEOWNERS on CDE repos).
5. Confirm a Jira change ticket in project CHG exists (see change-management).
6. Record the review result as a comment on the PR and in the Jira ticket field "PCI Review".

## Rules

- P1 (Req 3.3): Never store CVV, full track data, or PIN after authorization, anywhere,
  including logs, queues and crash dumps.
- P2 (Req 3.4): PAN is stored only in `card-vault`, encrypted with keys from the HSM-backed
  KMS key `alias/nw-cde-pan`. Display is masked to first six / last four at most.
- P3 (Req 3.5): Outside the CDE, only tokens and last four are allowed. A new service that
  needs PAN is a scope expansion and needs CISO approval.
- P4 (Req 4.2): All CDE traffic uses TLS 1.2+ with mutual TLS inside the cluster.
- P5 (Req 6.2): Changes to CDE code need a code review by someone other than the author
  plus a `pci-reviewers` approval; SAST (Semgrep ruleset `nw-pci`) must pass.
- P6 (Req 7, 8): No shared accounts. Access to `cde-prod` is via SSO with MFA and
  just-in-time elevation (`nwctl access request cde-prod --ticket CHG-...`).
- P7 (Req 10): Every access to PAN is audit-logged to the `cde-audit` stream; log retention
  is 12 months with 3 months hot.
- P8: Test data uses only the approved test PANs from `references/test-cards.md`. Real PANs in
  tests, fixtures or tickets are a reportable incident; tell #sec-incident immediately.

## Example

Change: `payouts-api` (Python) adds a field `card_number` to a webhook payload for
"easier reconciliation". Finding: violates P3, which brings payouts-api into scope.
Fix: send `card_token` and `card_last4` instead. Result: Blocked until changed.

## Output

Return a review block:
- Scope: In scope / Out of scope / Scope expansion
- Findings: rule ID, PCI-DSS requirement, file and line, required fix
- Result: Approved / Approved with conditions / Blocked
- Required approvers still missing
