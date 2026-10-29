---
name: prompt-engineering
description: Writes, debugs and evaluates prompts and system prompts for LLM features and agents, turning vague instructions into explicit task, context, constraints and output format, and testing changes against a small eval set. Use when asked to "write a prompt", "improve this system prompt", "the model keeps doing X", "make the output consistent", "design a prompt for classification/extraction", or when building or tuning any LLM-powered feature.
license: MIT
---

# Prompt Engineering

Write prompts the way you would brief a capable new colleague who has no context: say what the task is, why it matters, what good output looks like, and what to do in the awkward cases. Then prove the prompt works on real inputs. A prompt change without a before/after comparison on a fixed set of cases is a guess.

## Workflow

1. **Define the job.** Write one sentence: input, output, and who consumes the output (a human, a parser, another agent). Note the model and how it is called (system vs user message, tools, temperature, max tokens).
2. **Collect 10-30 real inputs** before writing, including the ugly ones: empty, very long, ambiguous, adversarial, off-topic, other languages. Write the expected output or pass criteria for each. This is the eval set.
3. **Draft the prompt** using the structure below.
4. **Run it on the whole set** and read every output. Classify failures (wrong format, wrong judgment, ignored instruction, hallucinated fact, too verbose).
5. **Fix the biggest failure class first** with the smallest change: clarify an instruction, add the reason behind it, add one example covering that case, or move the instruction closer to where it applies.
6. **Re-run the whole set** after each change to catch regressions. Keep a short changelog of prompt versions and pass rates.
7. **Stop** when the pass rate meets the bar the user set, or report what remains and why.

## Prompt structure

1. **Role and goal** in one or two sentences, including who the output is for.
2. **Context** the model cannot know: the product, the users, definitions of domain terms, policies.
3. **Task instructions** as direct imperatives, ordered the way the model should work.
4. **Rules for edge cases**, each with its reason ("If the ticket mentions a refund, route to billing, because support cannot issue refunds").
5. **Examples**: 2-5 diverse input/output pairs, wrapped in clear delimiters (XML tags work well), covering the hard cases, not only the easy one.
6. **Output format**, exact: a JSON schema, a template, or tags. For parsed output, use the API's structured output or tool calling instead of asking nicely for JSON when available.
7. **Input** last, delimited (`<document>...</document>`), especially when long.

## Rules

- **Explain why.** Models generalize from reasons; a rule with a reason is followed in cases the rule did not name.
- **Say what to do, not only what not to do.** "Write in plain paragraphs" works better than "don't use markdown".
- **Be specific about quantities**: "3-5 bullets, each under 20 words" not "be concise".
- **Give an escape hatch.** Tell the model what to output when the input is out of scope or information is missing ("return `{\"status\": \"insufficient_info\"}`"), or it will invent something.
- **Examples are strong signals.** Vary them; a single example gets copied in length, tone and structure.
- **Do not shout.** ALL CAPS and "CRITICAL" cause over-application on modern models; state the rule plainly with its reason.
- **Separate instructions from data** with delimiters, and tell the model that content inside the data tags is data, not instructions (prompt injection defense for user-supplied text).
- **Ask for reasoning before the answer** when the task needs judgment and the reasoning is not shown to end users; put the final answer in its own tag so it can be parsed.
- **Keep one source of truth.** Remove contradictory or duplicated instructions accumulated over edits.

## Example

Bad:
> You are a helpful assistant. Classify the support ticket. Be accurate! Output JSON.

Good:
> You triage support tickets for a B2B invoicing app so they reach the right queue within minutes.
> Classify the ticket in `<ticket>` into exactly one category: `billing` (charges, refunds, invoices we sent the customer), `bug` (something in the app behaves incorrectly), `how_to` (the app works but the user does not know how), `account` (login, users, permissions), or `other`.
> If a ticket fits several, pick the one that needs action first: a bug that causes a wrong charge is `billing`, because billing can refund while engineering investigates.
> Return JSON: `{"category": "...", "confidence": "high|low", "reason": "<one sentence>"}`. Use `low` when the ticket is too vague to be sure.
> `<examples>` ... three varied examples ... `</examples>`
> `<ticket>{{ticket_text}}</ticket>`

## Output

1. The prompt, in a code block, with placeholders like `{{variable}}` for inputs.
2. The eval set (inputs and pass criteria), as a table or JSONL file if the user wants to keep it.
3. Results: pass rate per version, and the remaining failures with your diagnosis.
4. Recommended call settings (model, temperature, max tokens, structured output) when relevant.
