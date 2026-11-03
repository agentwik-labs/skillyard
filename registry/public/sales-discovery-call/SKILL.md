---
name: sales-discovery-call
description: Prepares for and debriefs B2B sales discovery calls, building a short account brief, a question plan that uncovers pain, impact, decision process and timeline, and a qualification summary with a clear next step. Use when someone says "prep me for a discovery call", "what should I ask this prospect", "debrief this sales call", "qualify this lead", "summarize the call notes", or shares a transcript of a first sales conversation.
license: MIT
---

# Sales Discovery Call

Discovery decides whether a deal exists and what it is worth. Most bad calls fail the same way: the seller demos too early, talks most of the time, and leaves without knowing who decides, what the problem costs, or what happens next. Prepare so the prospect does most of the talking, then write down what was learned and what is still unknown.

## Workflow

1. **Collect inputs.** Company name, contact name and title, how the lead came in, what the user sells, and any notes or transcript. If preparing, ask for the call length.
2. **Build the account brief** (5-8 bullets, no padding): what the company does, size, recent news that creates urgency (funding, hiring, a launch, a leadership change), the likely owner of the problem, and one hypothesis about why they took the call. Mark every guess as a guess.
3. **Write the question plan** using `templates/discovery-call-notes.md`. Pick 8-12 questions across the five areas below, ordered from easy to probing. Put the two that matter most in bold.
4. **Plan the close.** Decide before the call which next step you will ask for (technical session, pilot scope, meeting with the economic buyer) and write the exact sentence.
5. **After the call, debrief.** Fill the qualification table from the notes or transcript. Each field is Known, Partial, or Unknown, with the evidence quoted. Never fill a field from assumption.
6. **Recommend** one of: advance (with the next step and date), nurture (with the trigger to re-engage), or disqualify (with the reason). Draft the follow-up email in under 120 words.

## Question areas

- **Situation**: how they do it today, which tools, who is involved. Keep this short; research should already cover most of it.
- **Pain**: what breaks, how often, what it caused last time. Ask for a specific recent example.
- **Impact**: what the problem costs in money, hours, risk or revenue. Get a number from them, not from you.
- **Decision process**: who else cares, who signs, what the buying steps are, whether procurement or security review applies, what budget exists.
- **Timeline and trigger**: why now, what happens if they do nothing, any date that forces a decision.

## Rules

- **Talk under 40% of the time.** Prospects reveal priorities only when they talk; a monologue teaches you nothing.
- **No demo in discovery** unless they insist. A demo before you know the pain shows features they do not care about.
- **Ask one question at a time and follow up twice** ("What happened then?", "What did that cost?"). The first answer is the polite one.
- **Quantify impact in their words.** A number the prospect says out loud becomes the business case; a number you claim becomes a negotiation.
- **Find the economic buyer early.** Deals stall at signature when the champion cannot spend the money.
- **Disqualify honestly.** A clean no frees time for deals that close; a fake "maybe" pollutes the forecast.
- **Always leave with a dated next step.** "I'll send some info" is not a next step.

## Example

Bad debrief:
> Great call! They loved the product and want to move forward. Budget looks fine. Will follow up next week.

Good debrief:
> Pain: Known. Ops lead re-keys 300 orders/week from email into the ERP; two shipping errors last month cost a $40k account ("we nearly lost Dalton"). Impact: Partial, about 15 hrs/week of one person; dollar cost of errors not confirmed. Economic buyer: Unknown, the ops lead "would need to run it by the COO". Timeline: Known, peak season starts Sept 1. Next step: 30-min call with COO on Thu 14th, agreed live on the call.

## Output

Use `templates/discovery-call-notes.md`. Short form:

```
## Account brief
- <fact or [guess]>

## Question plan
1. <question>  (area)

## Qualification (after call)
| Area | Status | Evidence |
|---|---|---|
| Pain | Known / Partial / Unknown | "<quote>" |
| Impact | | |
| Economic buyer | | |
| Decision process | | |
| Timeline | | |

## Recommendation
<advance / nurture / disqualify> because <reason>. Next step: <what, who, date>.

## Follow-up email
<under 120 words: recap of their pain in their words, the agreed next step, one attachment at most>
```
