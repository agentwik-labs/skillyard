// HTTP server: REST API, MCP endpoint (Streamable HTTP, JSON responses) and the web UI.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { HttpError, Store } from './store.js';
import { createMcpHandler } from './mcp.js';
import { safeRelPath } from './skill.js';

const WEB_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'web');
const MAX_BODY = 8 * 1024 * 1024;
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml', '.json': 'application/json', '.png': 'image/png', '.ico': 'image/x-icon',
  '.md': 'text/markdown; charset=utf-8', '.py': 'text/plain; charset=utf-8', '.sh': 'text/plain; charset=utf-8',
};

/** Store-backed registry bound to one caller's auth, for the MCP handler. */
export class LocalRegistry {
  constructor(store, auth) {
    this.store = store;
    this.auth = auth;
  }
  search(opts) { return this.store.search(opts, this.auth); }
  get(scope, name, version) { return this.store.get(scope, name, version, this.auth); }
  readFile(scope, name, version, p) { return this.store.readFile(scope, name, version, p, this.auth).toString('utf8'); }
}

export function createServer({ dataDir = 'data', adminToken = process.env.SKILLYARD_ADMIN_TOKEN, allowedOrigins = [], log = false } = {}) {
  const store = new Store(dataDir);
  const routes = [];
  const route = (method, pattern, fn) => routes.push({ method, re: new RegExp(`^${pattern}$`), fn });
  const SKILL = '/api/skills/@([a-z0-9-]+)/([a-z0-9-]+)';

  route('GET', '/api/health', () => ({ ok: true }));
  route('GET', '/api/whoami', ({ auth }) => auth ? { org: auth.org, scopes: auth.scopes, admin: auth.admin } : { anonymous: true });
  route('GET', '/api/stats', ({ auth }) => store.stats(auth));
  route('GET', '/api/skills', ({ auth, query }) => ({
    skills: store.search({
      q: query.get('q') || '', scope: query.get('scope') || undefined, category: query.get('category') || undefined,
      visibility: query.get('visibility') || undefined, limit: Math.min(Number(query.get('limit')) || 100, 500),
    }, auth),
  }));
  route('GET', SKILL, ({ auth, m, query }) => store.get(m[1], m[2], query.get('version') || 'latest', auth));
  route('GET', `${SKILL}/bundle`, ({ auth, m, query }) => store.bundle(m[1], m[2], query.get('version') || 'latest', auth));
  route('GET', `${SKILL}/files/(.+)`, ({ auth, m, query }) => {
    const buf = store.readFile(m[1], m[2], query.get('version') || 'latest', decodeURIComponent(m[3]), auth);
    return { raw: buf, type: MIME[path.extname(m[3])] || 'text/plain; charset=utf-8' };
  });
  route('POST', '/api/skills/@([a-z0-9-]+)', async ({ auth, m, body }) => {
    const { files, visibility } = body || {};
    if (!files || typeof files !== 'object') throw new HttpError(400, 'body must be {"files": {"path": "<base64>"}}');
    const decoded = {};
    for (const [p, b64] of Object.entries(files)) {
      if (typeof b64 !== 'string') throw new HttpError(400, `file ${p} must be base64 text`);
      decoded[p] = Buffer.from(b64, 'base64');
    }
    return { status: 201, body: store.publish({ scope: m[1], files: decoded, visibility, auth }) };
  });
  route('PATCH', SKILL, ({ auth, m, body }) => store.setVisibility(m[1], m[2], body?.visibility, auth));
  route('DELETE', SKILL, ({ auth, m }) => { store.deleteSkill(m[1], m[2], auth); return { deleted: true }; });

  route('GET', '/api/orgs', ({ auth }) => ({ orgs: store.listOrgs(auth) }));
  route('POST', '/api/orgs', ({ auth, body }) => {
    if (!auth?.admin) throw new HttpError(403, 'admin token required');
    return { status: 201, body: store.createOrg(body || {}) };
  });
  route('GET', '/api/orgs/([a-z0-9-]+)', ({ auth, m }) => {
    const org = store.getOrg(m[1]);
    if (!org) throw new HttpError(404, 'org not found');
    return { ...org, member: auth?.org === m[1] || !!auth?.admin, skills: store.search({ scope: m[1], limit: 500 }, auth) };
  });
  const orgManager = (auth, org) => {
    if (!(auth?.admin || (auth?.org === org && auth.scopes.includes('publish')))) throw new HttpError(403, 'a publish token for this org is required');
  };
  route('GET', '/api/orgs/([a-z0-9-]+)/tokens', ({ auth, m }) => { orgManager(auth, m[1]); return { tokens: store.listTokens(m[1]) }; });
  route('POST', '/api/orgs/([a-z0-9-]+)/tokens', ({ auth, m, body }) => {
    orgManager(auth, m[1]);
    const scopes = Array.isArray(body?.scopes) ? body.scopes : ['read'];
    if (scopes.includes('admin')) throw new HttpError(400, 'org tokens cannot have the admin scope');
    return { status: 201, body: store.createToken({ org: m[1], name: body?.name || 'token', scopes }) };
  });
  route('DELETE', '/api/orgs/([a-z0-9-]+)/tokens/([a-f0-9]+)', ({ auth, m }) => {
    orgManager(auth, m[1]);
    store.revokeToken(m[2], m[1]);
    return { revoked: true };
  });
  route('GET', '/api/orgs/([a-z0-9-]+)/events', ({ auth, m }) => { orgManager(auth, m[1]); return { events: store.events(m[1]) }; });

  route('POST', '/mcp', async ({ auth, body }) => {
    const handle = createMcpHandler(new LocalRegistry(store, auth));
    const res = await handle(body);
    return res === null ? { status: 202, empty: true } : res;
  });

  const server = http.createServer(async (req, res) => {
    const started = Date.now();
    const url = new URL(req.url, 'http://localhost');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    try {
      const isApi = url.pathname.startsWith('/api/') || url.pathname === '/mcp';
      if (isApi) {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type, Mcp-Protocol-Version, Mcp-Session-Id');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
        if (req.method === 'OPTIONS') return send(res, 204);
      }
      if (url.pathname === '/mcp') {
        // DNS-rebinding guard from the MCP spec: browsers send Origin; only allow known ones.
        const origin = req.headers.origin;
        if (origin && !originAllowed(origin, req.headers.host, allowedOrigins)) throw new HttpError(403, 'origin not allowed');
        if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); throw new HttpError(405, 'this MCP server does not offer an SSE stream; POST JSON-RPC messages'); }
      }
      if (!isApi) return serveStatic(url.pathname, res);

      const auth = store.authenticate(bearer(req), adminToken);
      const r = routes.find((x) => x.method === req.method && x.re.test(url.pathname));
      if (!r) throw new HttpError(404, 'not found');
      const body = ['POST', 'PATCH'].includes(req.method) ? await readJson(req) : undefined;
      const out = await r.fn({ auth, m: r.re.exec(url.pathname), query: url.searchParams, body, req });
      if (out?.raw) return send(res, 200, out.raw, out.type);
      if (out?.empty) return send(res, out.status);
      if (out?.status && out.body) return sendJson(res, out.status, out.body);
      return sendJson(res, 200, out);
    } catch (e) {
      const status = e.status || 500;
      if (status === 500) console.error(e);
      if (url.pathname === '/mcp' && status !== 401 && status !== 403 && status !== 405) {
        return sendJson(res, 200, { jsonrpc: '2.0', id: null, error: { code: -32700, message: e.message } });
      }
      if (status === 401) res.setHeader('WWW-Authenticate', 'Bearer realm="skillyard"');
      return sendJson(res, status, { error: status === 500 ? 'internal error' : e.message });
    } finally {
      if (log) console.log(`${req.method} ${url.pathname} ${res.statusCode} ${Date.now() - started}ms`);
    }
  });
  server.store = store;
  return server;
}

function originAllowed(origin, host, allowed) {
  if (allowed.includes('*') || allowed.includes(origin)) return true;
  try {
    const o = new URL(origin);
    const local = ['localhost', '127.0.0.1', '[::1]'];
    return local.includes(o.hostname) && local.some((h) => (host || '').startsWith(h));
  } catch {
    return false;
  }
}

function bearer(req) {
  const h = req.headers.authorization || '';
  const m = /^Bearer\s+(.+)$/i.exec(h);
  return m ? m[1].trim() : null;
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > MAX_BODY) { reject(new HttpError(413, 'body too large')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => {
      if (!size) return resolve(undefined);
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); } catch { reject(new HttpError(400, 'invalid JSON body')); }
    });
    req.on('error', reject);
  });
}

function send(res, status, body, type) {
  if (type) res.setHeader('Content-Type', type);
  res.writeHead(status);
  res.end(body);
}

function sendJson(res, status, obj) {
  send(res, status, JSON.stringify(obj), 'application/json; charset=utf-8');
}

function serveStatic(pathname, res) {
  const rel = pathname === '/' ? 'index.html' : safeRelPath(decodeURIComponent(pathname.slice(1)));
  let file = rel && path.join(WEB_DIR, rel);
  if (!file || !fs.existsSync(file) || !fs.statSync(file).isFile()) file = path.join(WEB_DIR, 'index.html'); // SPA fallback
  res.setHeader('Content-Security-Policy', "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; connect-src 'self'");
  send(res, 200, fs.readFileSync(file), MIME[path.extname(file)] || 'application/octet-stream');
}
