// Import free, openly licensed skills from public repositories into a registry scope.
// Clones read-only (shallow, no submodules, nothing executed), keeps only permissive licences, copies the licence
// file into every imported skill, records where it came from, and runs the same checks as a publish.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { parseFrontmatter, readSkillDir, validateFiles, checksum, compareSemver } from './skill.js';
import { scanFiles } from './scan.js';

const PERMISSIVE = [
  ['MIT', /\bMIT License\b|Permission is hereby granted, free of charge/i],
  ['Apache-2.0', /Apache License,?\s+Version 2\.0/i],
  ['BSD-3-Clause', /Redistribution and use in source and binary forms[\s\S]{0,600}Neither the name/i],
  ['BSD-2-Clause', /Redistribution and use in source and binary forms/i],
  ['ISC', /\bISC License\b|Permission to use, copy, modify, and\/or distribute this software for any purpose/i],
  ['CC-BY-4.0', /Creative Commons Attribution 4\.0/i],
  ['Unlicense', /This is free and unencumbered software released into the public domain/i],
];
const SPDX_OK = new Set(['MIT', 'Apache-2.0', 'BSD-2-Clause', 'BSD-3-Clause', 'ISC', 'CC-BY-4.0', 'Unlicense', '0BSD', 'CC0-1.0']);
const LICENSE_FILES = ['LICENSE', 'LICENSE.md', 'LICENSE.txt', 'LICENCE', 'license', 'License.txt', 'COPYING'];

function detectLicense(dir) {
  for (const f of LICENSE_FILES) {
    const p = path.join(dir, f);
    if (!fs.existsSync(p)) continue;
    const text = fs.readFileSync(p, 'utf8').slice(0, 20000);
    const hit = PERMISSIVE.find(([, re]) => re.test(text));
    return { file: p, spdx: hit ? hit[0] : null };
  }
  return null;
}

function normaliseSpdx(v) {
  if (!v) return null;
  const s = String(v).trim().replace(/^"|"$/g, '');
  const m = { mit: 'MIT', 'apache-2.0': 'Apache-2.0', 'apache 2.0': 'Apache-2.0', isc: 'ISC', unlicense: 'Unlicense', 'bsd-3-clause': 'BSD-3-Clause', 'bsd-2-clause': 'BSD-2-Clause', 'cc-by-4.0': 'CC-BY-4.0', 'cc0-1.0': 'CC0-1.0' };
  return m[s.toLowerCase()] || s;
}

function git(args, cwd) {
  const r = spawnSync('git', args, { cwd, encoding: 'utf8', env: { ...process.env, GIT_TERMINAL_PROMPT: '0' } });
  if (r.status !== 0) throw new Error((r.stderr || r.stdout || 'git failed').trim().split('\n').pop());
  return r.stdout.trim();
}

/** Clone owner/repo (or a URL) shallowly into a fresh temp dir. Returns { dir, url, sha, date }. */
export function fetchRepo(source) {
  const url = /^https?:\/\//.test(source) ? source : `https://github.com/${source.replace(/\.git$/, '')}.git`;
  if (!/^https:\/\/github\.com\/[\w.-]+\/[\w.-]+(\.git)?$/.test(url)) throw new Error(`only public GitHub repositories are supported: ${source}`);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'skillyard-import-'));
  git(['clone', '--quiet', '--depth', '1', '--no-recurse-submodules', '-c', 'core.symlinks=false', url, dir]);
  return { dir, url: url.replace(/\.git$/, ''), sha: git(['rev-parse', 'HEAD'], dir), date: git(['log', '-1', '--format=%cs'], dir) };
}

function findSkillDirs(root) {
  const out = [];
  const walk = (d, depth) => {
    if (depth > 7) return;
    let ents;
    try { ents = fs.readdirSync(d, { withFileTypes: true }); } catch { return; }
    if (ents.some((e) => e.isFile() && e.name === 'SKILL.md')) { out.push(d); return; }
    for (const e of ents) if (e.isDirectory() && !['.git', 'node_modules', 'dist', 'build', '.venv'].includes(e.name)) walk(path.join(d, e.name), depth + 1);
  };
  walk(root, 0);
  return out;
}

/**
 * Import every eligible skill from one source into `store` under `scope`.
 * Returns { source, imported: [...], skipped: [{ path, reason }] }.
 */
export function importSource(store, source, { scope = 'community', auth, limit = 200 } = {}) {
  const repo = fetchRepo(source);
  const repoLicense = detectLicense(repo.dir);
  const result = { source: repo.url, sha: repo.sha, imported: [], unchanged: 0, skipped: [] };
  const seen = new Map(); // content checksum -> first path; repos often ship one skill once per agent folder
  try {
    for (const dir of findSkillDirs(repo.dir).slice(0, limit)) {
      const rel = path.relative(repo.dir, dir) || '.';
      const files = readSkillDir(dir);
      for (const k of Object.keys(files)) if (k.startsWith('evals/') || k === '.skillyard-install.json') delete files[k];
      const { data } = parseFrontmatter(files['SKILL.md'].toString('utf8'));
      const own = detectLicense(dir);
      // A frontmatter licence that names an SPDX id wins; one that points at a file ("Complete terms in LICENSE.txt")
      // is read from that file; otherwise fall back to the skill's or the repository's licence file.
      const front = normaliseSpdx(data?.license);
      const spdx = (front && SPDX_OK.has(front) ? front : null) || own?.spdx || (front ? null : repoLicense?.spdx);
      if (!spdx || !SPDX_OK.has(spdx)) { result.skipped.push({ path: rel, reason: spdx ? `licence ${spdx} is not on the permissive list` : 'no licence found' }); continue; }
      const sum = checksum(files);
      if (seen.has(sum)) { result.skipped.push({ path: rel, reason: `duplicate of ${seen.get(sum)}` }); continue; }
      seen.set(sum, rel);
      // Attribution travels with the skill.
      const licFile = own?.file || repoLicense?.file;
      if (licFile && !Object.keys(files).some((k) => /^licen[cs]e/i.test(k))) files.LICENSE = fs.readFileSync(licFile);
      const v = validateFiles(files);
      if (!v.ok) { result.skipped.push({ path: rel, reason: v.errors[0] }); continue; }
      const scan = scanFiles(files);
      if (scan.critical) { result.skipped.push({ path: rel, reason: `security scan: ${scan.findings.find((f) => f.severity === 'critical').message}` }); continue; }
      const name = v.manifest.name;
      const owner = repo.url.split('/').slice(-2)[0];
      const id = `@${scope}/${name}`;
      const existing = store.db.skills[id];
      if (existing && existing.source && existing.source.repo !== repo.url) { result.skipped.push({ path: rel, reason: `${id} already imported from ${existing.source.repo}` }); continue; }
      if (existing && Object.values(existing.versions).some((x) => x.checksum === checksum(files))) { result.unchanged++; continue; }
      const day = repo.date.replace(/-/g, '');
      let version = `1.${day}.0`;
      while (existing?.versions[version]) version = version.replace(/\.(\d+)$/, (_, n) => `.${Number(n) + 1}`);
      if (existing?.latest && compareSemver(version, existing.latest) <= 0) version = existing.latest.replace(/\.(\d+)$/, (_, n) => `.${Number(n) + 1}`);
      let meta = {};
      try { meta = files['skill.json'] ? JSON.parse(files['skill.json'].toString('utf8')) : {}; } catch { /* ignore a broken one */ }
      files['skill.json'] = Buffer.from(JSON.stringify({
        ...meta, name, version, license: spdx,
        title: meta.title, summary: meta.summary, category: meta.category || guessCategory(`${name} ${v.manifest.description}`),
        tags: meta.tags || [], author: meta.author || owner, visibility: 'public',
        source: { repo: repo.url, path: rel, commit: repo.sha },
      }, null, 2));
      store.publish({ scope, files, visibility: 'public', auth, publishedBy: `import:${owner}` });
      store.db.skills[id].source = { repo: repo.url, path: rel, commit: repo.sha, license: spdx };
      store.save();
      result.imported.push({ id, version, path: rel, license: spdx, warnings: scan.warning });
    }
  } finally {
    fs.rmSync(repo.dir, { recursive: true, force: true });
  }
  return result;
}

const CATS = [
  ['security', /secur|vuln|secret|auth|pentest|threat/],
  ['testing', /\btest|tdd|qa\b|playwright|e2e/],
  ['devops', /deploy|docker|kubernetes|k8s|ci\b|github action|terraform|azure|aws|gcp|cloud|infra/],
  ['data', /sql|database|postgres|data|analytics|csv|neon|supabase|prisma/],
  ['docs', /doc|readme|writing|changelog|copy|blog|content/],
  ['product', /product|spec|prd|marketing|seo|growth|brand|design/],
  ['ai', /prompt|llm|agent|model|claude|mcp|ai\b/],
];
function guessCategory(text) {
  const t = text.toLowerCase();
  return (CATS.find(([, re]) => re.test(t)) || ['engineering'])[0];
}
