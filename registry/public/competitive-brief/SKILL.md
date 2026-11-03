---
name: competitive-brief
description: Produces a sourced competitive brief or sales battlecard on one or more competitors, covering who they sell to, pricing, positioning, strengths and weaknesses from customers' point of view, and how to win and lose against them. Use when asked to "write a competitive brief", "make a battlecard for X", "how do we compare to X", "what is our competitor doing", "why do we lose deals to X", or before a pitch, pricing change or positioning decision involving named competitors.
license: MIT
---

# Competitive Brief

A competitive brief helps someone make a decision or win a deal, so it must be accurate, sourced, and honest about where the competitor is better. Briefs that dismiss competitors get sales teams ambushed on calls. Write what is true, date it, and turn it into talk tracks.

## Workflow

1. **Set the use.** Sales battlecard (for reps on calls), positioning input (for marketing), or strategy (for founders and product). The use decides depth and format.
2. **Gather evidence**, recording a source and date for every claim: the competitor's website, pricing page, docs, changelog, job postings (they reveal priorities), public reviews, case studies, and the user's own win/loss notes and call recordings. If web access is unavailable, work only from what the user provides and say so.
3. **Profile each competitor**: target customer, core offer, pricing model and visible prices, go-to-market (self-serve, sales-led, partners), recent moves in the last 6 months.
4. **Compare on what buyers decide on,** not every feature. Ask the user for the top 5-7 buying criteria from recent deals; compare on those.
5. **Write strengths and weaknesses from the buyer's view,** with evidence. Include where the competitor genuinely wins.
6. **Build win and lose patterns** from the user's deal history: which segments or use cases you win, and why you lose.
7. **Write talk tracks**: landmines to set (questions that expose their weakness), objection responses, and proof points.
8. **Fill** `templates/battlecard.md` for sales use; use the Output section for strategy use.

## Rules

- **Every claim has a source and a date.** Competitor pricing and features change; an undated claim becomes a wrong claim.
- **Separate fact from inference.** "Pricing page lists $40/seat (Mar 2026)" is fact; "they are moving upmarket" is inference, so label it and give the evidence.
- **Admit where they are better.** Reps who deny a real strength lose credibility; reps who acknowledge and reframe it win.
- **Compare on buying criteria, not feature counts.** A 60-row feature grid hides the 3 things that decide deals.
- **Never disparage.** Talk tracks state facts and ask questions; they do not insult the competitor. It reflects badly on the seller and can create legal exposure.
- **Use only public or properly obtained information.** No confidential documents from former employees or misrepresenting yourself to get demos. Flag any doubt for a professional.
- **Date the brief and set a review date** (quarterly is typical for active competitors).

## Example

Bad:
> CompetitorX is expensive and their product is outdated. Customers hate their support. We are better in every way.

Good:
> Where they win: deeper ERP integrations (NetSuite, SAP listed in docs, Apr 2026); we lost 4 of 6 deals in Q1 where SAP was a requirement.
> Where we win: time to value. Their implementation is quoted at 8-12 weeks on public case studies; ours averages 9 days (last 20 customers).
> Landmine: "How long did your last vendor take to go live, and who on your team did the work?"

## Output

```
# Competitive brief: <competitor(s)> - <date>, review by <date>

## Bottom line
<3 sentences: who they are to us, where we win, where we lose>

## Profile
| | <Competitor> | Us |
|---|---|---|
| Target customer | | |
| Pricing model / visible prices | | |
| Go-to-market | | |
| Recent moves (6 mo) | | |

## Buying criteria comparison
| Criterion | <Competitor> | Us | Evidence (source, date) |
|---|---|---|---|

## Where they win / where we win
- They win: <...> (evidence)
- We win: <...> (evidence)

## Talk tracks
- Landmines: <questions>
- Objection "<...>": <response with proof>

## Sources
- <url or doc> (accessed <date>)

## Inferences to verify
- <...>
```
