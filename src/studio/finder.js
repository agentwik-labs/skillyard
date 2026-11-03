// Find existing skills that might already fix a theme, before (or alongside) drafting a new one.
// Searches a Skillyard registry: the team's own when SKILLYARD_REGISTRY is set, else the public library
// (a static export: api/index.json, api/skills/@scope/name.json, .../files/<path>). Public skills only.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { askJson } from './llm.js';
import { validateFiles } from '../skill.js';
import { scanFiles } from '../scan.js';

export const PUBLIC_LIBRARY = 'https://agentwik-labs.github.io/skillyard';
const STOP = new Set('the a an and or of to in on for with without from by is are be it its this that what when who how than then into over after before not no do does did done make makes made use uses used user users agent agents asked ask says said says just only also more less any all every each nobody something'.split(' '));

// Crude stemming (first five letters) so "verify" meets "verification" and "scoped" meets "scope".
const tokens = (t) => String(t || '').toLowerCase().replace(/[^a-z0-9\s-]/g, ' ').split(/[\s-]+/).filter((w) => w.length > 2 && !STOP.has(w)).map((w) => w.slice(0, 5));

async function getJson(url) {
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`${url} answered ${res.status}`);
  return res.json();
}

/** The library index, cached for a day in `cacheDir`. */
export async function loadLibrary(cacheDir, base = process.env.SKILLYARD_LIBRARY || PUBLIC_LIBRARY) {
  const file = path.join(cacheDir, 'library-index.json');
  try {
    const st = fs.statSync(file);
    if (Date.now() - st.mtimeMs < 864e5) return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch { /* no cache */ }
  const idx = await getJson(`${base.replace(/\/$/, '')}/api/index.json`);
  const lib = { base, fetchedAt: new Date().toISOString(), skills: idx.skills.filter((s) => s.visibility === 'public') };
  fs.mkdirSync(cacheDir, { recursive: true });
  fs.writeFileSync(file, JSON.stringify(lib));
  return lib;
}

/** Keyword candidates for a theme: weighted overlap with name, title, tags, summary and description. */
export function keywordCandidates(lib, theme, { limit = 12, exclude = [] } = {}) {
  const q = new Set(tokens(`${theme.title} ${theme.problem} ${theme.skill}`));
  return lib.skills
    .filter((s) => !exclude.includes(s.name))
    .map((s) => {
      let score = 0;
      const fields = [[s.name, 4], [s.title, 3], [(s.tags || []).join(' '), 3], [s.summary, 2], [s.description, 1]];
      for (const [text, w] of fields) for (const t of new Set(tokens(text))) if (q.has(t)) score += w;
      return { ...s, score };
    })
    .filter((s) => s.score >= 4)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

/** Ask the model which candidates would actually prevent this failure. Returns [{ id, reason }] (max 2). */
export async function pickCandidates(theme, candidates, { model } = {}) {
  if (!candidates.length) return [];
  const prompt = `A developer keeps correcting their AI coding agent for this failure:
"${theme.title}" — ${theme.problem}

Which of these existing skills (instructions the agent can load) would directly prevent it? Pick at most 2, only
ones whose description clearly targets this failure. An empty list is a fine answer.

${candidates.map((c) => `${c.id}: ${String(c.description || c.summary).slice(0, 300)}`).join('\n')}

Return {"picks":[{"id":"@scope/name","reason":"one short sentence"}]}`;
  const { picks = [] } = await askJson(prompt, { model });
  const ids = new Set(candidates.map((c) => c.id));
  return picks.filter((p) => ids.has(p.id)).slice(0, 2);
}

/** Download a library skill into a fresh temp folder; validate and scan it like any publish. */
export async function fetchSkill(lib, id) {
  const [, scope, name] = /^@([a-z0-9-]+)\/([a-z0-9-]+)$/.exec(id) || [];
  if (!scope) throw new Error(`bad skill id ${id}`);
  const base = `${lib.base.replace(/\/$/, '')}/api/skills/@${scope}/${name}`;
  const info = await getJson(`${base}.json`);
  const files = {};
  for (const rel of info.files.slice(0, 200)) {
    const res = await fetch(`${base}/files/${rel.split('/').map(encodeURIComponent).join('/')}`);
    if (!res.ok) throw new Error(`could not fetch ${id}/${rel}`);
    files[rel] = Buffer.from(await res.arrayBuffer());
  }
  delete files['.skillyard-install.json'];
  const v = validateFiles(files);
  const s = scanFiles(files);
  if (!v.ok || s.critical) throw new Error(`${id} failed checks`);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'skillyard-found-'));
  for (const [rel, buf] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
    fs.writeFileSync(path.join(dir, rel), buf);
  }
  return { dir, info, skillMd: files['SKILL.md'].toString('utf8'), files };
}
