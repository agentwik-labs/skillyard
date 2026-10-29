---
name: web-accessibility-audit
description: Audits web pages, components and HTML/JSX templates against WCAG 2.2 AA (alt text, labels, headings, contrast, keyboard access, focus, ARIA misuse) and produces prioritized fixes with code. Use when asked to "check accessibility", "a11y audit", "is this page WCAG compliant", "make this form accessible", "screen reader issues", or before launching a public-facing page or component library.
license: MIT
---

# Web Accessibility Audit

Find the barriers that stop real people (screen reader users, keyboard-only users, people with low vision or cognitive load) from completing the page's main tasks, and fix them in code. Automated checks catch roughly a third of issues; the rest need reading the markup and walking the page by keyboard. Prioritize by whether a user can finish the task, not by rule count.

## Workflow

1. **Identify the key tasks** on the page (sign up, check out, read article, submit form). The audit is organized around them.
2. **Run the static check** on HTML files or rendered output. From the skill directory:
   `python3 scripts/check_html.py <file-or-dir> [more paths]`
   It reports missing `lang`, images without `alt`, form controls without labels, buttons and links with no accessible name, heading-level skips, missing or multiple `h1`, positive `tabindex`, duplicate `id`s, and `autoplay` media. Exit 0 = no issues, 1 = issues found, 2 = usage error. For JSX/templates, save rendered HTML (view-source or a test render) and check that.
3. **If a browser is available**, also run axe-core or Lighthouse accessibility on the live page for contrast and computed ARIA.
4. **Review manually** using the checklist below; these cannot be automated reliably.
5. **Keyboard walk**: Tab through each key task. Every interactive element reachable, focus visible, order matches visual order, no traps, Escape closes dialogs, focus returns to the trigger.
6. **Write fixes** as code diffs, smallest change that works, native HTML first.
7. **Report** in the Output format.

## Manual checklist (WCAG 2.2 AA)

- **Alt text quality**: describes purpose, not "image of". Decorative images use `alt=""`. Images of text are avoided.
- **Contrast**: 4.5:1 for body text, 3:1 for large text (24px or 18.66px bold) and for UI component boundaries and focus indicators.
- **Focus visible**: never `outline: none` without a replacement of at least 2px with 3:1 contrast.
- **Target size**: interactive targets at least 24x24 CSS px (2.5.8).
- **Forms**: visible label (placeholder is not a label), errors in text tied with `aria-describedby`, required fields marked in text not only color, `autocomplete` on personal data fields.
- **Color alone** never conveys state (errors, required, chart series).
- **Landmarks**: one `main`, `nav` for navigation, `header`/`footer`; a skip link to main content.
- **Dynamic content**: status messages via `role="status"`/`aria-live="polite"`; modals use `<dialog>` or `role="dialog"` with `aria-modal`, focus trapped inside and restored after.
- **Motion**: honor `prefers-reduced-motion`; no flashing over 3 times per second; carousels can be paused.
- **Zoom and reflow**: usable at 200% zoom and 320px width without horizontal scrolling.
- **Language**: `lang` on `<html>`, and on passages in another language.

## Rules

- **Native first.** A `<button>` beats `<div role="button" tabindex="0">` with key handlers. The first rule of ARIA is not to use ARIA when HTML has it.
- **No ARIA is better than wrong ARIA.** `aria-label` on a `div` with no role does nothing; `aria-hidden="true"` on a focusable element creates a ghost tab stop.
- **Accessible name must match visible label** (2.5.3), so voice-control users can say what they see.
- **Do not add `title` as a fix**; it is not reliably announced and invisible to keyboard users.
- **Rate by user impact**: Blocker (task cannot be completed), Serious (completed with major difficulty), Moderate, Minor.

## Example

Bad:
```html
<div class="btn" onclick="save()"><img src="disk.svg"></div>
<input placeholder="Email">
```
Good:
```html
<button type="button" onclick="save()"><img src="disk.svg" alt="">Save draft</button>
<label for="email">Email</label>
<input id="email" type="email" autocomplete="email">
```

## Output

```
## Accessibility audit: <page/component> (WCAG 2.2 AA)

Summary: <N issues: x blocker, y serious ...>; key tasks checked: <list>

| # | Impact | WCAG SC | Where | Problem | Fix |
|---|---|---|---|---|---|
| 1 | Blocker | 4.1.2 | checkout.html:88 `<div class="btn">` | Not keyboard operable, no name | Use `<button>` with text |

### Code changes
<diffs, grouped by file>

### Not tested
<e.g. screen reader pass with NVDA/VoiceOver, live contrast if no browser>
```
Never claim a page is "fully compliant"; say what was checked and how.
