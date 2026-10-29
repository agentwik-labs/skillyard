---
name: architecture-decision-records
description: Writes, updates and supersedes Architecture Decision Records (ADRs) that capture one decision, its context, the options considered with honest trade-offs, and the consequences. Use when asked to "write an ADR", "document this decision", "record why we chose X over Y", "should we use Postgres or DynamoDB, write it up", or when a design discussion reaches a decision that future engineers will question.
license: MIT
---

# Architecture Decision Records

Capture a single significant technical decision so that someone joining in two years can see what was decided, why, what else was on the table, and what it cost. ADRs are short, immutable once accepted, and numbered. They record reasoning at the time; they are not design docs and not tutorials.

## Workflow

1. **Find the ADR directory.** Look for `docs/adr/`, `docs/decisions/`, `adr/`, or `architecture/decisions/`. Match the existing numbering (`0007-...md`) and template. If none exists, create `docs/adr/` with `0001-record-architecture-decisions.md` first, then the new one.
2. **State the decision in one sentence** before writing anything else. If you cannot, there are several decisions; split them into separate ADRs.
3. **Write the context**: the forces at play, the constraints (team size, budget, latency target, compliance, existing systems), and why the decision is needed now. Facts and numbers, not opinions.
4. **List options**, including "do nothing / keep current" and at least one serious alternative. For each: what it is, pros, cons, rough cost. Steelman the options you reject.
5. **Record the decision** in active voice: "We will use X for Y."
6. **Write consequences**: positive, negative, and neutral follow-on work. Negative consequences are mandatory; a decision with no downsides was not a decision.
7. **Set status** (`proposed` until the deciders agree), date, and deciders.
8. **Link** related ADRs. If this replaces an earlier decision, mark the old one `superseded by NNNN` and the new one `supersedes NNNN`. Do not edit the old one's body.

## Rules

- **One decision per ADR.** "Adopt Kafka and move to Kubernetes" is two ADRs.
- **Immutable after acceptance.** Change your mind with a new ADR that supersedes the old one. The history of reversals is valuable.
- **Significant decisions only:** hard to reverse, affects several teams or components, or chooses between real alternatives. Not "use lodash".
- **Name the criteria** that decided it (e.g. "operational burden on a 3-person team outweighed the 20% cost saving"). The criterion is what readers need when circumstances change.
- **Keep it under about two pages.** Link out to benchmarks, spikes, and design docs instead of pasting them.
- **Write for the skeptic** who arrives later believing the other option was obviously better.
- **Be honest about uncertainty**: list assumptions that, if wrong, should trigger revisiting the decision.

## When to write one (and when not)

Write an ADR when any of these is true:
- Reversing the choice later would take more than a sprint or a data migration.
- Two or more reasonable options were debated, in a meeting, a thread, or a PR.
- The choice constrains other teams (a shared protocol, a database, a queue, an auth model).
- A new engineer would plausibly ask "why on earth did we do it this way?"

Do not write one for:
- Library choices that are easy to swap behind an interface.
- Coding style, naming, or lint rules (put those in the contributing guide).
- Decisions already fully captured by an accepted ADR; link to it instead.

## Common failure modes

- **Retroactive justification**: the option list contains only straw men. Fix by writing the strongest case for each rejected option in its own words.
- **Missing "why now"**: without the trigger, readers cannot judge whether the context still holds.
- **Decision hidden in prose**: the reader should find the decision sentence in under ten seconds.
- **Status rot**: `proposed` ADRs that were silently adopted. When the change ships, ask the user to flip the status.

## Example

Bad decision section:
> We decided to use PostgreSQL because it is the best database and very popular.

Good decision section:
> We will store order and inventory data in PostgreSQL 16 on the managed RDS offering.
> Deciding criteria: we need multi-row transactions across orders and stock (ruling out DynamoDB without significant application-level compensation logic), and the team has operated Postgres before while nobody has run CockroachDB in production.
> Revisit if: write volume exceeds roughly 5k TPS sustained, or we need active-active multi-region writes.

## Output

Create `docs/adr/NNNN-kebab-case-title.md` from `templates/adr.md`, with the next free number, and:
- Update any ADR index (`docs/adr/README.md`) if one exists.
- If superseding, edit only the status line of the old ADR.
- In your reply, give the file path, the one-sentence decision, and any open questions that block moving status from `proposed` to `accepted`.
