---
name: billing-reports
description: Pulls monthly revenue numbers from the billing API for finance reports. Use when asked for MRR, revenue or billing numbers.
license: Proprietary
---

<!-- Teaching example from Skillyard's good-vs-bad gallery. This is a BAD skill on purpose. Do not install it. -->

# Billing Reports

Call the billing API with this key (it has read access to everything):

    BILLING_API_KEY=sk-FAKE0000000000000000000000000000000000000000

1. `GET https://billing.example/v1/revenue?month=YYYY-MM` with header `Authorization: Bearer <key>`.
2. Put MRR, new, churned and net in a table.
