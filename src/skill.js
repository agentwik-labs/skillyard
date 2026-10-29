// Loading, validating and packing skill directories (Agent Skills format: SKILL.md + optional files).
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export const NAME_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const SCOPE_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const SEMVER_RE = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$/;
export const CATEGORIES = [
  'engineering', 'devops', 'testing', 'security', 'data', 'docs', 'product', 'ai',
  'support', 'sales', 'compliance', 'people', 'other',
];
export const LIMITS = { files: 200, fileBytes: 1024 * 1024, totalBytes: 5 * 1024 * 1024 };

const IGNORED = new Set(['.git', 'node_modules', '__pycache__', '.DS_Store', '.venv']);

/** Parse a YAML frontmatter block of flat `key: value` lines. */
export function parseFrontmatter(text) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(text);
  if (!m) return { data: null, body: text };
  const data = {};
  let lastKey = null;
  for (const raw of m[1].split(/\r?\n/)) {
    if (!raw.trim() || raw.trim().startsWith('#')) continue;
    const kv = /^([A-Za-z0-9_-]+):\s*(.*)$/.exec(raw);
    if (kv) {
      lastKey = kv[1];
      data[lastKey] = unquote(kv[2].trim());
    } else if (lastKey && /^\s+/.test(raw)) {
      // folded continuation line
      data[lastKey] = `${data[lastKey]} ${raw.trim()}`.trim();
    }
  }
  return { data, body: text.slice(m[0].length) };
}

function unquote(v) {
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
    return v.slice(1, -1).replace(/\\"/g, '"');
  }
  return v;
}

/** Reject anything that could escape the skill directory when written to disk. */
export function safeRelPath(p) {
  if (typeof p !== 'string' || !p || p.length > 255) return null;
  if (p.includes('\0') || p.includes('\\')) return null;
  if (p.startsWith('/') || /^[A-Za-z]:/.test(p)) return null;
  const norm = path.posix.normalize(p);
  if (norm !== p || norm.startsWith('..') || norm.split('/').some((s) => s === '..' || s === '' || s === '.')) return null;
  return norm;
}

/** Read a skill directory into { files: {relPath: Buffer} }. */
export function readSkillDir(dir) {
  const files = {};
  const walk = (abs, rel) => {
    for (const ent of fs.readdirSync(abs, { withFileTypes: true })) {
      if (IGNORED.has(ent.name)) continue;
      const a = path.join(abs, ent.name);
      const r = rel ? `${rel}/${ent.name}` : ent.name;
      if (ent.isDirectory()) walk(a, r);
      else if (ent.isFile()) files[r] = fs.readFileSync(a);
    }
  };
  walk(dir, '');
  return files;
}

/**
 * Validate a set of skill files. Returns { ok, errors, warnings, manifest }.
 * manifest merges SKILL.md frontmatter with optional skill.json metadata.
 */
export function validateFiles(files) {
  const errors = [];
  const warnings = [];
  const names = Object.keys(files);
  if (names.length > LIMITS.files) errors.push(`too many files (${names.length} > ${LIMITS.files})`);
  let total = 0;
  for (const n of names) {
    if (!safeRelPath(n)) errors.push(`unsafe file path: ${n}`);
    total += files[n].length;
    if (files[n].length > LIMITS.fileBytes) errors.push(`${n} is larger than 1 MB`);
  }
  if (total > LIMITS.totalBytes) errors.push('skill is larger than 5 MB');
  if (!files['SKILL.md']) {
    errors.push('missing SKILL.md');
    return { ok: false, errors, warnings, manifest: null };
  }
  const { data, body } = parseFrontmatter(files['SKILL.md'].toString('utf8'));
  if (!data) errors.push('SKILL.md has no YAML frontmatter');
  const fm = data || {};
  if (!fm.name) errors.push('frontmatter: name is required');
  else if (!NAME_RE.test(fm.name) || fm.name.length > 64) errors.push(`frontmatter: name "${fm.name}" must be lowercase-hyphenated, <= 64 chars`);
  if (!fm.description) errors.push('frontmatter: description is required');
  else if (fm.description.length > 1024) errors.push('frontmatter: description must be <= 1024 chars');
  else {
    // The description is the only thing an agent reads before deciding to load a skill.
    if (fm.description.length < 60 || !/\b(?:use (?:it |this )?(?:when|for|before|after|whenever)|when (?:the user|someone|asked|you)|trigger)/i.test(fm.description)) {
      warnings.push('description does not say when to use the skill; agents decide to load a skill from its description alone');
    }
    if (/\b(?:every|all|any)\s+(?:task|request|prompt|conversation|message)s?\b|\balways (?:load|use|apply) (?:this|it)\b/i.test(fm.description)) {
      warnings.push('description claims every task; a skill that triggers on everything crowds out the right one');
    }
  }
  if (body.trim().length < 50) warnings.push('SKILL.md body is very short');
  const bodyLines = body.split('\n').length;
  if (bodyLines > 500) warnings.push(`SKILL.md body is ${bodyLines} lines; long skills cost context on every load, move detail to references/`);

  let meta = {};
  if (files['skill.json']) {
    try {
      meta = JSON.parse(files['skill.json'].toString('utf8'));
    } catch (e) {
      errors.push(`skill.json: ${e.message}`);
    }
  }
  if (meta.name && fm.name && meta.name !== fm.name) errors.push(`skill.json name "${meta.name}" != SKILL.md name "${fm.name}"`);
  const version = meta.version || '1.0.0';
  if (!SEMVER_RE.test(version)) errors.push(`version "${version}" is not semver`);
  const category = meta.category || 'other';
  if (!CATEGORIES.includes(category)) warnings.push(`unknown category "${category}"`);
  if (meta.visibility && !['public', 'private'].includes(meta.visibility)) errors.push('visibility must be public or private');
  if (meta.tags && (!Array.isArray(meta.tags) || meta.tags.some((t) => typeof t !== 'string'))) errors.push('tags must be an array of strings');

  // Relative links in SKILL.md that point at missing files are a common authoring bug.
  for (const m of body.matchAll(/(?:^|[\s`(\[])((?:scripts|references|templates|assets)\/[\w./-]*\w)/gm)) {
    if (!files[m[1]] && !Object.keys(files).some((f) => f.startsWith(`${m[1]}/`))) warnings.push(`SKILL.md references ${m[1]}, which is not in the skill`);
  }

  const manifest = {
    name: fm.name,
    description: fm.description,
    license: fm.license || meta.license || null,
    version,
    title: meta.title || titleCase(fm.name || ''),
    summary: meta.summary || (fm.description || '').slice(0, 140),
    category,
    tags: Array.isArray(meta.tags) ? meta.tags : [],
    author: meta.author || null,
    visibility: meta.visibility || null,
  };
  return { ok: errors.length === 0, errors, warnings, manifest };
}

export function titleCase(name) {
  return name.split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

export function checksum(files) {
  const h = crypto.createHash('sha256');
  for (const n of Object.keys(files).sort()) {
    h.update(n).update('\0').update(files[n]).update('\0');
  }
  return `sha256-${h.digest('hex')}`;
}

export function compareSemver(a, b) {
  const pa = SEMVER_RE.exec(a);
  const pb = SEMVER_RE.exec(b);
  for (let i = 1; i <= 3; i++) {
    const d = Number(pa[i]) - Number(pb[i]);
    if (d) return d;
  }
  if (pa[4] && !pb[4]) return -1;
  if (!pa[4] && pb[4]) return 1;
  return (pa[4] || '').localeCompare(pb[4] || '');
}

/** Resolve a version spec ("latest", "1.2.3", "^1.2.0", "~1.2.0") against available versions. */
export function resolveVersion(versions, spec = 'latest') {
  const sorted = [...versions].filter((v) => SEMVER_RE.test(v)).sort(compareSemver).reverse();
  const stable = sorted.filter((v) => !SEMVER_RE.exec(v)[4]);
  if (!spec || spec === 'latest' || spec === '*') return stable[0] || sorted[0] || null;
  if (SEMVER_RE.test(spec)) return versions.includes(spec) ? spec : null;
  const m = /^([\^~])(\d+\.\d+\.\d+)$/.exec(spec);
  if (!m) return null;
  const [maj, min] = m[2].split('.').map(Number);
  return stable.find((v) => {
    const [vM, vm] = v.split('.').map(Number);
    if (compareSemver(v, m[2]) < 0) return false;
    if (m[1] === '~') return vM === maj && vm === min;
    return maj === 0 ? vM === 0 && vm === min : vM === maj;
  }) || null;
}

/** "@acme/deploy-runbook@1.2.0" -> { scope, name, version }. Bare names default to `defaultScope`. */
export function parseSkillRef(ref, defaultScope = 'skillyard') {
  const m = /^(?:@([a-z0-9-]+)\/)?([a-z0-9-]+)(?:@([^\s]+))?$/.exec(ref || '');
  if (!m) return null;
  return { scope: m[1] || defaultScope, name: m[2], version: m[3] || 'latest' };
}

export const skillId = (scope, name) => `@${scope}/${name}`;
