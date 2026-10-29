// Where each AI agent looks for skills, and how to write a skill bundle there.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { parseFrontmatter, safeRelPath } from './skill.js';

export const MARKER = '.skillyard-install.json';

/**
 * Install targets. `dir(name, {global, cwd})` returns the directory that receives the skill's files.
 * Agents that read SKILL.md natively get the bundle as-is; others get an adapter (Cursor rule, AGENTS.md index).
 */
export const AGENTS = {
  claude: {
    label: 'Claude Code',
    dir: (name, o) => path.join(o.global ? os.homedir() : o.cwd, '.claude', 'skills', name),
    root: (o) => path.join(o.global ? os.homedir() : o.cwd, '.claude', 'skills'),
  },
  codex: {
    label: 'OpenAI Codex',
    dir: (name, o) => path.join(o.global ? os.homedir() : o.cwd, '.codex', 'skills', name),
    root: (o) => path.join(o.global ? os.homedir() : o.cwd, '.codex', 'skills'),
  },
  cursor: {
    label: 'Cursor',
    projectOnly: true,
    dir: (name, o) => path.join(o.cwd, '.cursor', 'skills', name),
    root: (o) => path.join(o.cwd, '.cursor', 'skills'),
    after: writeCursorRule,
    remove: (name, o) => fs.rmSync(path.join(o.cwd, '.cursor', 'rules', `${name}.mdc`), { force: true }),
  },
  agents: {
    label: 'AGENTS.md (Gemini CLI, Copilot, Windsurf, Aider, any agent)',
    projectOnly: true,
    dir: (name, o) => path.join(o.cwd, '.agents', 'skills', name),
    root: (o) => path.join(o.cwd, '.agents', 'skills'),
    after: (_n, _d, o) => writeAgentsIndex(o.cwd),
    remove: (_n, o) => writeAgentsIndex(o.cwd),
  },
};

export function resolveAgents(list) {
  const names = (list || 'claude').split(',').map((s) => s.trim()).filter(Boolean);
  const expanded = names.includes('all') ? Object.keys(AGENTS) : names;
  for (const n of expanded) if (!AGENTS[n]) throw new Error(`unknown agent "${n}". Choose from: ${Object.keys(AGENTS).join(', ')}, all`);
  return expanded;
}

/** Detect which agents look configured on this machine / in this project. */
export function detectAgents(cwd) {
  const home = os.homedir();
  const found = [];
  if (fs.existsSync(path.join(home, '.claude')) || fs.existsSync(path.join(cwd, '.claude'))) found.push('claude');
  if (fs.existsSync(path.join(home, '.codex')) || fs.existsSync(path.join(cwd, '.codex'))) found.push('codex');
  if (fs.existsSync(path.join(cwd, '.cursor'))) found.push('cursor');
  if (fs.existsSync(path.join(cwd, 'AGENTS.md'))) found.push('agents');
  return found;
}

/**
 * Write a bundle ({id, name, version, checksum, files: {rel: base64}}) for one agent.
 * Refuses to overwrite a directory that was not installed by skillyard unless force is set.
 */
export function installBundle(agent, bundle, { global = false, cwd = process.cwd(), force = false } = {}) {
  const a = AGENTS[agent];
  const opts = { global: global && !a.projectOnly, cwd };
  const dir = a.dir(bundle.name, opts);
  if (fs.existsSync(dir)) {
    const marker = readMarker(dir);
    if (!marker && !force) throw new Error(`${dir} exists and was not installed by skillyard (use --force to replace it)`);
    if (marker && marker.id !== bundle.id && !force) throw new Error(`${dir} holds ${marker.id}; ${bundle.id} has the same name (use --force to replace it)`);
    fs.rmSync(dir, { recursive: true, force: true });
  }
  fs.mkdirSync(dir, { recursive: true });
  for (const [rel, b64] of Object.entries(bundle.files)) {
    const safe = safeRelPath(rel);
    if (!safe) throw new Error(`refusing unsafe path in bundle: ${rel}`);
    const dest = path.join(dir, safe);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, Buffer.from(b64, 'base64'));
    if (/^scripts\/.+\.(py|sh|js|mjs|rb)$/.test(safe)) fs.chmodSync(dest, 0o755);
  }
  fs.writeFileSync(path.join(dir, MARKER), JSON.stringify({
    id: bundle.id, version: bundle.version, checksum: bundle.checksum, installedAt: new Date().toISOString(),
  }, null, 2));
  if (a.after) a.after(bundle.name, dir, opts);
  return dir;
}

export function uninstall(agent, name, { global = false, cwd = process.cwd() } = {}) {
  const a = AGENTS[agent];
  const opts = { global: global && !a.projectOnly, cwd };
  const dir = a.dir(name, opts);
  if (!fs.existsSync(dir)) return false;
  if (!readMarker(dir)) throw new Error(`${dir} was not installed by skillyard; remove it by hand`);
  fs.rmSync(dir, { recursive: true, force: true });
  if (a.remove) a.remove(name, opts);
  return true;
}

/** Skills installed by skillyard for one agent: [{name, id, version, dir}]. */
export function listInstalled(agent, { global = false, cwd = process.cwd() } = {}) {
  const a = AGENTS[agent];
  const root = a.root({ global: global && !a.projectOnly, cwd });
  if (!fs.existsSync(root)) return [];
  return fs.readdirSync(root, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => ({ name: e.name, dir: path.join(root, e.name), ...readMarker(path.join(root, e.name)) }))
    .filter((x) => x.id);
}

function readMarker(dir) {
  try {
    return JSON.parse(fs.readFileSync(path.join(dir, MARKER), 'utf8'));
  } catch {
    return null;
  }
}

function writeCursorRule(name, dir, o) {
  const { data, body } = parseFrontmatter(fs.readFileSync(path.join(dir, 'SKILL.md'), 'utf8'));
  const rel = path.relative(o.cwd, dir).split(path.sep).join('/');
  const rulesDir = path.join(o.cwd, '.cursor', 'rules');
  fs.mkdirSync(rulesDir, { recursive: true });
  const desc = (data?.description || name).replace(/\n/g, ' ');
  const mdc = [
    '---',
    `description: ${desc}`,
    'globs:',
    'alwaysApply: false',
    '---',
    `<!-- Installed by skillyard. Supporting files (scripts, references, templates) are in ${rel}/ -->`,
    '',
    body.replace(/\]\((?!https?:)([^)]+)\)/g, `](${rel}/$1)`),
  ].join('\n');
  fs.writeFileSync(path.join(rulesDir, `${name}.mdc`), mdc);
}

const START = '<!-- skillyard:start -->';
const END = '<!-- skillyard:end -->';

/** Rebuild the managed skills section of AGENTS.md from .agents/skills/. */
export function writeAgentsIndex(cwd) {
  const root = path.join(cwd, '.agents', 'skills');
  const entries = fs.existsSync(root)
    ? fs.readdirSync(root, { withFileTypes: true }).filter((e) => e.isDirectory() && fs.existsSync(path.join(root, e.name, 'SKILL.md')))
    : [];
  const lines = entries.sort((a, b) => a.name.localeCompare(b.name)).map((e) => {
    const { data } = parseFrontmatter(fs.readFileSync(path.join(root, e.name, 'SKILL.md'), 'utf8'));
    return `- **${e.name}** (\`.agents/skills/${e.name}/SKILL.md\`): ${data?.description || ''}`;
  });
  const block = lines.length ? [
    START,
    '## Skills',
    '',
    'Before starting a task, check whether one of these skills applies. If it does, read its SKILL.md and follow it;',
    'paths inside a skill (scripts/, references/, templates/) are relative to that skill\'s folder.',
    '',
    ...lines,
    END,
  ].join('\n') : '';
  const file = path.join(cwd, 'AGENTS.md');
  const current = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
  const re = new RegExp(`${START}[\\s\\S]*?${END}`);
  let next;
  if (re.test(current)) next = current.replace(re, block).replace(/\n{3,}$/, '\n');
  else if (block) next = `${current}${current && !current.endsWith('\n\n') ? (current.endsWith('\n') ? '\n' : '\n\n') : ''}${block}\n`;
  else return;
  if (!next.trim()) fs.rmSync(file, { force: true });
  else fs.writeFileSync(file, next);
}
