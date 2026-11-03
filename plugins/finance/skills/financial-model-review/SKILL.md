---
name: financial-model-review
description: Reviews a startup or small-business financial model or budget spreadsheet for broken mechanics, unrealistic assumptions, and missing drivers, tracing revenue, hiring, burn and cash to their inputs and stress-testing the result. Use when asked to "review my financial model", "sanity check these projections", "is this forecast realistic", "check my budget spreadsheet", "find errors in the model", "stress test our runway", or when given a forecast, P&L projection or operating plan.
license: MIT
---

# Financial Model Review

A financial model is a set of assumptions dressed up as precision. Reviewing one means checking that the mechanics are correct, that every big number traces to a driver someone can defend, and that the plan survives when the most optimistic assumptions are wrong. This skill reviews; it does not give investment, accounting or tax advice.

## Workflow

1. **Understand the purpose.** Fundraising deck, annual budget, hiring plan, or runway check. Purpose decides how much rigor matters and which outputs count.
2. **Map the model.** List the tabs or sections, where inputs live, and the key outputs (revenue, gross margin, opex, net burn, ending cash, headcount). If inputs are scattered or hard-coded in formulas, note it as the first finding.
3. **Check mechanics.** Work through the checklist below. Recompute 3-5 key cells by hand and show the arithmetic.
4. **Trace drivers.** For revenue, find the chain (traffic or leads, conversion, deal size, churn, expansion). For costs, find headcount by role and start date, plus non-people costs. Flag any line that is a plugged number or a flat growth rate with no driver.
5. **Test assumptions** against the company's own history first, then against stated benchmarks only if the user supplies them. Flag growth, conversion, or churn that jumps without a stated reason.
6. **Stress test.** Build a downside case: revenue 30% lower and 3 months later, costs as planned. Report the new cash low point and runway. Name the 2-3 assumptions the outcome is most sensitive to.
7. **Report** findings ranked by impact on the decision the model supports.

## Mechanics checklist

- Balance and sign: cash flow ties to the change in cash; expenses are consistently signed.
- Hard-coded numbers inside formulas; inputs not separated from calculations.
- Formulas that change partway along a row (copied wrong, or overwritten).
- Timing: annual contracts booked as monthly revenue or vice versa; revenue vs cash collection timing (payment terms, annual prepay).
- Headcount costs missing benefits and payroll taxes (commonly 15-30% on top of salary; confirm locally) and recruiting costs.
- Churn applied to new and existing customers consistently; no negative customer counts.
- Units: thousands vs units, monthly vs annual rates, percentages entered as whole numbers.
- Totals that sum the wrong range or double count a subtotal.

## Rules

- **Mechanics before opinions.** A broken formula invalidates everything downstream; fix it before debating growth rates.
- **Every big number needs a driver.** "Revenue grows 15% a month" is a hope; "40 demos a month at 25% close and $12k ACV" can be checked.
- **History beats benchmarks.** The company's own last 6-12 months is better evidence than industry averages.
- **Hockey sticks need a cause.** If growth accelerates, name the event (new channel, hire, launch) and when it starts paying.
- **Cash, not profit, kills companies.** Always report the lowest cash month and its date.
- **Show the downside.** A plan with only a base case is a pitch, not a plan.
- **Accounting treatment, tax, and securities questions**: flag for a professional rather than ruling on them.

## Example

Bad:
> The model looks solid overall. Growth assumptions might be a bit aggressive. Consider adding more detail to expenses.

Good:
> 1. (High) Ending cash is overstated by $310k from month 7: the Cash tab sums revenue booked, but 60% of customers pay annually in advance and the rest net-60, so collections lag. Cell Cash!H14 should reference Collections!H9.
> 2. (High) Revenue growth jumps from 6%/mo (last 9 months actual) to 14%/mo in month 4 with no driver. The plan adds one SDR in month 3; at the current $9k new MRR per rep it explains about 2 points, not 8.
> 3. Downside (revenue -30%, 3-month delay): cash low point $140k in month 14, vs $1.1M in the base case.

## Output

```
## Summary
<2-3 sentences: is the model fit for its purpose, and the one change that matters most>

## Findings
| # | Severity | Area | Finding | Location | Fix |
|---|---|---|---|---|---|
| 1 | High / Med / Low | Mechanics / Drivers / Assumptions | | <tab!cell> | |

## Key assumptions
| Assumption | Model value | Historical / basis | Comment |
|---|---|---|---|

## Stress test
| Case | Lowest cash | Month | Runway |
|---|---|---|---|
| Base | | | |
| Downside (<definition>) | | | |

Most sensitive to: <assumption 1>, <assumption 2>

## Questions for the owner
- <what you could not verify>

## For a professional
- <accounting, tax, or legal items to confirm>
```
