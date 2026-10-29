---
name: technical-spec-writing
description: Writes engineering design docs and technical specs that state the problem, goals and non-goals, the proposed design with APIs and data model, alternatives, rollout, and risks, so reviewers can approve or challenge it before code is written. Use when asked to "write a tech spec", "write a design doc", "RFC for this feature", "how should we build X, write it up", or before starting work that spans several days, services or teams.
license: MIT
---

# Technical Spec Writing

Write the document that lets reviewers find the expensive mistakes while they are still cheap: wrong problem, missing requirement, design that will not scale, migration that cannot be rolled back. A spec is a decision tool, not a record of everything you know. Optimize for a reviewer who has 20 minutes.

## Workflow

1. **Gather inputs.** Product requirement or ticket, relevant code (read the modules you will touch), existing data model, traffic numbers, related ADRs and past specs. List what is unknown.
2. **Write problem, goals, non-goals first** and confirm them with the user before designing. Most spec rewrites come from a misread problem.
3. **Design** at the level that matters for review: components and responsibilities, API contracts, data model changes, key flows (a sequence of steps or a diagram), and how failure is handled.
4. **Size it.** Expected load, data volume, latency budget, cost. Back-of-envelope numbers with the arithmetic shown.
5. **Write alternatives** you seriously considered and why they lost.
6. **Plan rollout**: feature flags, migrations (expand/contract), backfills, rollback path, and how you will know it works (metrics, alerts, dashboards).
7. **List risks and open questions**, each with an owner or a proposed way to resolve.
8. **Break into milestones** that each deliver something testable.
9. **Self-review** against the checklist below, then hand off.

## Rules

- **Non-goals are mandatory.** They prevent scope creep and tell reviewers which concerns are out of bounds.
- **Measurable goals.** "p95 search latency under 300 ms at 200 RPS" not "fast search".
- **Contracts in full.** Show request/response shapes, error cases and status codes, event schemas, and new columns with types and nullability. Ambiguity here becomes integration bugs.
- **Design for failure explicitly**: what happens when each dependency is slow or down, retries and idempotency, timeouts, partial failure, data consistency.
- **Security and privacy** get a section if the change touches auth, PII, payments, or external input. "N/A" with a reason is acceptable.
- **Reversibility.** Every rollout step says how to undo it. Flag any one-way door loudly.
- **Short.** Two to six pages for most features. Move detail to appendices. No code beyond interfaces and critical snippets.
- **Mark decisions vs proposals.** Reviewers should see which points are open for debate.

## Self-review checklist

- [ ] A newcomer can state the problem and why now after reading the first section.
- [ ] Each goal is verifiable; each non-goal is something a reviewer might plausibly expect.
- [ ] Every new API, table, event and config has a defined shape.
- [ ] Failure modes are covered for every external call.
- [ ] Numbers are shown with their source or arithmetic.
- [ ] Rollout can be paused and reversed at each step.
- [ ] Open questions have owners.

## Example

Bad goal section:
> Goals: improve notifications and make them more reliable and scalable.

Good:
> **Goals**
> - Deliver order-status emails within 60 s of the status change for 99% of orders (today: p99 is 14 min due to the hourly batch).
> - No duplicate emails when the worker retries.
>
> **Non-goals**
> - SMS and push notifications (separate spec, Q3).
> - Changing email templates or copy.

## Output

Write the spec as markdown, using `templates/spec.md` (keep headings, delete sections that truly do not apply and say why in one line). Save where the project keeps design docs (`docs/design/`, `docs/rfcs/`, or as the user directs). In your reply, list the open questions that block approval and the reviewers you would ask, by area (e.g. data, security, on-call).
