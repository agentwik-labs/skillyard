// HTTP client for a Skillyard registry, plus CLI config (~/.skillyard/config.json, env overrides).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export const DEFAULT_REGISTRY = 'http://localhost:7420';
const CONFIG_PATH = () => path.join(process.env.SKILLYARD_HOME || path.join(os.homedir(), '.skillyard'), 'config.json');

export function loadConfig() {
  let file = {};
  try { file = JSON.parse(fs.readFileSync(CONFIG_PATH(), 'utf8')); } catch { /* no config yet */ }
  return {
    registry: (process.env.SKILLYARD_REGISTRY || file.registry || DEFAULT_REGISTRY).replace(/\/+$/, ''),
    token: process.env.SKILLYARD_TOKEN || file.token || null,
  };
}

export function saveConfig(cfg) {
  const p = CONFIG_PATH();
  fs.mkdirSync(path.dirname(p), { recursive: true, mode: 0o700 });
  fs.writeFileSync(p, JSON.stringify(cfg, null, 2), { mode: 0o600 });
  return p;
}

export class RemoteRegistry {
  constructor({ registry, token } = loadConfig()) {
    this.base = registry.replace(/\/+$/, '');
    this.token = token;
  }

  async request(method, p, body, { raw = false } = {}) {
    const headers = { Accept: 'application/json' };
    if (this.token) headers.Authorization = `Bearer ${this.token}`;
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    let res;
    try {
      res = await fetch(this.base + p, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
    } catch (e) {
      throw new Error(`cannot reach registry ${this.base} (${e.cause?.code || e.message}). Is it running? Try: skillyard serve`);
    }
    const ct = res.headers.get('content-type') || '';
    const data = ct.includes('application/json') && !(raw && res.ok) ? await res.json() : await res.text();
    if (!res.ok) throw new Error(typeof data === 'object' ? data.error : `${res.status} ${data}`);
    return data;
  }

  // MCP registry interface
  async search(opts = {}) {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(opts)) if (v !== undefined && v !== '') qs.set(k, v);
    return (await this.request('GET', `/api/skills?${qs}`)).skills;
  }
  get(scope, name, version = 'latest') {
    return this.request('GET', `/api/skills/@${scope}/${name}?version=${encodeURIComponent(version)}`);
  }
  readFile(scope, name, version, rel) {
    const p = rel.split('/').map(encodeURIComponent).join('/');
    return this.request('GET', `/api/skills/@${scope}/${name}/files/${p}?version=${encodeURIComponent(version || 'latest')}`, undefined, { raw: true });
  }

  bundle(scope, name, version = 'latest') {
    return this.request('GET', `/api/skills/@${scope}/${name}/bundle?version=${encodeURIComponent(version)}`);
  }
  publish(scope, files, visibility) {
    const enc = {};
    for (const [k, v] of Object.entries(files)) enc[k] = v.toString('base64');
    return this.request('POST', `/api/skills/@${scope}`, { files: enc, visibility });
  }
}
