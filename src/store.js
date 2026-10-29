// File-backed registry store: orgs, API tokens, skills and their immutable versions.
// Metadata lives in <dataDir>/db.json (written atomically); file contents in <dataDir>/blobs.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { scanFiles } from './scan.js';
import { checksum, compareSemver, resolveVersion, safeRelPath, SCOPE_RE, skillId, validateFiles } from './skill.js';

const EMPTY_DB = () => ({ version: 1, orgs: {}, tokens: {}, skills: {}, events: [] });
export const SCOPES = ['read', 'publish', 'admin'];

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export class Store {
  constructor(dataDir) {
    this.dataDir = path.resolve(dataDir);
    this.dbPath = path.join(this.dataDir, 'db.json');
    this.blobDir = path.join(this.dataDir, 'blobs');
    fs.mkdirSync(this.blobDir, { recursive: true });
    this.db = fs.existsSync(this.dbPath) ? JSON.parse(fs.readFileSync(this.dbPath, 'utf8')) : EMPTY_DB();
  }

  save() {
    const tmp = `${this.dbPath}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(this.db, null, 2));
    fs.renameSync(tmp, this.dbPath);
  }

  log(type, detail) {
    this.db.events.push({ at: new Date().toISOString(), type, ...detail });
    if (this.db.events.length > 1000) this.db.events.splice(0, this.db.events.length - 1000);
  }

  // ---- orgs ---------------------------------------------------------------

  createOrg({ slug, name, description = '', website = '' }) {
    if (!SCOPE_RE.test(slug || '') || slug.length > 40) throw new HttpError(400, 'org slug must be lowercase-hyphenated, <= 40 chars');
    if (this.db.orgs[slug]) throw new HttpError(409, `org ${slug} already exists`);
    const org = { slug, name: name || slug, description, website, createdAt: new Date().toISOString() };
    this.db.orgs[slug] = org;
    this.log('org.create', { org: slug });
    this.save();
    return org;
  }

  getOrg(slug) {
    return this.db.orgs[slug] || null;
  }

  listOrgs(auth) {
    return Object.values(this.db.orgs).map((o) => {
      const skills = Object.values(this.db.skills).filter((s) => s.scope === o.slug);
      const visible = skills.filter((s) => this.canRead(s, auth));
      return { ...o, skillCount: visible.length, privateCount: visible.filter((s) => s.visibility === 'private').length };
    }).filter((o) => o.skillCount > 0 || auth?.org === o.slug || auth?.admin);
  }

  // ---- tokens -------------------------------------------------------------

  createToken({ org, name = 'token', scopes = ['read'] }) {
    if (org && !this.db.orgs[org]) throw new HttpError(404, `org ${org} not found`);
    const bad = scopes.filter((s) => !SCOPES.includes(s));
    if (bad.length) throw new HttpError(400, `unknown scopes: ${bad.join(', ')}`);
    if (scopes.includes('admin') && org) throw new HttpError(400, 'admin tokens are not tied to an org');
    const secret = `sy_${crypto.randomBytes(24).toString('base64url')}`;
    const id = crypto.randomBytes(6).toString('hex');
    this.db.tokens[id] = { id, org: org || null, name, scopes, hash: hashToken(secret), createdAt: new Date().toISOString(), lastUsedAt: null };
    this.log('token.create', { org, tokenId: id, scopes });
    this.save();
    return { id, token: secret, org: org || null, name, scopes };
  }

  listTokens(org) {
    return Object.values(this.db.tokens).filter((t) => t.org === org).map(({ hash, ...t }) => t);
  }

  revokeToken(id, org) {
    const t = this.db.tokens[id];
    if (!t || (org !== undefined && t.org !== org)) throw new HttpError(404, 'token not found');
    delete this.db.tokens[id];
    this.log('token.revoke', { org: t.org, tokenId: id });
    this.save();
  }

  /** Bearer token -> auth context, or null for anonymous. Throws 401 on an unknown token. */
  authenticate(secret, adminToken) {
    if (!secret) return null;
    if (adminToken && timingSafeEqual(secret, adminToken)) return { admin: true, org: null, scopes: SCOPES, tokenId: 'env' };
    const h = hashToken(secret);
    const t = Object.values(this.db.tokens).find((x) => timingSafeEqual(x.hash, h));
    if (!t) throw new HttpError(401, 'invalid token');
    const today = new Date().toISOString().slice(0, 10);
    if (!t.lastUsedAt || !t.lastUsedAt.startsWith(today)) {
      t.lastUsedAt = new Date().toISOString();
      this.save();
    }
    return { admin: t.scopes.includes('admin'), org: t.org, scopes: t.scopes, tokenId: t.id };
  }

  // ---- access -------------------------------------------------------------

  canRead(skill, auth) {
    return skill.visibility === 'public' || !!auth?.admin || (auth?.org === skill.scope && auth.scopes.includes('read'));
  }

  canPublish(scope, auth) {
    return !!auth?.admin || (auth?.org === scope && auth.scopes.includes('publish'));
  }

  // ---- skills -------------------------------------------------------------

  /**
   * Publish a new immutable version. files: {relPath: Buffer}.
   * Visibility comes from the request, then skill.json, then the existing record, then "private" for org scopes.
   */
  publish({ scope, files, visibility, auth, publishedBy }) {
    if (!this.db.orgs[scope]) throw new HttpError(404, `org ${scope} not found`);
    if (!this.canPublish(scope, auth)) throw new HttpError(403, `token cannot publish to @${scope}`);
    const v = validateFiles(files);
    if (!v.ok) throw new HttpError(422, `invalid skill: ${v.errors.join('; ')}`);
    const { manifest } = v;
    const scan = scanFiles(files);
    if (scan.critical) {
      const top = scan.findings.filter((f) => f.severity === 'critical').slice(0, 5).map((f) => `${f.file}:${f.line} ${f.message}`);
      throw new HttpError(422, `security scan blocked publish: ${top.join('; ')}`);
    }
    const id = skillId(scope, manifest.name);
    const existing = this.db.skills[id];
    if (existing?.versions[manifest.version]) throw new HttpError(409, `${id}@${manifest.version} already exists; bump the version in skill.json`);
    const vis = visibility || manifest.visibility || existing?.visibility || 'private';
    if (!['public', 'private'].includes(vis)) throw new HttpError(400, 'visibility must be public or private');

    const dir = this.versionDir(scope, manifest.name, manifest.version);
    fs.mkdirSync(dir, { recursive: true });
    for (const [rel, buf] of Object.entries(files)) {
      const safe = safeRelPath(rel);
      const dest = path.join(dir, safe);
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.writeFileSync(dest, buf);
    }
    const now = new Date().toISOString();
    const rec = existing || { id, scope, name: manifest.name, createdAt: now, downloads: 0, versions: {} };
    rec.visibility = vis;
    rec.updatedAt = now;
    rec.versions[manifest.version] = {
      manifest,
      checksum: checksum(files),
      size: Object.values(files).reduce((a, b) => a + b.length, 0),
      files: Object.keys(files).sort(),
      publishedAt: now,
      publishedBy: publishedBy || auth?.tokenId || null,
      scan: { scannedAt: now, critical: 0, warning: scan.warning, findings: scan.findings },
    };
    rec.latest = resolveVersion(Object.keys(rec.versions), 'latest');
    this.db.skills[id] = rec;
    this.log('skill.publish', { skill: id, version: manifest.version, visibility: vis, by: rec.versions[manifest.version].publishedBy });
    this.save();
    return { ...this.summary(rec), warnings: [...v.warnings, ...scan.findings.map((f) => `security: ${f.file}:${f.line} ${f.message}`)] };
  }

  setVisibility(scope, name, visibility, auth) {
    const rec = this.db.skills[skillId(scope, name)];
    if (!rec) throw new HttpError(404, 'skill not found');
    if (!this.canPublish(scope, auth)) throw new HttpError(403, 'forbidden');
    if (!['public', 'private'].includes(visibility)) throw new HttpError(400, 'visibility must be public or private');
    rec.visibility = visibility;
    this.log('skill.visibility', { skill: rec.id, visibility });
    this.save();
    return this.summary(rec);
  }

  deleteSkill(scope, name, auth) {
    const rec = this.db.skills[skillId(scope, name)];
    if (!rec) throw new HttpError(404, 'skill not found');
    if (!this.canPublish(scope, auth)) throw new HttpError(403, 'forbidden');
    delete this.db.skills[rec.id];
    fs.rmSync(path.join(this.blobDir, scope, name), { recursive: true, force: true });
    this.log('skill.delete', { skill: rec.id });
    this.save();
  }

  versionDir(scope, name, version) {
    return path.join(this.blobDir, scope, name, version);
  }

  /** Look up a readable skill. Private skills the caller cannot read are reported as missing. */
  find(scope, name, auth) {
    const rec = this.db.skills[skillId(scope, name)];
    if (!rec || !this.canRead(rec, auth)) throw new HttpError(404, `skill ${skillId(scope, name)} not found`);
    return rec;
  }

  get(scope, name, spec, auth) {
    const rec = this.find(scope, name, auth);
    const version = resolveVersion(Object.keys(rec.versions), spec);
    if (!version) throw new HttpError(404, `no version of ${rec.id} matches ${spec}`);
    const ver = rec.versions[version];
    const skillMd = fs.readFileSync(path.join(this.versionDir(scope, name, version), 'SKILL.md'), 'utf8');
    return {
      ...this.summary(rec),
      version,
      checksum: ver.checksum,
      size: ver.size,
      files: ver.files,
      publishedAt: ver.publishedAt,
      scan: ver.scan || null,
      versions: Object.keys(rec.versions).sort(compareSemver).reverse(),
      skillMd,
    };
  }

  readFile(scope, name, spec, rel, auth) {
    const rec = this.find(scope, name, auth);
    const version = resolveVersion(Object.keys(rec.versions), spec);
    if (!version) throw new HttpError(404, 'version not found');
    const safe = safeRelPath(rel);
    if (!safe || !rec.versions[version].files.includes(safe)) throw new HttpError(404, `file ${rel} not found`);
    return fs.readFileSync(path.join(this.versionDir(scope, name, version), safe));
  }

  /** Full file bundle for installs; counts as a download. */
  bundle(scope, name, spec, auth) {
    const info = this.get(scope, name, spec, auth);
    const dir = this.versionDir(scope, name, info.version);
    const files = {};
    for (const f of info.files) files[f] = fs.readFileSync(path.join(dir, f)).toString('base64');
    const rec = this.db.skills[info.id];
    rec.downloads = (rec.downloads || 0) + 1;
    this.save();
    delete info.skillMd;
    return { ...info, files };
  }

  summary(rec) {
    const m = rec.versions[rec.latest].manifest;
    return {
      id: rec.id,
      scope: rec.scope,
      name: rec.name,
      title: m.title,
      summary: m.summary,
      description: m.description,
      category: m.category,
      tags: m.tags,
      license: m.license,
      author: m.author,
      visibility: rec.visibility,
      latest: rec.latest,
      downloads: rec.downloads || 0,
      updatedAt: rec.updatedAt,
      scanWarnings: rec.versions[rec.latest].scan?.warning ?? null,
    };
  }

  /** Search readable skills. Empty query lists everything, most downloaded first. */
  search({ q = '', scope, category, visibility, limit = 100 } = {}, auth) {
    const terms = q.toLowerCase().split(/\s+/).filter(Boolean);
    const out = [];
    for (const rec of Object.values(this.db.skills)) {
      if (!this.canRead(rec, auth)) continue;
      if (scope && rec.scope !== scope) continue;
      if (visibility && rec.visibility !== visibility) continue;
      const s = this.summary(rec);
      if (category && s.category !== category) continue;
      let score = 0;
      if (terms.length) {
        const fields = [
          [s.name, 6], [s.title.toLowerCase(), 5], [s.tags.join(' '), 4],
          [s.summary.toLowerCase(), 2], [s.description.toLowerCase(), 1], [s.scope, 3],
        ];
        for (const t of terms) {
          let hit = 0;
          for (const [text, w] of fields) if (text.includes(t)) hit += w;
          if (!hit) { score = -1; break; }
          score += hit;
        }
        if (score < 0) continue;
      }
      out.push({ ...s, score });
    }
    out.sort((a, b) => b.score - a.score || b.downloads - a.downloads || a.id.localeCompare(b.id));
    return out.slice(0, limit);
  }

  stats(auth) {
    const visible = Object.values(this.db.skills).filter((s) => this.canRead(s, auth));
    const cats = {};
    for (const s of visible) {
      const c = this.summary(s).category;
      cats[c] = (cats[c] || 0) + 1;
    }
    return {
      skills: visible.length,
      public: visible.filter((s) => s.visibility === 'public').length,
      private: visible.filter((s) => s.visibility === 'private').length,
      orgs: new Set(visible.map((s) => s.scope)).size,
      categories: cats,
    };
  }

  events(org) {
    return this.db.events.filter((e) => !org || e.org === org || (e.skill || '').startsWith(`@${org}/`)).slice(-100).reverse();
  }
}

export function hashToken(secret) {
  return crypto.createHash('sha256').update(secret).digest('hex');
}

function timingSafeEqual(a, b) {
  const ba = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  return ba.length === bb.length && crypto.timingSafeEqual(ba, bb);
}
