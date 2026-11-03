---
name: hiring-scorecard
description: Builds a hiring scorecard for a role, defining the mission, measurable outcomes and competencies, a structured interview plan with rating anchors, and a debrief format that decides on evidence instead of gut feel. Use when asked to "make a hiring scorecard", "define what good looks like for this role", "write interview questions for this role", "set up a structured interview", "help us decide between these candidates", or before opening a role or running an interview debrief.
license: MIT
---

# Hiring Scorecard

Most hiring mistakes are made before the first interview, when nobody wrote down what the person must achieve. A scorecard fixes the bar in advance: the role's mission, the outcomes expected in the first year, and the competencies that predict them. Interviewers then collect evidence against it, and the debrief compares evidence, not impressions.

## Workflow

1. **Interview the hiring manager** (or read their notes): why the role exists now, what success looks like at 90 days and 12 months, what failure looked like in past hires, team context, level and compensation band.
2. **Write the mission**: one or two sentences on why the role exists.
3. **Write 3-5 outcomes**: specific, measurable, time-bound results ("Reduce month-end close from 12 to 5 business days by Q3"), not duties ("manage the close").
4. **Pick 4-6 competencies** that drive those outcomes: a mix of role skills and working traits. Define each in one line and write 1-5 rating anchors for at least the core ones.
5. **Design the interview loop.** Assign each competency to one interviewer so evidence is not duplicated and nothing is missed. Write 2-3 behavioral questions ("Tell me about a time...") and one work sample or case per loop.
6. **Fill** `templates/scorecard.md`.
7. **Run the debrief**: each interviewer submits ratings and evidence before discussion, then the group reviews competency by competency. Decide hire / no hire against the scorecard.

## Rules

- **Outcomes, not duties.** A list of duties describes a job; outcomes describe a successful hire and make the bar testable.
- **Write the scorecard before sourcing.** Defining the bar after meeting candidates bends it toward whoever you liked.
- **Same core questions for every candidate** at a stage. It makes answers comparable and reduces bias.
- **Behavioral and work-sample evidence over hypotheticals.** What someone did predicts what they will do; "what would you do" tests storytelling.
- **Anchored ratings.** Define what a 2 and a 4 look like for each core competency, so "4" means the same to every interviewer.
- **Independent scores before the debrief.** Otherwise the most senior or loudest voice sets everyone's rating.
- **Only job-related criteria.** Do not score on age, family status, nationality, "culture fit" defined as similarity, or other protected characteristics. Flag questions about pay history, background checks, or local employment law for a professional.
- **Reuse the scorecard after the hire.** It becomes the 90-day plan and the basis of the first review, so the bar you hired against is the bar you manage to.
- **A "maybe" is a no** for most roles; hire when evidence clearly meets the bar.

## Running the debrief

1. **Collect written feedback first.** Each interviewer submits ratings and evidence for their assigned competencies before the meeting. Late feedback written after discussion is discarded or marked as such.
2. **Go competency by competency,** not interviewer by interviewer. Read the evidence aloud, then the rating.
3. **Challenge ratings without evidence.** "Strong communicator" is not evidence; "explained the pricing change to a hostile customer in two sentences" is.
4. **Check the outcomes.** Ask: given this evidence, will this person achieve outcomes 1-3 on the scorecard? Answer per outcome.
5. **Name the risks and how to test them** (a reference question, a follow-up exercise) instead of debating them.
6. **Decide in the meeting** and record the reason in one sentence tied to the scorecard. Rejected candidates get a timely, respectful response.

## Example

Bad:
> Role: Customer Success Manager. Must be a self-starter, team player, passionate about customers, with strong communication skills. 5+ years experience.

Good:
> Mission: Keep and grow our 60 mid-market accounts so net revenue retention reaches 110%.
> Outcome 1: Gross revenue churn in the book under 8% annualized by month 12 (today 14%).
> Competency: Commercial judgment - spots expansion and risk early and acts on it. Anchor 2: reacts to renewals when they come up. Anchor 4: has a renewal plan per account 120 days out and can show an expansion they sourced.
> Question: "Tell me about an account you saved that was about to churn. What did you notice first, and what did you do in the first week?"

## Output

Fill `templates/scorecard.md`. For a debrief, add:

```
## Debrief: <candidate>
| Competency | Interviewer | Rating (1-5) | Evidence |
|---|---|---|---|

Outcomes likely achievable: <yes / partly / no, with reasons>
Concerns and how to test them (references, follow-up):
Decision: Hire / No hire - <reason tied to the scorecard>
```
