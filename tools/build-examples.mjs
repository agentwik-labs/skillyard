// Builds web/examples.json for the good-vs-bad gallery: runs the real validator and scanner on every example and
// attaches measured eval results, so the page shows what the tools actually say, not what we wish they said.
import fs from 'node:fs';
import path from 'node:path';
import { readSkillDir, validateFiles } from '../src/skill.js';
import { scanFiles } from '../src/scan.js';

const root = path.join(import.meta.dirname, '..');
const exDir = path.join(root, 'examples');
const { lessons } = JSON.parse(fs.readFileSync(path.join(exDir, 'catalog.json'), 'utf8'));
const load = (f) => JSON.parse(fs.readFileSync(path.join(root, 'reports', f), 'utf8'));
const badEvals = load('2026-10-bad-skill-evals.json');
const goodEvals = load('2026-10-lift-evals.json');
// The description test turns off file search so the agent can only load skills the normal way: by description.
const descEvals = load('2026-10-description-evals.json');

function inspect(rel, highlight, file) {
  const dir = path.join(exDir, rel);
  const files = readSkillDir(dir);
  const v = validateFiles(files);
  const s = scanFiles(files);
  const shown = file || 'SKILL.md';
  const lines = files[shown].toString('utf8').split('\n');
  const re = highlight ? new RegExp(highlight, 'i') : null;
  const marked = lines.map((text, i) => ({ n: i + 1, text, hit: !!re && re.test(text) }))
    .filter((l, i, all) => !l.text.startsWith('<!-- Teaching example') && !(l.text === '' && all[i - 1]?.text.startsWith('<!-- Teaching example')));
  return {
    path: path.relative(root, dir), name: v.manifest?.name || path.basename(dir), file: shown,
    lines: marked.slice(0, 60), truncated: marked.length > 60,
    files: Object.keys(files).filter((f) => !f.startsWith('evals/')),
    errors: v.errors, warnings: v.warnings.filter((w) => !w.startsWith('security:')),
    scan: s.findings, blocked: !v.ok || s.critical > 0,
  };
}

const pick = (list, name) => list.find((r) => r.skill === name);
const out = lessons.map((l) => {
  const bad = inspect(l.bad, l.highlight, l.file);
  const good = inspect(l.good, null, l.file && fs.existsSync(path.join(exDir, l.good, l.file)) ? l.file : null);
  let measured = null;
  if (l.id === 'vague-description') {
    const b = pick(descEvals, 'notes-v2');
    const g = pick(descEvals, 'deploy-runbook');
    measured = { model: b.model, runs: b.runs, without: (b.baseline + g.baseline) / 2, withBad: b.withSkill, withGood: g.withSkill, note: 'Same instructions; only the name and description differ. File search was off, so skills could only be found by description. The vague one was picked up in 1 of 2 runs, the clear one in 2 of 2.' };
  } else if (l.id === 'harmful-advice') {
    const b = pick(badEvals, 'quick-commits');
    const g = pick(goodEvals, 'commit-messages');
    measured = { model: b.model, runs: b.runs, without: b.baseline, withBad: b.withSkill, withGood: g.withSkill, note: 'The bad skill blocked the Conventional Commits format and the breaking-change marker the task needed.' };
  }
  return { ...l, bad, good, measured };
});
fs.writeFileSync(path.join(root, 'web', 'examples.json'), `${JSON.stringify({ builtAt: new Date().toISOString(), lessons: out }, null, 1)}\n`);
console.log(`wrote web/examples.json with ${out.length} lessons (${out.filter((l) => l.measured).length} measured)`);
