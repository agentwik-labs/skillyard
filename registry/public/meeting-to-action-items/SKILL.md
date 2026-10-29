---
name: meeting-to-action-items
description: Turns meeting transcripts, recordings' notes or rough notes into a short summary of decisions, action items with a single owner and due date each, and open questions, ready to paste into chat, email or a tracker. Use when asked to "summarize this meeting", "pull action items from this transcript", "what did we agree on", "write the meeting notes", "send a recap", or when given a transcript or call notes.
license: MIT
---

# Meeting to Action Items

Extract what changes because the meeting happened: decisions made, work someone committed to, and questions still open. Attendees do not need a retelling of the conversation; people who missed it need to know what was decided and what is expected of them. Precision about who and when matters more than coverage.

## Workflow

1. **Read the whole transcript first.** Decisions often get reversed or refined later in the call; the last word wins.
2. **Identify participants** and map speaker labels to names and roles where possible. If labels are generic ("Speaker 2"), keep them and flag it.
3. **Extract decisions**: statements the group agreed on ("let's go with", "agreed", "we'll ship without"). Include the reason if one was given.
4. **Extract action items**: any commitment to do something ("I'll", "can you", "let me check", "we need someone to"). For each, find the owner and due date stated or implied.
5. **Extract open questions and risks** that were raised but not resolved.
6. **Resolve ambiguity honestly**: if the owner or date was not stated, write `Owner: unassigned` or `Due: not set` rather than guessing, and list it under "Needs confirmation".
7. **Write the recap** in the Output format, in the language of the meeting.

## Rules

- **One owner per action item.** "Engineering" or "Sam and Priya" is not an owner. If two people share it, split the item or pick the person who said "I'll".
- **Start each action with a verb** and make it checkable: "Send the revised pricing sheet to Acme" not "pricing".
- **Absolute dates.** Convert "Friday" or "end of next week" into a date using the meeting date; ask for the meeting date if unknown and mark relative dates as such.
- **Decisions are not action items** and vice versa. "We will use vendor B" is a decision; "Lena signs the vendor B contract by 2026-05-09" is an action.
- **No invented content.** Every item must trace to something said. When you infer, mark it "(inferred)".
- **Keep it short.** Summary at most 5 bullets. Omit small talk, status that changed nothing, and repeated points.
- **Neutral tone.** Do not characterize people ("Sam pushed back hard"); record the positions and the outcome.
- **Sensitive content** (HR, personal, compensation, legal) stays out of a broad recap unless the user asks; mention that it was left out.

## Example

Transcript excerpt:
> Maya: So we're agreed, launch slips to the 14th. Dev, can you update the status page copy?
> Dev: Yeah, I'll do it tomorrow. Someone should tell sales too.
> Maya: Ok. Also still no answer from legal on the EU terms.

Bad recap:
> The team discussed the launch timeline and various follow-ups. Sales should be informed. Legal is pending.

Good recap (meeting date 2026-05-04):
> **Decisions**
> - Launch moves to 2026-05-14.
>
> **Action items**
> | Action | Owner | Due |
> |---|---|---|
> | Update status page copy with the new launch date | Dev | 2026-05-05 |
> | Tell sales about the new launch date | unassigned | not set |
>
> **Open questions**
> - EU terms still awaiting legal review (raised by Maya).
>
> **Needs confirmation**
> - Who tells sales, and by when?

## Output

```
# <Meeting title> - <YYYY-MM-DD>
Attendees: <names>

## Summary
- <at most 5 bullets>

## Decisions
- <decision> (<reason if given>)

## Action items
| # | Action | Owner | Due | Notes |
|---|---|---|---|---|

## Open questions / risks
- <question> (raised by <name>)

## Needs confirmation
- <missing owners, dates, or unclear decisions>
```
If the user asks for a tracker format, also emit one line per action item: `- [ ] <Action> - @owner - due YYYY-MM-DD`.
