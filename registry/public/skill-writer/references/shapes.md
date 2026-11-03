# Shapes (Skillyard generators)

| Shape | Use for | Sections |
|---|---|---|
| procedure | Work done the same way every time: deploys, month-end close, customer onboarding | Before you start, Steps (numbered), Rules (rule: reason), Stop and escalate when, Output |
| checklist | A quality gate before something ships: PR review, contract flags, campaign QA | Blockers, Should fix, Do not flag, Output |
| voice | How the company sounds | Audience and tone, Always, Never say, Our words, Sounds right, Output |
| playbook | A repeatable play: renewal at risk, discovery call, escalation | Situation, Win, The play (numbered), Objections, Template, Measure, Output |
| decision | Who can approve what: refunds, discounts, data access, spend | Look at first, Rules (if: then), Approvers, Never, Output |
| metric | How numbers are defined and reported | Definitions (metric: formula), Data, Check before reporting, Output |

The same shapes power `npx skillyard generate <shape> --from <document>` and the builder at
https://agentwik-labs.github.io/skillyard/#/create.
