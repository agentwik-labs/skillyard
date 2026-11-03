---
name: pricing-review
description: Reviews a product's pricing and packaging against unit economics and customer value, checking the value metric, tier structure, anchoring, discounting and CAC payback, and proposes concrete changes with the numbers behind them. Use when asked to "review our pricing", "should we raise prices", "design our pricing tiers", "what should we charge", "check our unit economics", "is our CAC payback ok", or when sharing a pricing page or price list.
license: MIT
---

# Pricing Review

Pricing is the fastest lever on profit and the one most founders set once and never revisit. A good review checks three things in order: are we charging for the thing customers value (value metric), is the structure easy to buy and easy to expand (packaging), and do the economics work (margin, CAC payback, LTV). Then it proposes a specific change and a way to test it.

## Workflow

1. **Collect the facts.** Current price list or pricing page, who buys (segments, company sizes), average deal size, gross margin or cost to serve, CAC or sales and marketing spend plus new customers, monthly churn, discount practice, and competitor prices if known.
2. **Run the numbers.** From the skill directory:
   `python3 scripts/unit_economics.py --price 99 --cogs 18 --cac 600 --churn 0.03`
   or per segment from a CSV with columns `segment,price,cogs,cac,churn`:
   `python3 scripts/unit_economics.py --csv segments.csv`
   It prints gross margin, CAC payback in months, LTV and LTV:CAC as a markdown table, and flags payback over 12 months or LTV:CAC under 3. Exit codes: 0 ok, 1 bad input, 2 file not found. Run `python3 scripts/unit_economics.py --help` for all flags.
3. **Check the value metric.** What unit does price scale with (seats, usage, locations, revenue processed)? Does it grow as the customer gets more value? Is it predictable for the buyer?
4. **Check packaging.** Count tiers, the differentiators between them, and which tier most customers pick. Look for a tier nobody buys and a feature everybody asks for that sits in the wrong tier.
5. **Check discounting.** Average discount, who approves it, and whether annual prepay gets a reason-based discount (commonly 10-20%) rather than ad-hoc cuts.
6. **Propose 1-3 changes**, each with expected effect, risk, and how to test it (new customers only, one segment, a time-boxed experiment).

## Rules

- **Value metric first.** A price that scales with value expands revenue without new sales; a flat price caps every account.
- **Good-better-best, three tiers.** Two tiers force a binary choice; four or more cause analysis paralysis. Design the middle tier to be the obvious pick.
- **Anchor high.** Show the top tier (or "contact us" enterprise) first or alongside, so the middle looks reasonable.
- **Differentiate tiers on what segments care about** (security, admin controls, volume), not by withholding core value from the bottom tier.
- **CAC payback under 12 months** is a common SMB target; up to 18-24 can be fine for enterprise with low churn. State which applies.
- **LTV is fragile.** It depends on churn assumptions; show it with the churn used and prefer payback for decisions.
- **Grandfather existing customers or give notice** (60-90 days) on increases; surprise hikes cause churn and support load.
- **Raise prices on new customers first** and watch win rate; if it barely moves, you were underpriced.
- **No invented benchmarks.** If the user has no competitor data, say so instead of guessing market prices.
- **Tax, revenue recognition and regulated-price questions**: flag for a professional.

## Example

Bad:
> Your pricing seems a bit low. Consider raising prices by 20% and adding an enterprise tier.

Good:
> At $49/seat, CAC $1,100 and 78% gross margin, payback is 28.8 months on a single-seat deal and 7.2 months at the median 4 seats. Single-seat buyers are 41% of new logos and churn at 6%/month vs 2% overall. Proposal: set a 3-seat minimum on Team ($147/mo), keep a $19 Solo plan with no onboarding calls. Test on new signups for 6 weeks; success = win rate drop under 5 points and median payback under 10 months.

## Output

```
## Summary
<2-3 sentences: the biggest issue and the recommended change>

## Unit economics
<table from scripts/unit_economics.py, with the inputs and their source>

## Findings
| Area | Finding | Evidence |
|---|---|---|
| Value metric | | |
| Packaging | | |
| Discounting | | |
| Economics | | |

## Recommendations
1. <change> - expected effect: <number or direction> - risk: <...> - test: <how, how long, success threshold>

## Data gaps
- <missing input and how it would change the answer>
```
