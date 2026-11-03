---
name: proposal-writing
description: Drafts client proposals and statements of work that restate the client's problem in their words, define scope and exclusions, price with options, and make the next step easy to sign. Use when asked to "write a proposal", "draft an SOW", "turn this call into a proposal", "price this project for the client", "review my proposal", or after a sales call when a prospect has asked for a quote.
license: MIT
---

# Proposal Writing

A proposal is a decision document for the buyer, not a brochure about the seller. It wins when the reader recognizes their own problem on page one, sees exactly what they get and do not get, and can choose an option without another meeting. It loses money later when scope is vague.

## Workflow

1. **Gather inputs.** Discovery notes or transcript, the client's stated goals and numbers, deadline, budget signals, decision makers, and the user's cost or rate for the work. Ask for anything missing that affects price or scope.
2. **Write the situation section** in the client's words. Quote or closely paraphrase what they said about the problem and what it costs. If you cannot, the discovery was thin; say so.
3. **Define outcomes**, then deliverables. Outcomes are what changes for the client; deliverables are what you hand over. Each deliverable gets an acceptance criterion.
4. **Write scope and exclusions.** List what is out of scope as explicitly as what is in. Add assumptions (client provides access, feedback within 3 business days).
5. **Build the timeline** as milestones with dates or week numbers and what the client must do at each.
6. **Price with 2-3 options** (see rules). Use `templates/proposal.md`.
7. **Make the next step concrete**: sign by a date, kickoff date, first invoice terms.
8. **Review** against the checklist and list open questions for the user.

## Rules

- **Lead with their problem, not your history.** The "About us" section goes last and stays short; buyers skip it.
- **Options, not one number.** Good-better-best lets the buyer choose how to say yes instead of whether to say yes. Put the recommended option in the middle and say why.
- **Anchor price to value.** State the cost of the problem (from discovery) before the price, so the price reads small against it.
- **Fixed price needs fixed scope.** If scope is uncertain, price a paid discovery phase first or use a capped time-and-materials option.
- **Exclusions prevent scope creep.** Every unwritten assumption becomes a free change request.
- **Payment terms protect cash.** Propose a deposit (commonly 30-50%) for fixed-fee work and milestone billing after that.
- **Set an expiry date** (e.g. 30 days) so pricing and capacity are not held open forever.
- **Contract terms**: liability, IP ownership, and termination language belong in a contract. Flag for a professional rather than drafting legal terms from scratch.

## Pricing the options

- **Option A**: the core outcome with the smallest scope that still solves the stated problem. It sets the floor, not a discount version of B.
- **Option B**: what you recommend, sized to the outcomes in section 2.
- **Option C**: B plus things that raise the value for the client (faster timeline, extra deliverables, ongoing support). It anchors B.
- Price each from your cost estimate plus margin, then sanity-check against the value: if the price is more than about 10-20% of the problem's yearly cost, expect pushback and strengthen the case or reduce scope.
- Never cut price without cutting scope; it teaches the client that the first number was padded.

## Checklist

- [ ] Situation section uses the client's words and numbers
- [ ] Every deliverable has an acceptance criterion
- [ ] Exclusions and assumptions listed
- [ ] 2-3 priced options with a recommendation
- [ ] Timeline shows client responsibilities
- [ ] Clear next step with a date; proposal expiry stated
- [ ] Under 5 pages for deals under about $50k

## Example

Bad:
> Founded in 2012, we are a full-service digital agency passionate about innovation. We will redesign your website and improve your online presence. Price: $28,000.

Good:
> You told us the current site converts 0.6% of visitors to demo requests against a 2% industry benchmark, and that sales needs 40 more demos a month to hit Q3 targets. This proposal rebuilds the five pages that carry 85% of traffic and sets up conversion tracking so you can see the change by week 8.
> Option B (recommended), $28,000: five pages, tracking, two rounds of revisions, 8 weeks.

## Output

Fill `templates/proposal.md`. Return the proposal, then:

```
### Open questions for you
- <anything assumed that changes price or scope>
### Risks
- <scope or delivery risk and how the proposal handles it>
```
