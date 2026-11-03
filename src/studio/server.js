// Studio: a local-only web app over the engine. It can read your logs and write skills into your agents' folders,
// so it binds to 127.0.0.1, checks the Host header (DNS rebinding) and requires a custom header on every write
// (a page on another site cannot send one without a CORS preflight, which this server never answers).
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as engine from './engine.js';

const UI_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'studio');
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml' };

export function createStudioServer({ port }) {
  const allowedHosts = new Set([`127.0.0.1:${port}`, `localhost:${port}`]);
  const routes = {
    'GET /api/state': (b, url) => engine.stats({ project: url.searchParams.get('project') || undefined }),
    'GET /api/preview': () => engine.preview(),
    'GET /api/skills': () => ({ skills: engine.installedSkills().map(({ dir, ...k }) => ({ ...k, dir: dir.replace(process.env.HOME, '~') })) }),
    'POST /api/consent': (b) => { engine.setConsent(b || {}); return engine.stats(); },
    'POST /api/scan': () => { engine.startJob('scan', async (step) => { step('Reading sessions'); await engine.scan(); }); return { started: true }; },
    'POST /api/notify-test': async () => ({ sent: await engine.notify([], { test: true }) }),
    'POST /api/review': (b) => { engine.startJob('review', (step) => engine.review({ maxProposals: Math.min(Number(b?.max) || 3, 5), onStep: step })); return { started: true }; },
  };

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost');
    const send = (status, body, type = 'application/json; charset=utf-8') => {
      res.writeHead(status, { 'Content-Type': type, 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' });
      res.end(type.startsWith('application/json') ? JSON.stringify(body) : body);
    };
    try {
      if (!allowedHosts.has(req.headers.host)) return send(421, { error: 'Studio only answers on 127.0.0.1' });
      if (!url.pathname.startsWith('/api/')) {
        const rel = url.pathname === '/' ? 'index.html' : url.pathname.slice(1);
        const file = path.join(UI_DIR, path.normalize(rel).replace(/^(\.\.[/\\])+/, ''));
        if (!file.startsWith(UI_DIR) || !fs.existsSync(file)) return send(404, 'not found', 'text/plain');
        res.setHeader('Content-Security-Policy', "default-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'");
        return send(200, fs.readFileSync(file), MIME[path.extname(file)] || 'application/octet-stream');
      }
      if (req.method !== 'GET' && req.headers['x-skillyard-studio'] !== '1') return send(403, { error: 'missing Studio header' });
      if (req.method !== 'GET') console.log(`${new Date().toISOString()} ${req.method} ${url.pathname}`);
      let body;
      if (req.method === 'POST') {
        const chunks = [];
        let size = 0;
        for await (const c of req) { size += c.length; if (size > 1e6) return send(413, { error: 'too large' }); chunks.push(c); }
        body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {};
      }
      const m = /^\/api\/proposals\/([a-f0-9]+)\/(approve|reject|undo)$/.exec(url.pathname);
      if (m && req.method === 'POST') return send(200, engine.decide(m[1], m[2], body));
      if (url.pathname === '/api/diff' && req.method === 'GET') {
        const p = engine.loadState().proposals.find((x) => x.id === url.searchParams.get('id'));
        if (!p) return send(404, { error: 'not found' });
        return send(200, { diff: engine.diffLines(p.before || '', p.after) });
      }
      const fn = routes[`${req.method} ${url.pathname}`];
      if (!fn) return send(404, { error: 'not found' });
      return send(200, await fn(body, url));
    } catch (e) {
      return send(e.status || 500, { error: e.message });
    }
  });
  return server;
}
