---
name: pr-description
description: Writes pull request titles and descriptions that state the problem, the approach, the risk and exactly how the change was verified, so reviewers can approve quickly and future readers can find why a change happened. Use when asked to "open a PR", "write the PR description", "summarize this branch for review", "fill in the PR template", or after finishing a branch that needs review.
license: MIT
---

# PR Description

Give the reviewer everything they need to judge the change without asking a question, and give the person running `git blame` in two years the reason behind it. A PR description is a review aid and a historical record, not a changelog of files touched.

## Workflow

1. **Collect the facts.** Run `git log --oneline <base>..HEAD`, `git diff <base>...HEAD --stat`, and read the full diff. Find the linked issue or ticket and read it.
2. **Use the template if one exists.** Check `.github/pull_request_template.md`, `.github/PULL_REQUEST_TEMPLATE/`, `docs/pull_request_template.md`, and GitLab's `.gitlab/merge_request_templates/`. Fill every section; write "N/A" with a reason rather than deleting a section.
3. **Write the title** (rules below).
4. **Write the body** in the order of the Output section.
5. **Check size.** If the diff is over roughly 400 changed lines of non-generated code, or mixes a refactor with a behavior change, say so and suggest how to split it. Do not split it yourself unless asked.
6. **Verify every claim.** Anything under "Testing" must be something you or the author actually ran. If you did not run it, write "not run".
7. **Create or update the PR** only if asked (`gh pr create --title ... --body-file ...`). Use a body file so Markdown survives.

## Title rules

- Under 72 characters, imperative, specific: `Fix duplicate charges when checkout is retried`.
- Match the repo's convention (Conventional Commits prefix, ticket key) if recent merged PRs use one: `gh pr list --state merged --limit 10`.
- Never: "Updates", "WIP", "Fix bug", branch names, or ticket numbers alone.

## Body rules

- **Lead with why.** First paragraph: the problem or goal in user or system terms, with a link to the issue.
- **Describe the approach, not the diff.** Two to six bullets on the design decisions. Name the alternatives you rejected when a reviewer would reasonably suggest them.
- **Call out risk explicitly.** Migrations, config changes, new dependencies, changed public APIs, feature flags, permission changes, anything irreversible. Say how to roll back.
- **Point reviewers at the hard part.** "Most of the diff is mechanical renames; the logic change is in `billing/retry.py`."
- **Testing is evidence.** Commands run and results, test names added, manual steps with expected outcome. Screenshots or recordings for UI changes, before and after.
- **No filler.** No "This PR...", no restating the title, no lists of every file.
- **Mention follow-ups** you deliberately left out, with issue links if they exist.
- Do not mention tools or assistants used to write the code unless the project requires it.

## Example

Bad:

```
Title: Updates to payment stuff

This PR updates the payment service and some tests. Files changed:
payment.py, test_payment.py, utils.py.
```

Good:

```
Title: Make checkout retries idempotent to stop duplicate charges

## Why
Customers on slow connections were charged twice when the client retried
POST /checkout after a timeout (#913, 41 cases last month).

## What changed
- Client sends an Idempotency-Key header; server stores key + response for 24h.
- A repeat key returns the stored response instead of charging again.
- Chose a DB table over Redis so keys survive a cache flush.

## Risk and rollout
- New table `idempotency_keys` (additive migration, no locks).
- Behind flag `checkout_idempotency`, default off. Roll back by turning it off.

## Testing
- `pytest tests/payments -q`: 212 passed.
- New: test_retry_with_same_key_charges_once, test_key_expires_after_24h.
- Manual: retried a staging checkout 3x with the same key, one charge in Stripe test dashboard.

## Reviewer notes
Logic is in `payments/idempotency.py`; the rest is wiring.
```

## Output

Produce the title on its own line, then the body in Markdown with these sections, in order: **Why**, **What changed**, **Risk and rollout** (or "Low risk:" plus one line explaining why), **Testing**, and optionally **Reviewer notes** and **Follow-ups**. If you created the PR, also return its URL.
