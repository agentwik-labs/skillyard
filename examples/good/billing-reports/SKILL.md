---
name: billing-reports
description: Pulls monthly revenue numbers from the billing API for finance reports. Use when asked for MRR, revenue or billing numbers.
license: Proprietary
---

# Billing Reports

1. Read the key from the environment: `BILLING_API_KEY` (issued per person from the secrets manager, read-only scope
   `revenue:read`). If it is missing, stop and tell the user how to request one; never ask them to paste it in chat.
2. `GET https://billing.example/v1/revenue?month=YYYY-MM` with `Authorization: Bearer $BILLING_API_KEY`.
3. Put MRR, new, churned and net in a table, and say which month and when you pulled it.
