---
name: engineer-onboarding
description: Guides a new Northwind Pay engineer through their first two weeks, including access requests, required compliance training, local setup for the Python and Go services, environments and shipping a first change. Use when someone says "I'm new", "onboard me", "how do I get access to", "set up my laptop", "what training do I need", or helps a new hire at Northwind Pay.
license: Proprietary
---

# Northwind Pay Engineer Onboarding

New engineers should ship a small production change in their first two weeks without
ever touching cardholder data. Access is granted in stages because of PCI-DSS and SOC 2.

## Week 1 workflow

1. Day 1: confirm laptop is enrolled in device management and full-disk encryption is on
   (`nwctl device check`). Nothing else works until this passes.
2. Complete required training in the LMS before any production access is requested:
   Security Awareness, PCI-DSS for Engineers, Data Handling at Northwind, and Secure Coding (OWASP).
   Reason: auditors sample new hires' training dates against access grant dates.
3. Request baseline access through the IT portal using the "Engineer - baseline" bundle:
   GitHub org `northwind-pay`, Jira (projects ENG, CHG), Confluence, Slack, Datadog (read),
   AWS `nw-dev` via SSO.
4. Install the toolchain: `brew bundle --file=dev-setup/Brewfile`, then `make bootstrap` in
   `nw-platform`. This installs Python 3.11 with uv, Go 1.22, pre-commit, and `nwctl`.
5. Run a service locally: `nwctl dev up payouts-api`. It starts Postgres and Kafka in Docker
   with synthetic data only.
6. Join channels: #eng, #eng-help, #deploys, #sec-questions, your team channel.
7. Meet your onboarding buddy (assigned in the Jira onboarding ticket) for a 30-minute
   walkthrough of the service map in Confluence: Engineering > Architecture.

## Week 2 workflow

8. Pick a `good-first-issue` ticket from your team's Jira board.
9. Ship it through the normal path: PR, review, staging, change ticket, prod
   (see change-management).
10. Request `nw-staging` write access if your team needs it; production read access
    comes after 30 days and manager approval.

## Environments

| Env | AWS account | Data | Your access |
| --- | --- | --- | --- |
| dev | nw-dev | synthetic | week 1 |
| staging | nw-staging | synthetic | week 2 |
| prod | nw-prod | real, non-CDE | read after 30 days, JIT write |
| cde-prod | cde-prod | cardholder data | only for CDE team after PCI review |

## Rules

- Never request CDE access during onboarding. It requires a business case and CISO approval.
- Never copy prod data to your laptop or to dev or staging.
- Secrets live in Vault (`vault.northwind.example`). Never put them in `.env` files you commit.
- Commits must be signed (`git config commit.gpgsign true`); unsigned commits fail CI.
- Ask security questions in #sec-questions; there are no silly ones.

## Example

New hire asks: "Can I get prod database access to understand the schema?" Answer: no
during onboarding; use the schema docs generated at `nwctl schema docs payouts-api` and
the dev database with synthetic data.

## Output

Return a personalized checklist for the engineer's current day, with each item marked
done or todo, the exact command or portal bundle to use, and who to ask if blocked.
