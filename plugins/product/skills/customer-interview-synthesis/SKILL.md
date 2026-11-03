---
name: customer-interview-synthesis
description: Synthesizes customer or user interview notes and transcripts into evidence-backed themes, jobs to be done, pains ranked by frequency and severity, and decisions the team can act on, keeping quotes traceable to who said them. Use when asked to "synthesize these interviews", "what are customers telling us", "summarize the customer calls", "find patterns in this feedback", "turn interviews into insights", or when given several transcripts or call notes from customers.
license: MIT
---

# Customer Interview Synthesis

Interviews are only useful if they change a decision. Synthesis fails in two ways: it repeats what each person said (a summary, not a synthesis), or it states confident themes that one loud customer supplied. Code the evidence first, count it, then say what it means and what the team should do.

## Workflow

1. **Set the question.** Ask what decision the interviews should inform (what to build next, who to sell to, why deals are lost). Synthesis without a question turns into a list.
2. **Inventory the sources.** For each interview record an ID (P1, P2...), segment, role, company size, date, and whether it is a customer, prospect, or churned user. Note gaps in coverage.
3. **Extract observations.** Go interview by interview. Pull atomic observations: a pain, a workaround, a goal, a trigger, a quote about money or time. Tag each with the participant ID. Separate what they did (behavior) from what they said they would do (opinion).
4. **Cluster into themes.** Group observations; name each theme as a finding sentence ("Admins re-check every export by hand because totals have been wrong before"), not a label ("Data trust").
5. **Count and rate.** For each theme: how many participants (n of N), which segments, and severity (blocks work / costs time or money / annoyance).
6. **Find the jobs.** Write 2-4 jobs to be done: "When <situation>, I want to <motivation>, so I can <outcome>."
7. **Note contradictions and surprises.** Where segments disagree, and anything that challenges the team's current belief.
8. **Recommend.** 2-4 actions tied to the original question, each citing the themes behind it, plus what to learn next.

Use `templates/interview-synthesis.md` for the final document.

## Rules

- **Every theme carries a count and participant IDs.** Without them nobody can tell a pattern from an anecdote.
- **Behavior beats opinion.** "We built a spreadsheet to track this" is strong evidence; "I would pay for that" is weak. Weight accordingly.
- **Quote exactly and attribute by ID,** not by name, unless the user says names are fine. Interview data is often shared beyond the people who consented.
- **Do not merge segments silently.** A theme from 5 of 5 SMB users and 0 of 4 enterprise users is two findings.
- **Report what was not heard.** If nobody mentioned price, say so; absence of a pain the team assumed is a finding.
- **Keep it to 5-7 themes.** More than that means clustering stopped too early.
- **Do not over-generalize from small samples.** With under about 8 interviews, call findings directional and say so.

## Example

Bad:
> Customers want better reporting. Users find the product easy to use. Pricing is a concern for some.

Good:
> Theme 2: Finance leads rebuild our report in Excel before every board meeting because it cannot show plan vs actual (6 of 9; all 6 are Series A+; severity: costs 3-5 hours/month). "I export it, then spend an afternoon making it look like what the board expects" (P4). Two built their own template (P2, P7). Nobody under 20 employees raised it.

## Output

Fill `templates/interview-synthesis.md`. Short form:

```
## Question
<the decision this informs>

## Sources
N = <n> interviews: <segment breakdown>, <date range>. Gaps: <...>

## Top findings
1. <finding sentence> (n of N; segments; severity) - "<quote>" (P#)

## Jobs to be done
- When ..., I want to ..., so I can ...

## Contradictions and surprises
-

## Recommendations
1. <action> - based on findings <#> - confidence <high/medium/low>

## Next research
- <open question, who to talk to>
```
