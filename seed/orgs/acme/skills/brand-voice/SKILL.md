---
name: brand-voice
description: Writes and edits copy in the Acme Cloud brand voice, covering product UI text, docs, release notes, blog posts, emails and social posts. Use when someone asks to "write this in Acme voice", "make this sound like Acme", "draft release notes", "review this landing page copy", or produces any customer-facing text for Acme Cloud.
license: Proprietary
---

# Acme Cloud Brand Voice

Acme Cloud sells workflow automation to operations teams. Our readers are busy ops
managers, not developers by default. Copy should make them feel capable and save them time.

## Voice in one line

Plain, specific, calm. We sound like a senior ops colleague who has seen it all and
explains it in two sentences.

## Workflow

1. Identify the surface: UI string, docs page, release note, blog, email, or social post.
   Each has a length budget (see Rules).
2. Identify the reader: admin, builder (creates workflows), or viewer. Name the reader's
   goal in one sentence before writing.
3. Draft with the verb first. Lead with what the reader can now do, not what we built.
4. Swap terms using the glossary in `references/glossary.md`.
5. Run the banned-phrase pass (below). Remove every hit; do not soften it.
6. Cut 20 percent. Read the result aloud in your head; any sentence over 25 words gets split.
7. Return the copy plus a short list of the changes you made and why.

## Rules

- Product name is "Acme Cloud" on first mention, "Acme" after. Never "ACME", "AcmeCloud" or
  "the Acme platform". Reason: trademark filings use the two-word form.
- Feature names are sentence case: "Workflow builder", "Run history", "Approvals inbox".
  Reason: Title Case reads like marketing and clashes with the UI.
- Use "you" for the reader and "we" for Acme. Never "users" in customer-facing copy.
- Numbers: numerals for 10 and up, words for one to nine, except in UI where numerals are always used.
- Use the Oxford comma.
- No exclamation marks outside of onboarding success states (max one per screen).
- Length budgets: button 3 words, toast 12 words, empty state 2 sentences,
  release-note item 30 words, social post 240 characters.
- Do not promise dates or roadmap items in any public copy. Reason: Legal requires
  forward-looking statements to go through #legal-review.

## Banned phrases

"seamless", "seamlessly", "revolutionary", "game-changer", "best-in-class", "leverage"
(as a verb), "synergy", "simply" / "just" (in instructions), "AI-powered" (say what it does
instead), "world-class", "unlock", "supercharge", "100% uptime".

## Example

Before: "Leverage our revolutionary AI-powered builder to seamlessly supercharge your workflows!"

After: "Describe a workflow in a sentence and Acme drafts the steps for you. Review, edit, and run."

Changes: removed four banned phrases, led with the reader's action, replaced
"AI-powered" with what the feature does, dropped the exclamation mark.

## Output

Return, in this order:

1. The final copy, ready to paste.
2. "Changes" - a bulleted list of edits with a one-line reason each.
3. "Needs review" - anything that touches pricing, security claims, or dates, flagged for
   #legal-review. Write "None" if empty.
