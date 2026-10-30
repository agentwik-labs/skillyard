# Kickoff session (30 minutes)

**Who:** everyone who uses AI coding agents, plus whoever owns security/compliance for 10 minutes.
**Bring:** one recent example each of an agent doing something "wrong for us" (not wrong in general).

## 0–5 min: why
Agents are good at general work and know nothing about how *this team* works. Every time someone types
"no, we use X here" or "you forgot to Y", that's a skill nobody wrote. Today we pick the first five.

## 5–15 min: collect (silent, then share)
Each person writes sticky notes, one per line, answering:
1. What do you re-explain to agents most often?
2. What did an agent do last week that a new hire here would also get wrong?
3. What would be *dangerous* for an agent to get wrong? (data, prod, money, customers)
4. What does "done" mean here that it doesn't mean elsewhere?

## 15–25 min: group and rank
Group duplicates. For each group, score 1–3 on:
- **Frequency:** how often it comes up
- **Cost:** what a mistake costs (a revert, an incident, a compliance problem)
- **Unknowable:** could a strong model guess it? (3 = never: it's our names, commands, rules)

Rank by the total. Anything dangerous goes in the top five regardless.

## 25–30 min: assign
For the top five: a skill name (lowercase-with-hyphens), one owner, a due date in the next 7 days.

| # | Skill | What it covers | Owner | Due |
|---|---|---|---|---|
| 1 | data-handling | | | |
| 2 | definition-of-done | | | |
| 3 | | | | |
| 4 | | | | |
| 5 | | | | |

Typical winners: deploy/release steps, PR and review rules, test conventions, data handling, incident steps,
naming and project layout, customer-facing wording.
