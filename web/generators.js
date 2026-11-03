// Skill generators: typed templates for the kinds of knowledge businesses keep (procedures, checklists, voice,
// playbooks, decision rules, metric recipes). One source of truth for the web builder, the CLI and Studio.
// Fields: { key, label, help, kind: 'text' | 'textarea' | 'list', example, required }
// List fields take one item per line. Templates use {{key}}, {{key|bullets}}, {{key|numbered}}, {{key|pairs}}
// ("left — right" lines become "- **left**: right"), and {{#key}}…{{/key}} to drop a block when the field is empty.

const common = [
  { key: 'name', label: 'Skill name', help: 'lowercase-with-hyphens, what the agent will call it', kind: 'text', required: true },
  { key: 'triggers', label: 'When should the agent use it?', help: 'Phrases people actually type, one per line', kind: 'list', required: true },
];
const tests = [
  { key: 'example_request', label: 'A real request it should handle', help: 'Copy one from a teammate or a ticket. Used to test the skill.', kind: 'textarea' },
  { key: 'must_include', label: 'A good answer must…', help: 'One check per line, e.g. "names the approver", "uses the escalation template"', kind: 'list' },
];

export const GENERATORS = [
  {
    id: 'procedure',
    category: 'operations',
    title: 'Procedure or runbook',
    summary: 'Step-by-step work that must be done the same way every time: deploys, month-end close, onboarding a customer, handling a refund.',
    fields: [...common,
      { key: 'job', label: 'What job does this cover?', kind: 'textarea', required: true, example: 'Closing the books at month end for our two entities.' },
      { key: 'before', label: 'Before you start', help: 'Access, inputs, checks', kind: 'list' },
      { key: 'steps', label: 'Steps, in order', help: 'One per line. Name real systems, commands and people.', kind: 'list', required: true },
      { key: 'rules', label: 'Rules and why', help: 'One per line: "rule — reason"', kind: 'list' },
      { key: 'escalate', label: 'When to stop and escalate', kind: 'textarea' },
      { key: 'output', label: 'What the agent should produce', kind: 'textarea', required: true },
      ...tests],
    description: '{{job}} Use when someone says {{triggers|quoted}}.',
    body: `# {{title}}

{{job}}

{{#before}}## Before you start

{{before|bullets}}

{{/before}}## Steps

{{steps|numbered}}

{{#rules}}## Rules

{{rules|pairs}}

{{/rules}}{{#escalate}}## Stop and escalate when

{{escalate}}

{{/escalate}}## Output

{{output}}
`,
  },
  {
    id: 'checklist',
    category: 'operations',
    title: 'Review checklist',
    summary: 'A quality gate an agent applies before something ships: contract review flags, PR review, campaign QA, invoice checks.',
    fields: [...common,
      { key: 'reviews', label: 'What does it review?', kind: 'textarea', required: true, example: 'Outbound sales emails before they are sent.' },
      { key: 'blockers', label: 'Must fix before it ships', help: 'One check per line', kind: 'list', required: true },
      { key: 'warnings', label: 'Should fix', kind: 'list' },
      { key: 'skip', label: 'Do not flag', help: 'Things reviewers waste time on', kind: 'list' },
      { key: 'output', label: 'Report format', kind: 'textarea', example: 'A ranked list: blocker or should-fix, where, why, the exact fix.' },
      ...tests],
    description: 'Checks {{reviews|lower}} Reports what must change, most important first. Use when someone says {{triggers|quoted}}.',
    body: `# {{title}}

Review {{reviews|lower}} Report only what the checklist covers, most important first.

## Blockers (must fix)

{{blockers|bullets}}

{{#warnings}}## Should fix

{{warnings|bullets}}

{{/warnings}}{{#skip}}## Do not flag

{{skip|bullets}}

{{/skip}}## Output

{{output}}
`,
  },
  {
    id: 'voice',
    category: 'marketing',
    title: 'Brand or writing voice',
    summary: 'How your company sounds in docs, sales emails, support replies and posts: tone, words to use and avoid, examples.',
    fields: [...common,
      { key: 'company', label: 'Company or team', kind: 'text', required: true },
      { key: 'audience', label: 'Who reads it?', kind: 'textarea', required: true },
      { key: 'tone', label: 'Tone in a few words', kind: 'text', example: 'Plain, warm, specific. Never hype.' },
      { key: 'do', label: 'Always', kind: 'list' },
      { key: 'avoid', label: 'Never say', help: 'Banned words and phrases, one per line', kind: 'list' },
      { key: 'glossary', label: 'Our words', help: '"term — how we use it"', kind: 'list' },
      { key: 'good', label: 'A paragraph that sounds right', kind: 'textarea' },
      ...tests],
    description: 'Writes and edits {{company}} copy in its voice for {{audience|lower}} Use when someone says {{triggers|quoted}}.',
    body: `# {{company}} voice

Write for {{audience|lower}} Tone: {{tone}}

{{#do}}## Always

{{do|bullets}}

{{/do}}{{#avoid}}## Never say

{{avoid|bullets}}

{{/avoid}}{{#glossary}}## Our words

{{glossary|pairs}}

{{/glossary}}{{#good}}## Sounds right

> {{good}}

{{/good}}## Output

The finished text, then a one-line note listing any banned phrase you removed.
`,
  },
  {
    id: 'playbook',
    category: 'sales',
    title: 'Sales or customer playbook',
    summary: 'A repeatable play for a situation: renewal at risk, discovery call, upsell, onboarding kickoff, escalation from a big customer.',
    fields: [...common,
      { key: 'situation', label: 'The situation', kind: 'textarea', required: true, example: 'A customer on an annual plan has had usage drop 40% in the 60 days before renewal.' },
      { key: 'goal', label: 'What a win looks like', kind: 'textarea', required: true },
      { key: 'steps', label: 'The play, step by step', kind: 'list', required: true },
      { key: 'objections', label: 'Objections and answers', help: '"objection — what we say"', kind: 'list' },
      { key: 'templates', label: 'Email or talk track', kind: 'textarea' },
      { key: 'measure', label: 'How we measure it', kind: 'list' },
      ...tests],
    description: 'Runs the playbook for this situation: {{situation|lower}} Use when someone says {{triggers|quoted}}.',
    body: `# {{title}}

**Situation.** {{situation}}

**Win.** {{goal}}

## The play

{{steps|numbered}}

{{#objections}}## Objections

{{objections|pairs}}

{{/objections}}{{#templates}}## Template

{{templates}}

{{/templates}}{{#measure}}## Measure

{{measure|bullets}}

{{/measure}}## Output

The next action with its owner and date, the message to send (from the template), and the risks to watch.
`,
  },
  {
    id: 'decision',
    category: 'operations',
    title: 'Policy or decision rules',
    summary: 'Who can approve what, and when: refunds, discounts, access to customer data, travel, vendor spend.',
    fields: [...common,
      { key: 'decision', label: 'What decision is this?', kind: 'textarea', required: true, example: 'Whether to approve a discount on a new deal.' },
      { key: 'inputs', label: 'What to look at first', kind: 'list' },
      { key: 'rules', label: 'Rules', help: '"if … — then …", one per line', kind: 'list', required: true },
      { key: 'approvers', label: 'Approvers and limits', help: '"who — up to what"', kind: 'list' },
      { key: 'never', label: 'Never allowed', kind: 'list' },
      ...tests],
    description: 'Decides {{decision|lower}} Use when someone says {{triggers|quoted}}.',
    body: `# {{title}}

Decide {{decision|lower}} Check every rule. When several apply, the strictest outcome and the most senior approver win. When none apply, say so and ask.

{{#inputs}}## Look at first

{{inputs|bullets}}

{{/inputs}}## Rules

{{rules|pairs}}

{{#approvers}}## Approvers

{{approvers|pairs}}

{{/approvers}}{{#never}}## Never

{{never|bullets}}

{{/never}}## Output

The decision (approve, deny or escalate), the rule that decided it, and who has to sign off.
`,
  },
  {
    id: 'metric',
    category: 'finance',
    title: 'Metric or report recipe',
    summary: 'How your numbers are defined and reported, so every agent computes MRR, churn or pipeline coverage the same way.',
    fields: [...common,
      { key: 'report', label: 'Which report or metrics?', kind: 'textarea', required: true, example: 'The weekly revenue report for the leadership meeting.' },
      { key: 'definitions', label: 'Definitions', help: '"metric — exact formula"', kind: 'list', required: true },
      { key: 'sources', label: 'Where the data lives', kind: 'list' },
      { key: 'checks', label: 'Sanity checks', help: 'What must be true before you trust the numbers', kind: 'list' },
      { key: 'output', label: 'Report layout', kind: 'textarea', example: 'A table: metric, this week, last week, plan, change; then three sentences on what moved and why.' },
      ...tests],
    description: 'Computes and reports {{report|lower}} Uses the team\'s exact metric definitions. Use when someone says {{triggers|quoted}}.',
    body: `# {{title}}

Produce {{report|lower}} Use these definitions exactly; never substitute a similar metric.

## Definitions

{{definitions|pairs}}

{{#sources}}## Data

{{sources|bullets}}

{{/sources}}{{#checks}}## Check before reporting

{{checks|bullets}}

{{/checks}}## Output

{{output}}
`,
  },
];

const lines = (v) => (Array.isArray(v) ? v : String(v || '').split('\n')).map((x) => String(x).trim().replace(/^[-*•\d.)\s]+/, '')).filter(Boolean);
const titleOf = (name) => String(name || 'new-skill').split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
const oneLine = (s) => String(s || '').replace(/\s+/g, ' ').trim();

function fmt(value, filter) {
  if (filter === 'bullets') return lines(value).map((x) => `- ${x}`).join('\n');
  if (filter === 'numbered') return lines(value).map((x, i) => `${i + 1}. ${x}`).join('\n');
  if (filter === 'pairs') return lines(value).map((x) => { const [a, ...b] = x.split(/\s+[—–-]{1,2}\s+|:\s+/); return b.length ? `- **${a.trim()}**: ${b.join(' - ').trim()}` : `- ${x}`; }).join('\n');
  if (filter === 'quoted') { const l = lines(value).map((x) => `"${x.replace(/"/g, "'")}"`); return l.length > 1 ? `${l.slice(0, -1).join(', ')} or ${l[l.length - 1]}` : l[0] || ''; }
  if (filter === 'lower') { const t = oneLine(value); return t ? t.charAt(0).toLowerCase() + t.slice(1).replace(/[.]?$/, '.') : ''; }
  return Array.isArray(value) ? value.join('\n') : String(value ?? '').trim();
}

function render(tpl, values) {
  let out = tpl.replace(/\{\{#(\w+)\}\}([\s\S]*?)\{\{\/\1\}\}/g, (_, k, inner) => (lines(values[k]).length ? inner : ''));
  out = out.replace(/\{\{(\w+)(?:\|(\w+))?\}\}/g, (_, k, f) => fmt(values[k], f));
  return out.replace(/\n{3,}/g, '\n\n');
}

/** Build a skill from a generator and answers: { name, files: { 'SKILL.md', 'skill.json', 'evals/evals.json'? }, missing } */
export function generate(genId, answers, { license = 'Proprietary', author = '' } = {}) {
  const g = GENERATORS.find((x) => x.id === genId);
  if (!g) throw new Error(`unknown generator ${genId}`);
  const name = String(answers.name || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 64) || 'new-skill';
  const values = { ...answers, name, title: answers.title || titleOf(name) };
  const missing = g.fields.filter((f) => f.required && !lines(answers[f.key]).length).map((f) => f.label);
  const description = oneLine(render(g.description, values)).replace(/"/g, "'").slice(0, 1000);
  const skillMd = `---\nname: ${name}\ndescription: ${description.includes(': ') ? `"${description}"` : description}\nlicense: ${license}\n---\n\n${render(g.body, values).trim()}\n`;
  const files = {
    'SKILL.md': skillMd,
    'skill.json': `${JSON.stringify({ name, version: '0.1.0', title: values.title, summary: oneLine(answers.job || answers.reviews || answers.situation || answers.decision || answers.report || answers.audience || '').slice(0, 140), category: g.category || 'operations', tags: [g.id], license, author, generator: g.id }, null, 2)}\n`,
  };
  const checks = lines(answers.must_include);
  if (oneLine(answers.example_request) && checks.length) {
    files['evals/evals.json'] = `${JSON.stringify({ cases: [{ name: 'from-builder', prompt: `${oneLine(answers.example_request)} Answer directly, don't ask me questions.`, checks: checks.map((c) => ({ type: 'judge', value: c })) }] }, null, 2)}\n`;
  }
  return { name, files, missing };
}
