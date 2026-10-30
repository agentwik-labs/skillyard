# Skill review checklist

Use on every PR that adds or changes a skill. Examples of each failure:
https://agentwik-labs.github.io/skillyard/#/examples

**Will an agent load it at the right time?**
- [ ] The description says what it does and when to use it, with phrases people actually type.
- [ ] It doesn't claim "every task". It's scoped to one job.

**Does it say things a model couldn't guess?**
- [ ] It has concrete names, commands, tables, thresholds, and no "be thorough, follow best practices".
- [ ] No rule contradicts another skill or the repo's CLAUDE.md / AGENTS.md.
- [ ] Every file it mentions (scripts/, references/, templates/) exists.

**Is it safe?**
- [ ] No secrets, tokens or customer data, even "examples".
- [ ] It never tells the agent to hide anything from the user, skip permission prompts, or ignore other instructions.
- [ ] Scripts don't download-and-run code or send data anywhere unexpected. Read every script.

**Does it help?**
- [ ] It has at least one eval case, and `eval` shows a higher score with the skill than without.
- [ ] It names one owner.
