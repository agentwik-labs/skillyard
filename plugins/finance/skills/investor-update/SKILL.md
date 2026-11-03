---
name: investor-update
description: Writes the monthly or quarterly investor update for a startup, leading with key numbers against plan, cash and runway, then wins, misses told plainly, and a specific ask investors can act on. Use when asked to "write the investor update", "draft our monthly update to investors", "turn these numbers into an update", "what should I tell investors this month", "write the quarterly LP update", or when given metrics and notes for shareholders.
license: MIT
---

# Investor Update

Investors read dozens of updates. The ones that build trust are regular, short, lead with numbers against the plan, deliver bad news early and plainly, and ask for something specific. Investors who are surprised by bad news in month nine stop helping; investors who saw it coming in month three often help fix it.

## Workflow

1. **Collect inputs.** Period covered, the metrics the company reports every time (revenue or ARR, growth, burn, cash, runway, plus 2-3 company-specific ones), the plan or last update's targets, highlights, problems, hires and departures, and what the founder needs.
2. **Compute the core numbers.** Change vs last period and vs plan for each metric. Runway in months = cash / average net burn over the last 3 months. State the burn period you used.
3. **Write the TL;DR** first: 3 lines covering performance vs plan, cash and runway, and the ask.
4. **Write wins, then misses.** Each miss gets: what happened, why, and what you are doing about it. No softening adjectives.
5. **Write the asks.** 1-3 specific requests: an intro to a named company or role, a hire referral with the role spelled out, advice on a specific decision.
6. **Fill** `templates/investor-update.md` and check it against the rules.
7. **Flag sensitive content** (pending fundraise terms, legal disputes, personnel issues) for the founder to decide whether it belongs in a written update.

## Rules

- **Same metrics every time, in the same table.** Swapping metrics month to month reads as hiding the bad ones.
- **Numbers vs plan, not just vs last month.** Growth that is below plan is still a miss.
- **Bad news early.** Put it in the TL;DR if it is material. Burying it in paragraph five costs more trust than the bad news itself.
- **Cash and runway every time.** It is the first thing every investor looks for.
- **Specific asks get answered.** "Intros to Heads of Finance at 200-1,000 person logistics companies in the US" gets replies; "any intros welcome" does not.
- **Under 400 words of prose.** Investors skim; the table carries the detail.
- **Send on a fixed cadence**, even in a bad month. Silence is read as worse news than the truth.
- **No forward-looking promises you cannot back.** Say "we expect" with the basis. Securities and disclosure questions: flag for a professional.
- **Thank people by name** for help given. It encourages more of it.

## Example

Bad:
> Hi all! What an exciting month. The team has been heads-down building and we are seeing great momentum across the board. We had some challenges with sales but are confident about Q3. As always, let us know if you can help!

Good:
> TL;DR: MRR $84k, +6% MoM but 9% below plan ($92k) after two enterprise deals slipped to July. Cash $1.42M, net burn $118k/mo (3-mo avg), runway 12 months. Ask: intros to VP Ops at mid-size 3PLs (Columbus, Memphis, Reno).
> Miss: Enterprise. Both slipped deals stalled in security review; we had no SOC 2 report. We start the audit window July 1 (cost $28k) and are sending the security questionnaire pack before demos from now on.

## Output

Fill `templates/investor-update.md`. Short form:

```
Subject: <Company> <Month YYYY> update - <one-line headline>

TL;DR
- Performance: <metric vs plan>
- Cash: <cash>, burn <net burn>/mo, runway <n> months
- Ask: <specific>

| Metric | This period | Last period | Change | Plan | vs Plan |
|---|---|---|---|---|---|

Wins
- <win, with number>

Misses and what we are doing
- <what happened> - <why> - <action, owner, date>

Asks
1. <specific request>

Team
- <hires, departures, open roles>

Thanks
- <name> for <help>
```
