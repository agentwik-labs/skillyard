// Lift evals: run the same task with and without a skill installed, grade both with deterministic checks,
// and report the difference. A skill that doesn't move the score is context you pay for on every task.
//
// evals/evals.json inside a skill:
// { "cases": [ { "name": "...", "prompt": "...", "files": {"Dockerfile": "..."},
//                "checks": [ {"type": "regex", "value": "USER\\s+\\w+", "flags": "i", "label": "sets a non-root user"} ] } ] }
// check types: contains, not_contains, regex, not_regex (case-insensitive by default), max_chars.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { installBundle } from './agents.js';
import { readSkillDir, validateFiles, checksum } from './skill.js';

const RUNNERS = {
  claude: (prompt, model) => ['claude', ['-p', prompt, '--output-format', 'text', '--allowedTools', 'Read', 'Glob', 'Grep', 'Skill', ...(model ? ['--model', model] : [])]],
  codex: (prompt, model) => ['codex', ['exec', '--skip-git-repo-check', '--sandbox', 'read-only', ...(model ? ['-m', model] : []), prompt]],
};

export function loadEvals(skillDir) {
  const p = path.join(skillDir, 'evals', 'evals.json');
  if (!fs.existsSync(p)) throw new Error(`${p} not found (see src/eval.js for the format)`);
  const spec = JSON.parse(fs.readFileSync(p, 'utf8'));
  if (!Array.isArray(spec.cases) || !spec.cases.length) throw new Error(`${p} has no cases`);
  return spec.cases;
}

export function grade(output, checks) {
  return checks.map((c) => {
    const flags = c.flags ?? 'i';
    let pass;
    if (c.type === 'contains') pass = output.toLowerCase().includes(String(c.value).toLowerCase());
    else if (c.type === 'not_contains') pass = !output.toLowerCase().includes(String(c.value).toLowerCase());
    else if (c.type === 'regex') pass = new RegExp(c.value, flags).test(output);
    else if (c.type === 'not_regex') pass = !new RegExp(c.value, flags).test(output);
    else if (c.type === 'max_chars') pass = output.length <= Number(c.value);
    else throw new Error(`unknown check type ${c.type}`);
    return { label: c.label || `${c.type} ${c.value}`, pass };
  });
}

function run(cmd, args, cwd, timeoutMs) {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { cwd, stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, CLAUDE_CODE_ENTRYPOINT: 'skillyard-eval' } });
    let out = '';
    let err = '';
    const timer = setTimeout(() => child.kill('SIGTERM'), timeoutMs);
    child.stdout.on('data', (d) => { out += d; });
    child.stderr.on('data', (d) => { err += d; });
    child.on('error', (e) => { clearTimeout(timer); resolve({ out: '', err: e.message, code: -1 }); });
    child.on('close', (code) => { clearTimeout(timer); resolve({ out, err, code }); });
  });
}

/** Run every case with and without the skill. Returns { skill, agent, model, cases: [...], baseline, withSkill, lift }. */
export async function evalSkill(skillDir, { agent = 'claude', model, runs = 1, timeoutMs = 240000, log = () => {} } = {}) {
  if (!RUNNERS[agent]) throw new Error(`eval supports agents: ${Object.keys(RUNNERS).join(', ')}`);
  const files = readSkillDir(skillDir);
  const v = validateFiles(files);
  if (!v.ok) throw new Error(`invalid skill: ${v.errors.join('; ')}`);
  const cases = loadEvals(skillDir);
  // The agent must not see the evals (answer key) when the skill is installed.
  const shipped = Object.fromEntries(Object.entries(files).filter(([k]) => !k.startsWith('evals/')));
  const bundle = {
    id: `@local/${v.manifest.name}`, name: v.manifest.name, version: v.manifest.version, checksum: checksum(shipped),
    files: Object.fromEntries(Object.entries(shipped).map(([k, b]) => [k, b.toString('base64')])),
  };
  const results = [];
  for (const c of cases) {
    for (const condition of ['without', 'with']) {
      for (let r = 0; r < runs; r++) {
        const cwd = fs.mkdtempSync(path.join(os.tmpdir(), `skillyard-eval-${v.manifest.name}-`));
        for (const [rel, content] of Object.entries(c.files || {})) {
          fs.mkdirSync(path.dirname(path.join(cwd, rel)), { recursive: true });
          fs.writeFileSync(path.join(cwd, rel), content);
        }
        if (condition === 'with') installBundle(agent === 'codex' ? 'codex' : 'claude', bundle, { cwd });
        const [cmd, args] = RUNNERS[agent](c.prompt, model);
        const started = Date.now();
        const res = await run(cmd, args, cwd, timeoutMs);
        const checks = grade(res.out, c.checks);
        const score = checks.filter((x) => x.pass).length / checks.length;
        results.push({ case: c.name, condition, run: r, score, checks, seconds: Math.round((Date.now() - started) / 1000), exit: res.code, output: res.out.slice(0, 4000) });
        log(`${v.manifest.name} · ${c.name} · ${condition} skill · ${Math.round(score * 100)}% (${checks.filter((x) => x.pass).length}/${checks.length})`);
        fs.rmSync(cwd, { recursive: true, force: true });
      }
    }
  }
  const avg = (cond) => {
    const xs = results.filter((x) => x.condition === cond).map((x) => x.score);
    return xs.reduce((a, b) => a + b, 0) / xs.length;
  };
  const baseline = avg('without');
  const withSkill = avg('with');
  return { skill: v.manifest.name, agent, model: model || 'default', runs, cases: results, baseline, withSkill, lift: withSkill - baseline };
}

export function evalMarkdown(reports) {
  const pct = (x) => `${Math.round(x * 100)}%`;
  const lines = [
    '| Skill | Agent / model | Without skill | With skill | Lift |',
    '|---|---|---|---|---|',
    ...reports.map((r) => `| ${r.skill} | ${r.agent} / ${r.model} | ${pct(r.baseline)} | ${pct(r.withSkill)} | ${r.lift >= 0 ? '+' : ''}${Math.round(r.lift * 100)} pts |`),
    '',
  ];
  for (const r of reports) {
    lines.push(`<details><summary>${r.skill}: per-check results</summary>`, '');
    for (const c of r.cases) lines.push(`- **${c.case}** (${c.condition} skill): ${c.checks.map((x) => `${x.pass ? 'pass' : 'FAIL'} ${x.label}`).join('; ')}`);
    lines.push('', '</details>', '');
  }
  return lines.join('\n');
}
