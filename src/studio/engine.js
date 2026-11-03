// Studio engine: consent, capture, review (themes -> drafted skills -> proof) and approved changes.
// Three gates, each recorded: reading logs, sending redacted excerpts to a model, and changing any skill.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { captureAll, SOURCES, TYPE_LABELS } from './capture.js';
import { askJson } from './llm.js';
import { evalSkill } from '../eval.js';
import { AGENTS, installBundle, MARKER } from '../agents.js';
import { checksum, parseFrontmatter, readSkillDir, validateFiles } from '../skill.js';
import { scanFiles } from '../scan.js';

const HOME = os.homedir();
// Demo mode: a fictional team's corrections, its own folder, and a sandbox "home" for installs, so nothing of the
// real user is read, sent or changed.
export const DEMO = process.env.SKILLYARD_STUDIO_DEMO === '1';
export const STUDIO_DIR = process.env.SKILLYARD_STUDIO_DIR || path.join(HOME, '.skillyard', DEMO ? 'studio-demo' : 'studio');
const SANDBOX = path.join(STUDIO_DIR, 'sandbox-home');
const INSTALL = DEMO ? { global: false, cwd: SANDBOX } : { global: true, cwd: HOME };
const STATE = path.join(STUDIO_DIR, 'state.json');
const CACHE = path.join(STUDIO_DIR, 'capture-cache.json');
const SKILLS = path.join(STUDIO_DIR, 'skills');
const BACKUPS = path.join(STUDIO_DIR, 'backups');

const DEFAULT_STATE = () => ({
  version: 1,
  consent: {
    readLogs: { granted: false, sources: ['claude', 'codex'], excludeProjects: [], reviewExclude: [] },
    modelReview: { granted: false, model: 'haiku' },
    autoReview: { schedule: 'off' },
    notify: { webhook: '' },
  },
  log: [],
  themes: [],
  proposals: [],
  lastScan: null,
  lastReview: null,
});

export function loadState() {
  fs.mkdirSync(STUDIO_DIR, { recursive: true, mode: 0o700 });
  try { return { ...DEFAULT_STATE(), ...JSON.parse(fs.readFileSync(STATE, 'utf8')) }; } catch { return DEFAULT_STATE(); }
}
export function saveState(s) {
  const tmp = `${STATE}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(s, null, 1), { mode: 0o600 });
  fs.renameSync(tmp, STATE);
}
function record(s, action, detail = '') {
  s.log.unshift({ at: new Date().toISOString(), action, detail });
  s.log = s.log.slice(0, 300);
}
const loadCache = () => { try { return JSON.parse(fs.readFileSync(CACHE, 'utf8')); } catch { return {}; } };

// ---- consent -------------------------------------------------------------------

export function setConsent(patch) {
  const s = loadState();
  const c = s.consent;
  if (patch.readLogs !== undefined) {
    const was = c.readLogs.granted;
    c.readLogs = { ...c.readLogs, ...patch.readLogs, at: new Date().toISOString() };
    if (c.readLogs.granted !== was) record(s, c.readLogs.granted ? 'Allowed reading agent logs' : 'Stopped reading agent logs', c.readLogs.sources.map((x) => SOURCES[x]?.label).join(', '));
    if (!c.readLogs.granted) fs.rmSync(CACHE, { force: true }); // revoking deletes what was read
  }
  if (patch.excludeProjects) {
    c.readLogs.excludeProjects = patch.excludeProjects;
    record(s, 'Changed excluded projects', patch.excludeProjects.join(', ') || 'none');
  }
  if (patch.reviewExclude) {
    c.readLogs.reviewExclude = patch.reviewExclude;
    record(s, 'Changed projects kept out of model review', patch.reviewExclude.join(', ') || 'none');
  }
  if (patch.modelReview !== undefined) {
    const was = c.modelReview.granted;
    c.modelReview = { ...c.modelReview, ...patch.modelReview, at: new Date().toISOString() };
    if (c.modelReview.granted !== was) record(s, c.modelReview.granted ? 'Allowed model review of redacted excerpts' : 'Stopped model review', `model: ${c.modelReview.model}`);
  }
  if (patch.notify !== undefined) {
    const url = String(patch.notify.webhook || '').trim();
    if (url && !/^https:\/\/[^\s]+$/.test(url)) throw Object.assign(new Error('webhook must be an https URL'), { status: 400 });
    c.notify = { webhook: url, at: new Date().toISOString() };
    record(s, url ? 'Turned on notifications' : 'Turned off notifications', url ? new URL(url).host : '');
  }
  if (patch.autoReview !== undefined) {
    c.autoReview = { ...c.autoReview, ...patch.autoReview, at: new Date().toISOString() };
    record(s, 'Changed automatic review', c.autoReview.schedule);
  }
  saveState(s);
  return s;
}

// ---- capture and stats ---------------------------------------------------------------

let job = null; // { kind, step, done, total, startedAt, error }
export const currentJob = () => job;

export async function scan() {
  const s = loadState();
  if (DEMO) { s.lastScan = new Date().toISOString(); saveState(s); return loadCache(); }
  if (!s.consent.readLogs.granted) throw Object.assign(new Error('Reading agent logs is not allowed yet'), { status: 403 });
  const cache = await captureAll(s.consent.readLogs.sources, loadCache(), (d, t) => { if (job) Object.assign(job, { done: d, total: t }); });
  fs.writeFileSync(CACHE, JSON.stringify(cache), { mode: 0o600 });
  s.lastScan = new Date().toISOString();
  saveState(s);
  return cache;
}

function included(s) {
  const cache = loadCache();
  const ex = new Set(s.consent.readLogs.excludeProjects);
  const sessions = Object.values(cache).filter((x) => s.consent.readLogs.sources.includes(x.source));
  const allProjects = {};
  for (const x of sessions) {
    const p = (allProjects[x.project] ||= { prompts: 0, corrections: 0 });
    p.prompts += x.prompts.length;
    p.corrections += x.corrections.length;
  }
  return { sessions: sessions.filter((x) => !ex.has(x.project)), allProjects, excluded: ex };
}

const weekStart = (iso) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const day = (d.getUTCDay() + 6) % 7;
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() - day);
  return d.toISOString().slice(0, 10);
};

export function stats({ project } = {}) {
  const s = loadState();
  const inc = included(s);
  const { allProjects, excluded } = inc;
  const allSessions = inc.sessions;
  const sessions = project ? allSessions.filter((x) => x.project === project) : allSessions;
  const corrections = sessions.flatMap((x) => x.corrections).sort((a, b) => String(b.time).localeCompare(String(a.time)));
  const prompts = sessions.flatMap((x) => x.prompts).filter(Boolean);
  const weeks = {};
  for (const t of prompts) { const w = weekStart(t); if (w) (weeks[w] ||= { prompts: 0, corrections: 0 }).prompts++; }
  for (const c of corrections) { const w = weekStart(c.time); if (w) (weeks[w] ||= { prompts: 0, corrections: 0 }).corrections++; }
  // A week with very few prompts (a partial first week) gives a noisy rate; leave it out of the trend.
  const counts = Object.values(weeks).map((v) => v.prompts).sort((a, b) => a - b);
  const median = counts[Math.floor(counts.length / 2)] || 0;
  const series = Object.entries(weeks).filter(([, v]) => v.prompts >= Math.max(20, median * 0.4)).sort().slice(-12).map(([week, v]) => ({ week, ...v, rate: v.prompts ? (100 * v.corrections) / v.prompts : 0 }));
  const byType = {};
  for (const c of corrections) byType[c.type] = (byType[c.type] || 0) + 1;
  const byProject = {};
  for (const c of corrections) byProject[c.project] = (byProject[c.project] || 0) + 1;
  const pending = s.proposals.filter((p) => p.status === 'pending');
  // Per-project breakdown (always over every included project, so the table works as a filter).
  const projMap = {};
  const now = Date.now();
  for (const x of allSessions) {
    const r = (projMap[x.project] ||= { project: x.project, sessions: 0, prompts: 0, corrections: 0, types: {}, last: null, recentP: 0, recentC: 0, priorP: 0, priorC: 0, branches: new Set() });
    r.sessions++;
    r.prompts += x.prompts.length;
    r.corrections += x.corrections.length;
    if (x.branch && x.branch !== 'HEAD') r.branches.add(x.branch);
    for (const t of x.prompts) {
      if (!r.last || t > r.last) r.last = t;
      const age = (now - new Date(t).getTime()) / 864e5;
      if (age <= 28) r.recentP++; else if (age <= 56) r.priorP++;
    }
    for (const c of x.corrections) {
      r.types[c.type] = (r.types[c.type] || 0) + 1;
      const age = (now - new Date(c.time).getTime()) / 864e5;
      if (age <= 28) r.recentC++; else if (age <= 56) r.priorC++;
    }
  }
  const themeCount = (proj) => s.themes.filter((t) => t.correctionIds.some((id) => allSessions.some((x) => x.project === proj && x.corrections.some((c) => c.id === id)))).length;
  const reviewExclude = new Set(s.consent.readLogs.reviewExclude || []);
  const byRepo = Object.values(projMap).filter((r) => r.prompts > 0).map((r) => {
    const top = Object.entries(r.types).filter(([t]) => t !== 'interrupted').sort((a, b) => b[1] - a[1])[0];
    return {
      project: r.project, sessions: r.sessions, prompts: r.prompts, corrections: r.corrections,
      rate: r.prompts ? (100 * r.corrections) / r.prompts : 0,
      recentRate: r.recentP >= 10 ? (100 * r.recentC) / r.recentP : null,
      priorRate: r.priorP >= 10 ? (100 * r.priorC) / r.priorP : null,
      topType: top ? { type: top[0], label: TYPE_LABELS[top[0]], n: top[1] } : null,
      branches: r.branches.size, last: r.last, themes: themeCount(r.project), reviewExcluded: reviewExclude.has(r.project),
    };
  }).sort((a, b) => b.prompts - a.prompts);
  const approved = s.proposals.filter((p) => p.status === 'approved');
  return {
    consent: s.consent,
    lastScan: s.lastScan,
    lastReview: s.lastReview,
    totals: { sessions: sessions.length, prompts: prompts.length, corrections: corrections.length, rate: prompts.length ? (100 * corrections.length) / prompts.length : 0 },
    series,
    byType: Object.entries(byType).map(([type, n]) => ({ type, label: TYPE_LABELS[type], n })).sort((a, b) => b.n - a.n),
    byProject: Object.entries(byProject).map(([project, n]) => ({ project, n })).sort((a, b) => b.n - a.n),
    projects: Object.entries(allProjects).map(([project, v]) => ({ project, ...v, excluded: excluded.has(project) })).sort((a, b) => b.prompts - a.prompts),
    corrections: corrections.slice(0, 400),
    byRepo,
    project: project || null,
    themes: s.themes,
    proposals: s.proposals,
    pipeline: {
      corrections: corrections.length,
      themes: s.themes.length,
      proposals: s.proposals.length,
      pending: pending.length,
      approved: approved.length,
      avgLift: approved.length ? approved.reduce((a, p) => a + (p.eval?.lift || 0), 0) / approved.length : null,
    },
    log: s.log.slice(0, 60),
    demo: DEMO,
    job,
    agents: Object.entries(AGENTS).filter(([, a]) => !a.projectOnly).map(([id, a]) => ({ id, label: a.label })),
  };
}

// ---- what the model would see ------------------------------------------------------

function reviewInput(s, limit = 120) {
  const { sessions } = included(s);
  const keepOut = new Set(s.consent.readLogs.reviewExclude || []);
  return sessions.filter((x) => !keepOut.has(x.project)).flatMap((x) => x.corrections)
    .filter((c) => c.type !== 'interrupted' || c.said.length > 60)
    .sort((a, b) => String(b.time).localeCompare(String(a.time)))
    .slice(0, limit);
}

export function preview() {
  const s = loadState();
  const items = reviewInput(s);
  return {
    model: s.consent.modelReview.model,
    count: items.length,
    sample: items.slice(0, 12).map((c) => ({ id: c.id, type: c.type, project: c.project, asked: c.asked.slice(0, 240), said: c.said.slice(0, 240) })),
    note: 'Only these fields are sent, after redaction: what was asked (240 characters), what was said back (240), the correction type and the project name. No code, files or tool output.',
  };
}

// ---- installed skills ---------------------------------------------------------------

export function installedSkills() {
  const roots = [['claude', AGENTS.claude.root(INSTALL)], ['codex', AGENTS.codex.root(INSTALL)], ['studio', SKILLS]];
  const out = [];
  for (const [where, root] of roots) {
    let ents = [];
    try { ents = fs.readdirSync(root, { withFileTypes: true }); } catch { continue; }
    for (const e of ents) {
      const dir = path.join(root, e.name);
      const md = path.join(dir, 'SKILL.md');
      if (!e.isDirectory() || !fs.existsSync(md)) continue;
      const { data } = parseFrontmatter(fs.readFileSync(md, 'utf8'));
      let marker = null;
      try { marker = JSON.parse(fs.readFileSync(path.join(dir, MARKER), 'utf8')); } catch { /* not ours */ }
      out.push({ name: data?.name || e.name, description: data?.description || '', where, dir, managed: !!marker });
    }
  }
  return out;
}

// ---- review ---------------------------------------------------------------------

const THEME_PROMPT = (items, skills, rejected) => `You review moments where a developer corrected their AI coding agent. Group them into themes that a written skill (instructions the agent loads for a kind of task) could prevent.

Rules:
- Only themes that recur (2+ corrections) or that are risky (one is enough for risky actions).
- Prefer specific, actionable themes ("publishes or posts before the user approves", "adds extra pages nobody asked for") over generic ones ("be careful").
- If the corrections happened while an existing skill was loaded and that skill should change, target it: kind "improve" with its exact name.
- Otherwise kind "new", with a short lowercase-hyphenated skill name.
- Never propose these again (the user rejected them): ${rejected.length ? rejected.join('; ') : 'none'}.
- At most 6 themes, most frequent first.

Installed skills (name: description):
${skills.map((k) => `- ${k.name}: ${k.description.slice(0, 160)}`).join('\n') || '- none'}

Corrections (id | type | project | skills loaded | what was asked -> what the developer said):
${items.map((c) => `${c.id} | ${c.type} | ${c.project} | ${c.skills.join(',') || '-'} | ${c.asked.slice(0, 240).replace(/\n/g, ' ')} -> ${c.said.slice(0, 240).replace(/\n/g, ' ')}`).join('\n')}

Return {"themes":[{"title":"short sentence naming the failure","problem":"one or two sentences in plain words","correction_ids":["..."],"kind":"new"|"improve","skill":"skill-name","why_skill":"why written instructions would prevent it"}]}`;

const DRAFT_PROMPT = (theme, evidence, current) => `Write an Agent Skill that prevents this recurring failure of an AI coding agent.

Failure: ${theme.title}
${theme.problem}

Real corrections from the developer (what they asked -> what they said back):
${evidence.map((c) => `- ${c.asked.slice(0, 300).replace(/\n/g, ' ')} -> ${c.said.slice(0, 300).replace(/\n/g, ' ')}`).join('\n')}

${current ? `This improves an existing skill. Keep everything in it that is still right, change or add only what the corrections show is missing, and keep its name. Current SKILL.md:\n<<<\n${current.slice(0, 8000)}\n>>>\n` : ''}
Requirements for the skill:
- SKILL.md with YAML frontmatter: name (${theme.skill}), description (what it does AND when to use it, with phrases a user would type), license: MIT.
- Body under 80 lines: purpose, a numbered workflow, rules with the reason for each, a short example, an Output section. Specific to these corrections, not generic advice.
- Nothing that hides actions from the user, bypasses permissions or tells the agent to ignore other instructions.

Also write 2 evaluation cases. Each prompt is one of the developer's real requests above, lightly generalised (no personal data), that an agent can answer in text without tools, ending with "Answer directly, don't ask me questions."
The prompt must NOT state the convention or rule the skill teaches (if the skill says "use pnpm", the prompt must not mention pnpm or npm): the test is whether the agent does the right thing without being told, exactly like the original request.
Give 2-3 pass/fail criteria a strict grader can check from the answer alone, each taken from what the developer said back.

Return {"skill_md":"full SKILL.md text","summary":"one sentence: what changes for the developer","evals":[{"name":"short-name","prompt":"...","criteria":["...","..."]}]}`;

const LOCK = path.join(STUDIO_DIR, 'review.lock');
function takeLock() {
  try {
    const held = JSON.parse(fs.readFileSync(LOCK, 'utf8'));
    let alive = false;
    try { process.kill(held.pid, 0); alive = true; } catch { /* gone */ }
    if (alive && Date.now() - held.at < 3600e3) throw Object.assign(new Error('A review is already running'), { status: 409 });
  } catch (e) { if (e.status) throw e; }
  fs.writeFileSync(LOCK, JSON.stringify({ pid: process.pid, at: Date.now() }));
}

export async function review(opts = {}) {
  opts = { runs: 2, ...opts };
  takeLock();
  try { return await reviewInner(opts); } finally { fs.rmSync(LOCK, { force: true }); }
}

async function reviewInner({ maxProposals = 3, runs = 1, fresh = false, onStep = () => {} } = {}) {
  let s = loadState();
  if (fresh) { s.proposals = s.proposals.filter((p) => p.status !== 'pending'); saveState(s); }
  if (!s.consent.readLogs.granted) throw Object.assign(new Error('Reading agent logs is not allowed yet'), { status: 403 });
  if (!s.consent.modelReview.granted) throw Object.assign(new Error('Model review is not allowed yet'), { status: 403 });
  const model = s.consent.modelReview.model;
  onStep('Reading new sessions');
  await scan();
  s = loadState();
  const items = reviewInput(s);
  if (items.length < 3) throw new Error('Not enough corrections to review yet');
  const skills = installedSkills();
  const rejected = s.proposals.filter((p) => p.status === 'rejected').map((p) => p.title);
  record(s, 'Started a review', `${items.length} redacted corrections sent to ${model}`);
  saveState(s);

  onStep(`Grouping ${items.length} corrections into themes`);
  const { themes = [] } = await askJson(THEME_PROMPT(items, skills, rejected), { model });
  const byId = Object.fromEntries(items.map((c) => [c.id, c]));
  const cleanThemes = themes.map((t) => ({
    id: crypto.createHash('sha1').update(t.title).digest('hex').slice(0, 8),
    title: String(t.title || '').slice(0, 140),
    problem: String(t.problem || '').slice(0, 400),
    whySkill: String(t.why_skill || '').slice(0, 300),
    kind: t.kind === 'improve' && skills.some((k) => k.name === t.skill) ? 'improve' : 'new',
    skill: String(t.skill || 'team-rule').toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-|-$/g, '').slice(0, 64) || 'team-rule',
    correctionIds: (t.correction_ids || []).filter((id) => byId[id]),
  })).filter((t) => t.correctionIds.length);
  s = loadState();
  s.themes = cleanThemes;
  saveState(s);

  const todo = cleanThemes
    // One open proposal per skill: a theme worded differently in a later review is still the same fix.
    .filter((t) => !s.proposals.some((p) => (p.themeId === t.id || p.skill === t.skill) && p.status !== 'rejected'))
    .filter((t, i, all) => all.findIndex((x) => x.skill === t.skill) === i)
    .slice(0, maxProposals);
  let n = 0;
  for (const theme of todo) {
    n++;
    const evidence = theme.correctionIds.map((id) => byId[id]).slice(0, 8);
    const target = theme.kind === 'improve' ? skills.find((k) => k.name === theme.skill) : null;
    const current = target ? fs.readFileSync(path.join(target.dir, 'SKILL.md'), 'utf8') : null;
    onStep(`Drafting ${n} of ${todo.length}: ${theme.skill}`);
    let draft;
    try { draft = await askJson(DRAFT_PROMPT(theme, evidence, current), { model }); } catch (e) {
      if (e.agentFailure) throw e; // account or availability problem: stop, don't draft on garbage
      onStep(`Skipped ${theme.skill}: ${e.message}`);
      continue;
    }
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'skillyard-draft-'));
    const files = { ...(target ? readSkillDir(target.dir) : {}), 'SKILL.md': Buffer.from(String(draft.skill_md || '').trim() + '\n') };
    delete files[MARKER];
    for (const [rel, buf] of Object.entries(files)) {
      fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
      fs.writeFileSync(path.join(dir, rel), buf);
    }
    const v = validateFiles(files);
    const sc = scanFiles(files);
    const cases = (draft.evals || []).slice(0, 2).map((c, i) => ({
      name: String(c.name || `case-${i + 1}`).slice(0, 40),
      // Tests run with no repository and no file or shell tools, so ask for the plan as text; otherwise the agent
      // tries to act, finds nothing, and both sides score on refusals.
      prompt: c.prompt ? `${String(c.prompt).trim()}\n\nThere is no repository in this folder and you have no file or shell tools. Reply with exactly what you would do: the commands you would run, the edits you would make, or your review, as text.` : '',
      checks: (c.criteria || []).slice(0, 3).map((x) => ({ type: 'judge', value: String(x) })),
    })).filter((c) => c.prompt && c.checks.length);
    let result = null;
    if (v.ok && !sc.critical && cases.length) {
      onStep(`Testing ${n} of ${todo.length}: ${theme.skill} (${cases.length * 2 * runs} runs)`);
      try {
        result = await evalSkill(dir, { model, runs, cases, baselineDir: target?.dir, tools: ['Skill'] });
      } catch (e) {
        if (e.agentFailure) throw e;
        onStep(`Test failed for ${theme.skill}: ${e.message}`);
      }
    }
    s = loadState();
    s.proposals.unshift({
      id: crypto.randomBytes(5).toString('hex'),
      themeId: theme.id,
      title: theme.title,
      problem: theme.problem,
      summary: String(draft.summary || '').slice(0, 300),
      kind: theme.kind,
      skill: v.manifest?.name || theme.skill,
      target: target ? { where: target.where, dir: target.dir, managed: target.managed } : null,
      evidence: evidence.map((c) => ({ id: c.id, type: c.type, project: c.project, time: c.time, asked: c.asked.slice(0, 300), said: c.said.slice(0, 300) })),
      before: current,
      after: files['SKILL.md'].toString('utf8'),
      checks: { valid: v.ok, errors: v.errors, warnings: v.warnings, scan: sc.findings, blocked: !v.ok || sc.critical > 0 },
      eval: result ? {
        model: result.model, judge: process.env.SKILLYARD_JUDGE_MODEL || 'sonnet', runs, baselineLabel: target ? 'Current skill' : 'No skill',
        baseline: result.baseline, candidate: result.withSkill, lift: result.lift,
        cases: cases.map((c) => ({
          name: c.name, prompt: c.prompt,
          before: result.cases.filter((r) => r.case === c.name && r.condition === 'without' && !r.error).map((r) => ({ score: r.score, checks: r.checks, output: r.output.slice(0, 1500) })),
          after: result.cases.filter((r) => r.case === c.name && r.condition === 'with' && !r.error).map((r) => ({ score: r.score, checks: r.checks, output: r.output.slice(0, 1500) })),
        })),
      } : null,
      draftDir: dir,
      status: 'pending',
      createdAt: new Date().toISOString(),
    });
    record(s, 'Proposed a skill change', `${theme.kind === 'improve' ? 'Improve' : 'New'} ${v.manifest?.name || theme.skill}`);
    saveState(s);
  }
  s = loadState();
  s.lastReview = new Date().toISOString();
  record(s, 'Finished a review', `${cleanThemes.length} themes, ${n} proposals`);
  saveState(s);
  const newOnes = s.proposals.filter((p) => p.status === 'pending' && p.createdAt >= s.log.find((l) => l.action === 'Started a review')?.at);
  if (newOnes.length) await notify(newOnes).catch((e) => onStep(`Notification failed: ${e.message}`));
}

/** Post new proposals to the user's webhook (Slack-compatible {text}). Titles and scores only, never excerpts. */
export async function notify(proposals, { test = false } = {}) {
  const s = loadState();
  const url = s.consent.notify?.webhook;
  if (!url) return false;
  const pts = (x) => `${x > 0 ? '+' : ''}${Math.round(x * 100)} pts`;
  const lines = test
    ? ['Skillyard Studio is connected. New skill proposals will be posted here.']
    : [`Skillyard Studio has ${proposals.length} new skill proposal${proposals.length === 1 ? '' : 's'} waiting for review:`,
      ...proposals.map((p) => `• ${p.kind === 'improve' ? 'Improve' : 'New'} ${p.skill}: ${p.title}${p.eval ? ` (${pts(p.eval.lift)} in tests)` : ''}`)];
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: lines.join('\n') }) });
  if (!res.ok) throw new Error(`webhook answered ${res.status}`);
  return true;
}

export function startJob(kind, fn) {
  if (job && !job.finishedAt) throw Object.assign(new Error('A review is already running'), { status: 409 });
  job = { kind, step: 'Starting', log: [], startedAt: new Date().toISOString() };
  const step = (t) => { job.step = t; job.log.push({ at: new Date().toISOString(), t }); };
  fn(step).then(() => { job.finishedAt = new Date().toISOString(); step('Done'); })
    .catch((e) => { job.finishedAt = new Date().toISOString(); job.error = e.message; step(`Stopped: ${e.message}`); });
  return job;
}

// ---- decisions ----------------------------------------------------------------------

export function decide(id, action, opts = {}) {
  const s = loadState();
  const p = s.proposals.find((x) => x.id === id);
  if (!p) throw Object.assign(new Error('proposal not found'), { status: 404 });
  if (action === 'reject') {
    p.status = 'rejected';
    p.decidedAt = new Date().toISOString();
    p.reason = String(opts.reason || '').slice(0, 300);
    record(s, 'Rejected a proposal', `${p.skill}${p.reason ? `: ${p.reason}` : ''}`);
  } else if (action === 'approve') {
    if (p.status !== 'pending') throw Object.assign(new Error(`proposal is ${p.status}`), { status: 409 });
    if (p.checks.blocked) throw Object.assign(new Error('this draft failed the format check or security scan'), { status: 422 });
    const agents = (opts.agents || []).filter((a) => AGENTS[a] && !AGENTS[a].projectOnly);
    if (!agents.length) throw Object.assign(new Error('choose at least one agent'), { status: 400 });
    const text = typeof opts.skillMd === 'string' && opts.skillMd.trim() ? opts.skillMd : p.after;
    const files = { ...readSkillDir(p.draftDir), 'SKILL.md': Buffer.from(text.endsWith('\n') ? text : `${text}\n`) };
    const v = validateFiles(files);
    const sc = scanFiles(files);
    if (!v.ok || sc.critical) throw Object.assign(new Error(`edited skill failed checks: ${[...v.errors, ...sc.findings.filter((f) => f.severity === 'critical').map((f) => f.message)].join('; ')}`), { status: 422 });
    const name = v.manifest.name;
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const installed = [];
    // Keep a copy of anything we replace, so every approval can be undone.
    for (const a of agents) {
      const dest = AGENTS[a].dir(name, INSTALL);
      if (fs.existsSync(dest)) {
        const backup = path.join(BACKUPS, `${name}-${a}-${stamp}`);
        fs.mkdirSync(BACKUPS, { recursive: true });
        fs.cpSync(dest, backup, { recursive: true });
        installed.push({ agent: a, dir: dest, backup });
      } else installed.push({ agent: a, dir: dest, backup: null });
      installBundle(a, {
        id: `@studio/${name}`, name, version: new Date().toISOString().slice(0, 10), checksum: checksum(files),
        files: Object.fromEntries(Object.entries(files).map(([k, b]) => [k, b.toString('base64')])),
      }, { ...INSTALL, force: true });
    }
    fs.mkdirSync(SKILLS, { recursive: true });
    fs.rmSync(path.join(SKILLS, name), { recursive: true, force: true });
    for (const [rel, buf] of Object.entries(files)) {
      fs.mkdirSync(path.dirname(path.join(SKILLS, name, rel)), { recursive: true });
      fs.writeFileSync(path.join(SKILLS, name, rel), buf);
    }
    p.status = 'approved';
    p.decidedAt = new Date().toISOString();
    p.installed = installed;
    p.edited = text !== p.after;
    record(s, 'Approved and installed', `${name} for ${agents.map((a) => AGENTS[a].label).join(', ')}${p.edited ? ' (edited)' : ''}`);
  } else if (action === 'undo') {
    if (p.status !== 'approved') throw Object.assign(new Error('only approved proposals can be undone'), { status: 409 });
    for (const i of p.installed || []) {
      fs.rmSync(i.dir, { recursive: true, force: true });
      if (i.backup) fs.cpSync(i.backup, i.dir, { recursive: true });
    }
    p.status = 'pending';
    delete p.installed;
    record(s, 'Undid an approval', `${p.skill} restored to its previous state`);
  } else throw Object.assign(new Error('unknown action'), { status: 400 });
  saveState(s);
  return p;
}

/** Line diff (LCS) for the proposal view: [{op: ' '|'+'|'-', text}] */
export function diffLines(a, b) {
  const x = (a || '').split('\n');
  const y = (b || '').split('\n');
  const m = x.length;
  const n = y.length;
  if (m * n > 4e6) return [...x.map((t) => ({ op: '-', text: t })), ...y.map((t) => ({ op: '+', text: t }))];
  const dp = Array.from({ length: m + 1 }, () => new Uint32Array(n + 1));
  for (let i = m - 1; i >= 0; i--) for (let j = n - 1; j >= 0; j--) dp[i][j] = x[i] === y[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const out = [];
  let i = 0;
  let j = 0;
  while (i < m && j < n) {
    if (x[i] === y[j]) { out.push({ op: ' ', text: x[i] }); i++; j++; } else if (dp[i + 1][j] >= dp[i][j + 1]) out.push({ op: '-', text: x[i++] });
    else out.push({ op: '+', text: y[j++] });
  }
  while (i < m) out.push({ op: '-', text: x[i++] });
  while (j < n) out.push({ op: '+', text: y[j++] });
  return out;
}
