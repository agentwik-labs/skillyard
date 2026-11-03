---
name: weekly-business-review
description: Builds a weekly business review from the company's key metrics, computing week-over-week and vs-plan deltas, explaining the biggest variances with causes, and ending with decisions and owners rather than a wall of numbers. Use when asked to "prepare the WBR", "write the weekly business review", "how did we do this week", "summarize this week's metrics", "what moved this week and why", or when given a metrics export or KPI spreadsheet on a weekly cadence.
license: MIT
---

# Weekly Business Review

A WBR exists to catch problems while they are small and to decide what to do about them. A good one is the same shape every week, puts numbers against plan, explains the few that moved, and ends with decisions. A bad one recites every metric with "up" or "down" and no cause.

## Workflow

1. **Get the data.** A CSV with columns `metric,week,actual,plan` (plan optional), at least the current and previous week. Ask which metrics are inputs the team controls (pipeline created, demos held, tickets closed) and which are outputs (revenue, churn).
2. **Compute deltas.** From the skill directory:
   `python3 scripts/wbr_deltas.py metrics.csv`
   It takes the two most recent weeks in the file, prints a markdown table with actual, prior week, week-over-week change, plan, and vs-plan variance, and marks rows whose change crosses the threshold (default 10%, set with `--threshold 0.15`). Use `--week 2026-W14` to choose the week. Exit codes: 0 ok, 1 bad data, 2 file not found. See `python3 scripts/wbr_deltas.py --help`.
3. **Pick what to explain.** Only the flagged rows and anything off plan for 2+ weeks. Usually 3-5 items.
4. **Find causes.** For each, ask or check: is it real or a data issue, which segment or channel drove it, is it one-off or a trend? Write "cause unknown, owner investigating" rather than guessing.
5. **Write decisions and actions.** Each action has an owner and a due date. Carry open actions from last week and mark them done or late.
6. **Assemble** in the Output format. Keep it to one page.

## Rules

- **Plan first, then last week.** Week-over-week alone hides a business that is consistently 20% behind plan.
- **Same metrics, same order, every week.** Changing the layout lets bad numbers hide and makes trends hard to see.
- **Inputs before outputs.** Revenue tells you what happened; pipeline and activity tell you what will happen and what you can still change.
- **Explain variance, do not narrate it.** "Signups -18% because the paid search campaign paused Tuesday" beats "signups were down".
- **Use 4-week averages for noisy metrics** so one holiday does not trigger a fire drill.
- **Bad news at the top.** The reader should see the biggest miss in the first three lines.
- **Check data before alarming anyone.** A sudden 0 or a 300% jump is usually a broken pipeline; say so.
- **Every action has one owner and a date.** Shared ownership means no ownership.

## Example

Bad:
> Revenue was up this week. Signups went down a bit. Churn was stable. Team is working hard on several initiatives.

Good:
> Off plan: New MRR $18.2k vs $24k plan (-24%), second week in a row. Cause: 3 deals slipped to next week after legal review (Acme, Borealis, Tern; $7.1k combined). Action: Dana to offer the standard DPA upfront in all deals over $2k, by Fri.
> Signups -18% WoW (1,240 vs 1,512): paid search paused Tue-Thu over a billing issue; organic flat. Resolved, no action.

## Output

```
# WBR - week of <date>

## Headline
<2-3 sentences: overall vs plan, the biggest miss, the biggest win>

## Metrics
<table from scripts/wbr_deltas.py>

## What moved and why
1. <metric>: <delta> - cause: <...> - one-off / trend
2.

## Decisions needed
- <decision, options, recommended option, who decides>

## Actions
| Action | Owner | Due | Status |
|---|---|---|---|
| <carried from last week> | | | done / late / open |
| <new> | | | open |

## Data notes
- <gaps or suspicious numbers>
```
