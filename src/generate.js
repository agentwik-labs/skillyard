// Fill a generator from a source document (an SOP, a wiki page, a playbook) with the user's own agent CLI, then
// render, validate and scan the skill. The model only sees the document; it gets no tools.
import { GENERATORS, generate } from '../web/generators.js';
import { askJson } from './studio/llm.js';
import { validateFiles } from './skill.js';
import { scanFiles } from './scan.js';

export { GENERATORS };

export async function answersFromDocument(genId, document, { model = 'sonnet', hint = '' } = {}) {
  const g = GENERATORS.find((x) => x.id === genId);
  if (!g) throw new Error(`unknown generator ${genId}`);
  const fields = g.fields.map((f) => `- ${f.key} (${f.kind === 'list' ? 'array of strings, one item each' : 'string'}${f.required ? ', required' : ''}): ${f.label}${f.help ? `. ${f.help}` : ''}`).join('\n');
  const prompt = `Turn this document into the fields of a "${g.title}" skill: instructions an AI agent will follow at work.
${hint ? `Extra context from the user: ${hint}\n` : ''}
Rules:
- Use only facts in the document. Keep real names of systems, commands, people, numbers and thresholds. Do not invent any.
- "triggers": 4-6 short phrases a colleague would type to an AI agent when they need this.
- "name": lowercase-with-hyphens, 2-4 words.
- "example_request" and "must_include": one realistic request and 2-4 checks a good answer must pass, taken from the document.
- Leave a field as "" or [] when the document says nothing about it.

Fields:
${fields}

Document:
<<<
${String(document).slice(0, 24000)}
>>>

Return a JSON object with exactly these keys.`;
  return askJson(prompt, { model, timeoutMs: 240000 });
}

/** Render + check. Returns { name, files: {rel: string}, missing, valid, errors, warnings, scan }. */
export function buildSkill(genId, answers, opts) {
  const r = generate(genId, answers, opts);
  const buf = Object.fromEntries(Object.entries(r.files).map(([k, v]) => [k, Buffer.from(v)]));
  const v = validateFiles(buf);
  const s = scanFiles(buf);
  return { ...r, valid: v.ok && !s.critical && !r.missing.length, errors: v.errors, warnings: v.warnings, scan: s.findings };
}
