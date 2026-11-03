---
name: skill-writer
description: Turns a team's know-how into a tested Agent Skill by interviewing the user, picking the right shape (procedure, review checklist, writing voice, sales or customer playbook, policy rules, metric recipe), writing SKILL.md with a test case, and checking it. Use when someone says "make this a skill", "turn our SOP into a skill", "write a skill for how we do X", "teach the agent our process", "create a skill from this doc", or pastes a policy, runbook or wiki page and wants agents to follow it.
license: MIT
---

# Skill Writer

A skill is only worth installing if it tells the agent something it could not guess: your names, numbers, commands,
approvers and the reasons behind your rules. Your job is to pull that out of the user (or their document), put it in
the shape that fits, and prove it helps.

## Workflow

1. **Find the source.** Ask for the document if one exists (SOP, policy, wiki page, playbook, last month's report).
   If there is none, interview: what triggers this work, who does it, what goes wrong, what "done" looks like.
2. **Pick the shape** from [the generator guide](references/shapes.md): procedure, checklist, voice, playbook,
   decision or metric. One job per skill. If the material covers two jobs, write two skills.
3. **Write the description first.** What it does and when to use it, with 4-6 phrases people actually type. The
   agent decides whether to load a skill from this line alone.
4. **Write the body in the shape's sections.** Keep every real name, system, command, threshold and approver from
   the source. Write each rule with its reason ("never refund a disputed charge, because Stripe reverses it twice").
   Do not invent facts; when something is missing, ask or leave it out.
5. **Write one test from a real request.** Put it in `evals/evals.json`: the request as a colleague would type it
   (it must not state the rule the skill teaches) and 2-4 checks a good answer must pass.
6. **Check it.** If the Skillyard CLI is available, run `npx skillyard validate <folder>` and fix every error and
   warning, then offer `npx skillyard eval <folder> --model haiku --runs 2` to measure it with and without.
7. **Show the user** the folder and the one rule you were least sure about.

## Rules

- **Specific beats complete.** Ten concrete rules beat a page of principles; generic advice ("be thorough") is noise
  the model already follows, and it costs context on every load.
- **No secrets.** Refer to keys and passwords by where they live ("the BILLING_API_KEY variable"), never paste them.
- **Nothing that hides from the user,** overrides other instructions or skips permission prompts: scanners reject it
  and it breaks trust.
- **Under 150 lines.** Move long reference material to `references/` and link it.

## Example

Bad description: `Refund stuff.` (never loads).
Good description: `Decides whether a refund can be approved and who signs off, from the support refund policy. Use
when someone says "can I refund this", "who approves a $700 refund", "refund on an annual plan".`

## Output

```
<skill-name>/
  SKILL.md            frontmatter (name, description, license) + body in the chosen shape
  evals/evals.json    {"cases":[{"name":"...","prompt":"...","checks":[{"type":"judge","value":"..."}]}]}
  references/…        only if needed
```

Then a two-line summary: the shape you chose and why, and what you could not find in the source.
