// skillyard command-line interface.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import readline from 'node:readline';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { Store } from './store.js';
import { createServer } from './server.js';
import { createMcpHandler } from './mcp.js';
import { AGENTS, detectAgents, installBundle, listInstalled, resolveAgents, uninstall, writeAgentsIndex } from './agents.js';
import { loadConfig, RemoteRegistry, saveConfig } from './client.js';
import { scanFiles } from './scan.js';
import { evalSkill, evalMarkdown } from './eval.js';
import { parseSkillRef, readSkillDir, titleCase, validateFiles, NAME_RE } from './skill.js';

const BIN = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'bin', 'skillyard.js');
const REPO_ROOT = path.resolve(path.dirname(BIN), '..');
const ADMIN = { admin: true, org: null, scopes: ['read', 'publish', 'admin'], tokenId: 'cli' };

const HELP = `skillyard — a skill registry for AI agents (Claude Code, Codex, Cursor, any AGENTS.md agent)

Using skills
  search [query] [--scope org] [--category c]   Find skills
  info <skill>                                   Show a skill's details and instructions
  install <skill...> [--agent a,b|all] [-g]      Install into agents (default: detected agents, else claude)
                     [--save] [--force]          --save records it in ./skills.json
  uninstall <name...> [--agent a,b|all] [-g]     Remove installed skills
  list [--agent a,b|all] [-g]                    Show installed skills
  update [--agent a,b|all] [-g]                  Reinstall the newest version of every installed skill
  init                                           Create ./skills.json (a project's skill manifest)
  sync                                           Install everything in ./skills.json for its agents

Connecting agents over MCP
  connect <claude|codex|cursor|vscode|gemini|claude-desktop> [--write]
                                                 Print (or write) the MCP config for an agent
  mcp                                            Run a stdio MCP server against the configured registry

Account
  login --registry <url> [--token <token>]       Save registry URL and token (~/.skillyard/config.json)
  whoami                                         Show who the token belongs to

Authoring
  new <name> [--dir .]                           Scaffold a new skill
  validate <dir...>                              Check skill directories (or folders of them)
  scan <dir...> [--json out.json] [--all]        Security-scan every skill found under the given folders
  eval <dir...> [--agent claude|codex] [--model m] [--runs n] [--out report.md]
                                                 Measure lift: run evals/evals.json with and without the skill
  publish <dir> --org <org> [--visibility public|private]

Running a registry
  serve [--port 7420] [--host 127.0.0.1] [--data ./data] [--log]
  seed [--data ./data]                           Load registry/public and seed/orgs demo content
  org create <slug> [--name "Acme"] [--data ./data]
  token create --org <org> [--scopes read,publish] [--name n] [--data ./data]
  token list --org <org> | token revoke <id>
  export site --out <dir> [--data ./data]       Static read-only demo of a registry (for GitHub Pages)
  export claude-marketplace --out <dir> [--from <dir> | --scope <org>]
                                                 Build a Claude Code plugin marketplace from skills

Env: SKILLYARD_REGISTRY, SKILLYARD_TOKEN, SKILLYARD_ADMIN_TOKEN (server), SKILLYARD_DATA (server data dir)
`;

export async function main(argv) {
  const { _: args, ...flags } = parseArgs(argv);
  const cmd = args.shift();
  const cmds = {
    serve, seed, org, token, login, whoami, search, info, install, uninstall: uninstallCmd, list, update, init, sync,
    new: scaffold, validate, scan: scanCmd, eval: evalCmd, publish, connect, mcp, export: exportCmd,
  };
  if (!cmd || cmd === 'help' || flags.help) return void process.stdout.write(HELP);
  if (cmd === '--version' || cmd === 'version') return void console.log('0.1.0');
  if (!cmds[cmd]) throw new Error(`unknown command "${cmd}". Run skillyard help.`);
  await cmds[cmd](args, flags);
}

function parseArgs(argv) {
  const out = { _: [] };
  const alias = { g: 'global', a: 'agent', h: 'help', f: 'force' };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const [k, v] = a.slice(2).split(/=(.*)/s);
      if (v !== undefined) out[k] = v;
      else if (argv[i + 1] !== undefined && !argv[i + 1].startsWith('-')) out[k] = argv[++i];
      else out[k] = true;
    } else if (/^-[a-z]$/.test(a)) {
      const k = alias[a[1]] || a[1];
      if (k === 'agent' && argv[i + 1] && !argv[i + 1].startsWith('-')) out[k] = argv[++i];
      else out[k] = true;
    } else out._.push(a);
  }
  return out;
}

const dataDir = (f) => f.data || process.env.SKILLYARD_DATA || 'data';
const registry = () => new RemoteRegistry(loadConfig());

// ---- server ---------------------------------------------------------------

async function serve(_args, f) {
  const port = Number(f.port || process.env.PORT || 7420);
  const host = f.host || process.env.HOST || '127.0.0.1';
  const allowedOrigins = (process.env.SKILLYARD_ALLOWED_ORIGINS || '').split(',').filter(Boolean);
  const server = createServer({ dataDir: dataDir(f), allowedOrigins, log: !!f.log });
  const stats = server.store.stats({ admin: true, scopes: ['read'] });
  await new Promise((r) => server.listen(port, host, r));
  console.log(`skillyard registry on http://${host}:${port}  (${stats.skills} skills, data: ${server.store.dataDir})`);
  console.log(`  web: http://${host === '0.0.0.0' ? 'localhost' : host}:${port}   mcp: http://${host === '0.0.0.0' ? 'localhost' : host}:${port}/mcp`);
  if (!stats.skills) console.log('  registry is empty: run `skillyard seed` to load the bundled skills');
}

async function seed(_args, f) {
  const store = new Store(dataDir(f));
  const report = [];
  const ensureOrg = (o) => store.getOrg(o.slug) || store.createOrg(o);
  const publishDir = (scope, dir, defaultVisibility) => {
    const files = readSkillDir(dir);
    const v = validateFiles(files);
    if (!v.ok) { report.push(`  skip ${dir}: ${v.errors.join('; ')}`); return 0; }
    const existing = store.db.skills[`@${scope}/${v.manifest.name}`];
    if (existing?.versions[v.manifest.version]) return 0;
    store.publish({ scope, files, visibility: v.manifest.visibility || defaultVisibility, auth: ADMIN, publishedBy: 'seed' });
    return 1;
  };
  const skillDirs = (root) => (fs.existsSync(root) ? fs.readdirSync(root).map((d) => path.join(root, d)).filter((d) => fs.existsSync(path.join(d, 'SKILL.md'))) : []);

  ensureOrg({ slug: 'skillyard', name: 'Skillyard Community', description: 'Open-source skills maintained by the community.', website: 'https://github.com/agentwik-labs/skillyard' });
  let n = 0;
  for (const d of skillDirs(path.join(REPO_ROOT, 'registry', 'public'))) n += publishDir('skillyard', d, 'public');
  report.unshift(`@skillyard: ${n} new skill version(s)`);

  const tokens = {};
  const orgRoot = path.join(REPO_ROOT, 'seed', 'orgs');
  for (const slug of fs.existsSync(orgRoot) ? fs.readdirSync(orgRoot) : []) {
    const orgFile = path.join(orgRoot, slug, 'org.json');
    if (!fs.existsSync(orgFile)) continue;
    const meta = JSON.parse(fs.readFileSync(orgFile, 'utf8'));
    const fresh = !store.getOrg(meta.slug);
    ensureOrg(meta);
    let c = 0;
    for (const d of skillDirs(path.join(orgRoot, slug, 'skills'))) c += publishDir(meta.slug, d, 'private');
    report.push(`@${meta.slug}: ${c} new skill version(s)`);
    if (fresh) tokens[meta.slug] = store.createToken({ org: meta.slug, name: 'demo', scopes: ['read', 'publish'] }).token;
  }
  if (Object.keys(tokens).length) {
    const p = path.join(store.dataDir, 'demo-tokens.json');
    const prev = fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : {};
    fs.writeFileSync(p, JSON.stringify({ ...prev, ...tokens }, null, 2), { mode: 0o600 });
    report.push(`demo org tokens (read+publish) saved to ${p}:`);
    for (const [o, t] of Object.entries(tokens)) report.push(`  ${o}: ${t}`);
  }
  console.log(report.join('\n'));
}

async function org(args, f) {
  const sub = args.shift();
  if (sub !== 'create' || !args[0]) throw new Error('usage: skillyard org create <slug> [--name "Acme"] [--description ...]');
  const store = new Store(dataDir(f));
  const o = store.createOrg({ slug: args[0], name: f.name, description: f.description || '', website: f.website || '' });
  const t = store.createToken({ org: o.slug, name: 'owner', scopes: ['read', 'publish'] });
  console.log(`created org @${o.slug}\nowner token (read+publish), shown once:\n  ${t.token}`);
}

async function token(args, f) {
  const sub = args.shift();
  const store = new Store(dataDir(f));
  if (sub === 'create') {
    if (!f.org && !f.admin) throw new Error('usage: skillyard token create --org <org> [--scopes read,publish] | --admin');
    const scopes = f.admin ? ['admin', 'read', 'publish'] : String(f.scopes || 'read').split(',');
    const t = store.createToken({ org: f.admin ? null : f.org, name: f.name || 'token', scopes });
    console.log(`token ${t.id} (${t.scopes.join(',')}${t.org ? ` for @${t.org}` : ', admin'}), shown once:\n  ${t.token}`);
  } else if (sub === 'list') {
    for (const t of store.listTokens(f.org || null)) console.log(`${t.id}  ${t.name.padEnd(16)} ${t.scopes.join(',').padEnd(14)} created ${t.createdAt.slice(0, 10)}  last used ${t.lastUsedAt?.slice(0, 10) || 'never'}`);
  } else if (sub === 'revoke' && args[0]) {
    store.revokeToken(args[0]);
    console.log(`revoked ${args[0]}`);
  } else throw new Error('usage: skillyard token create|list|revoke');
}

// ---- account --------------------------------------------------------------

async function login(_args, f) {
  const cur = loadConfig();
  const cfg = { registry: (f.registry || cur.registry).replace(/\/+$/, ''), token: f.token === true ? null : (f.token || cur.token) };
  const who = await new RemoteRegistry(cfg).request('GET', '/api/whoami');
  const p = saveConfig(cfg);
  console.log(`saved ${p}\nregistry ${cfg.registry} — ${describeAuth(who)}`);
}

async function whoami() {
  const cfg = loadConfig();
  const who = await new RemoteRegistry(cfg).request('GET', '/api/whoami');
  console.log(`registry ${cfg.registry} — ${describeAuth(who)}`);
}

const describeAuth = (w) => (w.anonymous ? 'anonymous (public skills only)' : w.admin ? 'admin' : `@${w.org} (${w.scopes.join(', ')})`);

// ---- browsing -------------------------------------------------------------

async function search(args, f) {
  const results = await registry().search({ q: args.join(' '), scope: f.scope, category: f.category, limit: f.limit || 50 });
  if (!results.length) return console.log('no skills found');
  const w = Math.max(...results.map((r) => r.id.length));
  for (const s of results) console.log(`${s.id.padEnd(w)}  ${s.visibility === 'private' ? 'private ' : '        '}${s.category.padEnd(12)} ${s.summary}`);
}

async function info(args) {
  const ref = mustRef(args[0]);
  const s = await registry().get(ref.scope, ref.name, ref.version);
  console.log(`${s.id}@${s.version}  ${s.visibility}  ${s.category}  ${s.license || ''}
${s.title} — ${s.summary}
tags: ${s.tags.join(', ') || '-'}   versions: ${s.versions.join(', ')}   downloads: ${s.downloads}
files: ${s.files.join(', ')}
install: npx skillyard install ${s.scope === 'skillyard' ? s.name : s.id}

${s.skillMd}`);
}

function mustRef(r) {
  const ref = parseSkillRef(r);
  if (!ref) throw new Error(`invalid skill "${r || ''}" (use name, @org/name or @org/name@version)`);
  return ref;
}

// ---- install --------------------------------------------------------------

function pickAgents(f) {
  if (f.agent) return resolveAgents(f.agent);
  const detected = detectAgents(process.cwd());
  return detected.length ? detected : ['claude'];
}

async function install(args, f) {
  if (!args.length) throw new Error('usage: skillyard install <skill...> [--agent claude,codex,cursor,agents|all] [-g]');
  const agents = pickAgents(f);
  const reg = registry();
  for (const r of args) {
    const ref = mustRef(r);
    const b = await reg.bundle(ref.scope, ref.name, ref.version);
    for (const a of agents) {
      const dir = installBundle(a, b, { global: !!f.global, force: !!f.force });
      console.log(`installed ${b.id}@${b.version} for ${AGENTS[a].label} → ${tilde(dir)}`);
    }
    if (f.save) {
      const m = readManifest() || newManifest(agents);
      m.skills[ref.scope === 'skillyard' ? ref.name : `@${ref.scope}/${ref.name}`] = ref.version === 'latest' ? `^${b.version}` : ref.version;
      writeManifest(m);
    }
  }
}

async function uninstallCmd(args, f) {
  const agents = f.agent ? resolveAgents(f.agent) : Object.keys(AGENTS);
  for (const name of args) {
    const ref = mustRef(name);
    let any = false;
    for (const a of agents) if (uninstall(a, ref.name, { global: !!f.global })) { any = true; console.log(`removed ${ref.name} from ${AGENTS[a].label}`); }
    if (!any) console.log(`${ref.name} is not installed`);
    const m = readManifest();
    if (m) {
      delete m.skills[name];
      delete m.skills[`@${ref.scope}/${ref.name}`];
      writeManifest(m);
    }
  }
}

async function list(_args, f) {
  const agents = f.agent ? resolveAgents(f.agent) : Object.keys(AGENTS);
  let n = 0;
  for (const a of agents) {
    const items = listInstalled(a, { global: !!f.global });
    if (!items.length) continue;
    console.log(`${AGENTS[a].label}${f.global && !AGENTS[a].projectOnly ? ' (global)' : ''}:`);
    for (const s of items) console.log(`  ${s.id}@${s.version}  ${tilde(s.dir)}`);
    n += items.length;
  }
  if (!n) console.log(`no skills installed${f.global ? ' globally' : ' in this project'} (try -g, or skillyard install <skill>)`);
}

async function update(_args, f) {
  const agents = f.agent ? resolveAgents(f.agent) : Object.keys(AGENTS);
  const reg = registry();
  for (const a of agents) {
    for (const s of listInstalled(a, { global: !!f.global })) {
      const ref = parseSkillRef(s.id);
      const b = await reg.bundle(ref.scope, ref.name, 'latest');
      if (b.checksum === s.checksum) continue;
      installBundle(a, b, { global: !!f.global, force: true });
      console.log(`updated ${s.id} ${s.version} → ${b.version} (${AGENTS[a].label})`);
    }
  }
  console.log('up to date');
}

const MANIFEST = 'skills.json';
const newManifest = (agents) => ({ $schema: 'https://skillyard.dev/schema/skills.json', registry: loadConfig().registry, agents, skills: {} });
const readManifest = () => (fs.existsSync(MANIFEST) ? JSON.parse(fs.readFileSync(MANIFEST, 'utf8')) : null);
const writeManifest = (m) => fs.writeFileSync(MANIFEST, `${JSON.stringify(m, null, 2)}\n`);

async function init(_args, f) {
  if (readManifest()) return console.log('skills.json already exists');
  writeManifest(newManifest(pickAgents(f)));
  console.log('created skills.json — add skills with: skillyard install <skill> --save');
}

async function sync(_args, f) {
  const m = readManifest();
  if (!m) throw new Error('no skills.json here (run skillyard init)');
  const cfg = loadConfig();
  const reg = new RemoteRegistry({ registry: process.env.SKILLYARD_REGISTRY || m.registry || cfg.registry, token: cfg.token });
  const agents = f.agent ? resolveAgents(f.agent) : resolveAgents((m.agents || ['claude']).join(','));
  for (const [r, spec] of Object.entries(m.skills || {})) {
    const ref = mustRef(r);
    const b = await reg.bundle(ref.scope, ref.name, spec);
    for (const a of agents) {
      const have = listInstalled(a).find((s) => s.id === b.id);
      if (have?.checksum === b.checksum) continue;
      installBundle(a, b, { force: !!f.force });
      console.log(`installed ${b.id}@${b.version} for ${AGENTS[a].label}`);
    }
  }
  if (agents.includes('agents')) writeAgentsIndex(process.cwd());
  console.log(`synced ${Object.keys(m.skills || {}).length} skill(s) for ${agents.join(', ')}`);
}

// ---- MCP --------------------------------------------------------------------

async function mcp() {
  const handle = createMcpHandler(registry());
  const rl = readline.createInterface({ input: process.stdin });
  rl.on('line', async (line) => {
    if (!line.trim()) return;
    let msg;
    try { msg = JSON.parse(line); } catch {
      process.stdout.write(`${JSON.stringify({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'parse error' } })}\n`);
      return;
    }
    const res = await handle(msg);
    if (res) process.stdout.write(`${JSON.stringify(res)}\n`);
  });
  await new Promise((r) => rl.on('close', r));
}

async function connect(args, f) {
  const agent = args[0];
  const cfg = loadConfig();
  const url = `${cfg.registry}/mcp`;
  const fromCheckout = !BIN.includes(`${path.sep}node_modules${path.sep}`);
  const stdio = fromCheckout ? { command: 'node', args: [BIN, 'mcp'] } : { command: 'npx', args: ['-y', 'skillyard', 'mcp'] };
  const tokenNote = cfg.token
    ? 'Your token is read from the SKILLYARD_TOKEN environment variable; export it in your shell profile:\n  export SKILLYARD_TOKEN=<your token>'
    : 'No token configured: only public skills will be visible. Run `skillyard login --token ...` for private skills.';
  const configs = {
    claude: () => {
      const cmd = ['claude', 'mcp', 'add', '--transport', 'http', '--scope', 'user', 'skillyard', url];
      if (cfg.token) cmd.push('--header', `Authorization: Bearer ${cfg.token}`);
      if (f.write) {
        const r = spawnSync(cmd[0], cmd.slice(1), { stdio: 'inherit' });
        if (r.error) throw new Error('`claude` not found on PATH; run the command below by hand');
        return null;
      }
      return `Run:\n  ${cmd.map(shq).join(' ')}\n\nOr, for a project, add to .mcp.json (commit-safe, token from env):\n${JSON.stringify({ mcpServers: { skillyard: { type: 'http', url, headers: { Authorization: 'Bearer ${SKILLYARD_TOKEN}' } } } }, null, 2)}`;
    },
    codex: () => {
      const file = path.join(os.homedir(), '.codex', 'config.toml');
      const block = `\n[mcp_servers.skillyard]\nurl = "${url}"\n${cfg.token ? 'bearer_token_env_var = "SKILLYARD_TOKEN"\n' : ''}`;
      const alt = `\n# or, over stdio:\n# [mcp_servers.skillyard]\n# command = "${stdio.command}"\n# args = ${JSON.stringify(stdio.args)}\n# env = { SKILLYARD_REGISTRY = "${cfg.registry}" }\n`;
      if (f.write) return appendToml(file, block);
      return `Add to ${tilde(file)}:\n${block}${alt}\n${tokenNote}`;
    },
    cursor: () => writeOrPrintJson(path.join(process.cwd(), '.cursor', 'mcp.json'), ['mcpServers', 'skillyard'],
      { url, ...(cfg.token ? { headers: { Authorization: 'Bearer ${env:SKILLYARD_TOKEN}' } } : {}) }, f.write, tokenNote),
    vscode: () => writeOrPrintJson(path.join(process.cwd(), '.vscode', 'mcp.json'), ['servers', 'skillyard'],
      { type: 'http', url, ...(cfg.token ? { headers: { Authorization: 'Bearer ${env:SKILLYARD_TOKEN}' } } : {}) }, f.write, tokenNote),
    gemini: () => writeOrPrintJson(path.join(os.homedir(), '.gemini', 'settings.json'), ['mcpServers', 'skillyard'],
      { httpUrl: url, ...(cfg.token ? { headers: { Authorization: 'Bearer $SKILLYARD_TOKEN' } } : {}) }, f.write, tokenNote),
    'claude-desktop': () => {
      const file = process.platform === 'darwin'
        ? path.join(os.homedir(), 'Library', 'Application Support', 'Claude', 'claude_desktop_config.json')
        : path.join(os.homedir(), '.config', 'Claude', 'claude_desktop_config.json');
      return writeOrPrintJson(file, ['mcpServers', 'skillyard'],
        { ...stdio, env: { SKILLYARD_REGISTRY: cfg.registry, ...(cfg.token ? { SKILLYARD_TOKEN: cfg.token } : {}) } }, f.write, '');
    },
  };
  if (!configs[agent]) throw new Error(`usage: skillyard connect <${Object.keys(configs).join('|')}> [--write]`);
  const out = configs[agent]();
  if (out) console.log(out);
}

function writeOrPrintJson(file, keyPath, value, write, note) {
  if (!write) {
    const obj = {};
    obj[keyPath[0]] = { [keyPath[1]]: value };
    return `Add to ${tilde(file)}:\n${JSON.stringify(obj, null, 2)}${note ? `\n\n${note}` : ''}`;
  }
  const cur = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8') || '{}') : {};
  cur[keyPath[0]] = { ...(cur[keyPath[0]] || {}), [keyPath[1]]: value };
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(cur, null, 2)}\n`);
  return `wrote skillyard MCP server to ${tilde(file)}${note ? `\n${note}` : ''}`;
}

function appendToml(file, block) {
  const cur = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
  if (/^\[mcp_servers\.skillyard\]/m.test(cur)) return `${tilde(file)} already has [mcp_servers.skillyard]; edit it by hand`;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, cur + block);
  return `added [mcp_servers.skillyard] to ${tilde(file)}`;
}

// ---- authoring ------------------------------------------------------------

async function scaffold(args, f) {
  const name = args[0];
  if (!name || !NAME_RE.test(name)) throw new Error('usage: skillyard new <lowercase-hyphenated-name>');
  const dir = path.resolve(f.dir || '.', name);
  if (fs.existsSync(dir)) throw new Error(`${dir} already exists`);
  fs.mkdirSync(path.join(dir, 'references'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'SKILL.md'), `---
name: ${name}
description: TODO what this skill does and when to use it. Include the phrases a user would say, e.g. "review this", "draft the release notes".
license: MIT
---

# ${titleCase(name)}

TODO one paragraph: the job, and what good looks like.

## Workflow

1. TODO
2. TODO
3. TODO

## Rules

- TODO a rule, and why it exists.

## Output

TODO exactly what the agent should produce. Put long detail in references/ and link it, e.g. [details](references/details.md).
`);
  fs.writeFileSync(path.join(dir, 'references', 'details.md'), '# Details\n\nTODO\n');
  fs.writeFileSync(path.join(dir, 'skill.json'), `${JSON.stringify({
    name, version: '0.1.0', title: titleCase(name), summary: 'TODO one sentence for the registry card', category: 'engineering', tags: [], license: 'MIT', author: '',
  }, null, 2)}\n`);
  console.log(`created ${dir}\nedit SKILL.md, then: skillyard validate ${path.relative(process.cwd(), dir) || '.'} && skillyard publish ${path.relative(process.cwd(), dir) || '.'} --org <org>`);
}

async function validate(args) {
  const dirs = [];
  for (const a of args.length ? args : ['.']) {
    if (fs.existsSync(path.join(a, 'SKILL.md'))) dirs.push(a);
    else if (fs.existsSync(a) && fs.statSync(a).isDirectory()) {
      for (const d of fs.readdirSync(a)) if (fs.existsSync(path.join(a, d, 'SKILL.md'))) dirs.push(path.join(a, d));
    }
  }
  if (!dirs.length) throw new Error('no skill directories found');
  let bad = 0;
  for (const d of dirs) {
    const files = readSkillDir(d);
    const v = validateFiles(files);
    const scan = scanFiles(files);
    for (const x of scan.findings) (x.severity === 'critical' ? v.errors : v.warnings).push(`security: ${x.file}:${x.line} ${x.message} [${x.rule}]`);
    if (scan.critical) v.ok = false;
    if (v.manifest && path.basename(path.resolve(d)) !== v.manifest.name) v.warnings.push(`directory name differs from skill name "${v.manifest.name}"`);
    const tag = v.ok ? (v.warnings.length ? 'warn' : 'ok  ') : 'FAIL';
    if (!v.ok) bad++;
    console.log(`${tag} ${d}${[...v.errors, ...v.warnings].map((m) => `\n     - ${m}`).join('')}`);
  }
  console.log(`\n${dirs.length - bad}/${dirs.length} valid`);
  if (bad) process.exitCode = 1;
}

async function scanCmd(args, f) {
  const found = [];
  const walk = (dir, depth) => {
    if (depth > 8) return;
    let ents;
    try { ents = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    if (ents.some((e) => e.isFile() && e.name === 'SKILL.md')) { found.push(dir); return; }
    for (const e of ents) if (e.isDirectory() && !['.git', 'node_modules', '__pycache__', '.venv', 'dist', 'build'].includes(e.name)) walk(path.join(dir, e.name), depth + 1);
  };
  for (const a of args.length ? args : ['.']) walk(path.resolve(a), 0);
  const results = found.map((dir) => {
    const files = readSkillDir(dir);
    const v = validateFiles(files);
    const s = scanFiles(files);
    return { dir, name: v.manifest?.name || path.basename(dir), valid: v.ok, errors: v.errors, files: Object.keys(files).length, scripts: Object.keys(files).filter((x) => /\.(py|sh|js|mjs|cjs|ts|rb|ps1)$/.test(x)).length, ...s };
  });
  const sum = {
    skills: results.length,
    withCritical: results.filter((r) => r.critical).length,
    withWarning: results.filter((r) => r.warning).length,
    withScripts: results.filter((r) => r.scripts).length,
    invalid: results.filter((r) => !r.valid).length,
    byRule: {},
  };
  for (const r of results) for (const x of r.findings) sum.byRule[`${x.severity}:${x.rule}`] = (sum.byRule[`${x.severity}:${x.rule}`] || 0) + 1;
  if (f.json) fs.writeFileSync(f.json, JSON.stringify({ scannedAt: new Date().toISOString(), summary: sum, results }, null, 2));
  for (const r of results) {
    if (!r.critical && !(f.all && r.warning)) continue;
    console.log(`${r.critical ? 'CRIT' : 'warn'} ${tilde(r.dir)}`);
    for (const x of r.findings.filter((y) => f.all || y.severity === 'critical')) console.log(`     ${x.severity.padEnd(8)} ${x.file}:${x.line} ${x.message} [${x.rule}]`);
  }
  console.log(`\n${sum.skills} skills scanned: ${sum.withCritical} with critical findings, ${sum.withWarning} with warnings, ${sum.withScripts} ship scripts, ${sum.invalid} fail the format check`);
  if (sum.withCritical) process.exitCode = 1;
}

async function evalCmd(args, f) {
  if (!args.length) throw new Error('usage: skillyard eval <skill-dir...> [--agent claude|codex] [--model haiku] [--runs 1] [--out report.md]');
  const reports = [];
  for (const dir of args) {
    reports.push(await evalSkill(dir, { agent: f.agent || 'claude', model: f.model, runs: Number(f.runs) || 1, log: (l) => console.log(l) }));
  }
  const md = evalMarkdown(reports);
  console.log(`\n${md.split('\n<details>')[0]}`);
  if (f.out) {
    fs.writeFileSync(f.out, `${md}\n`);
    fs.writeFileSync(f.out.replace(/\.md$/, '') + '.json', JSON.stringify(reports, null, 2));
    console.log(`wrote ${f.out}`);
  }
}

async function publish(args, f) {
  const dir = args[0] || '.';
  if (!f.org) throw new Error('usage: skillyard publish <dir> --org <org> [--visibility public|private]');
  const files = readSkillDir(dir);
  const v = validateFiles(files);
  if (!v.ok) throw new Error(`invalid skill:\n  - ${v.errors.join('\n  - ')}`);
  const r = await registry().publish(f.org, files, f.visibility);
  console.log(`published ${r.id}@${v.manifest.version} (${r.visibility})${r.warnings?.length ? `\nwarnings:\n  - ${r.warnings.join('\n  - ')}` : ''}`);
}

// ---- export ---------------------------------------------------------------

async function exportCmd(args, f) {
  if (args[0] === 'site') return exportSite(f);
  if (args[0] !== 'claude-marketplace' || !f.out) throw new Error('usage: skillyard export claude-marketplace --out <dir> [--from <dir> | --scope <org>] [--name n]');
  const out = path.resolve(f.out);
  const skills = []; // { name, category, version, description, files: {rel: Buffer} }
  if (f.scope) {
    const reg = registry();
    for (const s of await reg.search({ scope: f.scope, limit: 500 })) {
      const b = await reg.bundle(s.scope, s.name, 'latest');
      const files = {};
      for (const [k, v] of Object.entries(b.files)) files[k] = Buffer.from(v, 'base64');
      skills.push({ name: s.name, category: s.category, version: b.version, description: s.description, files });
    }
  } else {
    const from = path.resolve(f.from || path.join(REPO_ROOT, 'registry', 'public'));
    for (const d of fs.readdirSync(from)) {
      const dir = path.join(from, d);
      if (!fs.existsSync(path.join(dir, 'SKILL.md'))) continue;
      const files = readSkillDir(dir);
      const v = validateFiles(files);
      if (!v.ok) { console.error(`skip ${d}: ${v.errors.join('; ')}`); continue; }
      skills.push({ name: v.manifest.name, category: v.manifest.category, version: v.manifest.version, description: v.manifest.description, files });
    }
  }
  const name = f.name || (f.scope ? `${f.scope}-skills` : 'skillyard');
  const byCat = {};
  for (const s of skills) (byCat[s.category] ||= []).push(s);
  const pluginsDir = path.join(out, 'plugins');
  fs.rmSync(pluginsDir, { recursive: true, force: true });
  const plugins = [];
  for (const [cat, list] of Object.entries(byCat).sort()) {
    const pname = `${name}-${cat}`;
    const pdir = path.join(pluginsDir, cat);
    fs.mkdirSync(path.join(pdir, '.claude-plugin'), { recursive: true });
    const description = `${({ ai: "AI", devops: "DevOps" })[cat] || titleCase(cat)} skills: ${list.map((s) => s.name).sort().join(', ')}`;
    fs.writeFileSync(path.join(pdir, '.claude-plugin', 'plugin.json'), `${JSON.stringify({ name: pname, description, version: '1.0.0', author: { name: f.scope ? f.scope : 'Skillyard Community' } }, null, 2)}\n`);
    for (const s of list) {
      for (const [rel, buf] of Object.entries(s.files)) {
        const dest = path.join(pdir, 'skills', s.name, rel);
        fs.mkdirSync(path.dirname(dest), { recursive: true });
        fs.writeFileSync(dest, buf);
      }
    }
    plugins.push({ name: pname, source: `./plugins/${cat}`, description, version: '1.0.0', category: cat });
  }
  fs.mkdirSync(path.join(out, '.claude-plugin'), { recursive: true });
  fs.writeFileSync(path.join(out, '.claude-plugin', 'marketplace.json'), `${JSON.stringify({
    name,
    owner: { name: f.scope ? f.scope : 'Skillyard Community' },
    metadata: { description: f.scope ? `Private skills for @${f.scope}, exported from Skillyard` : 'Open-source Agent Skills from Skillyard', version: '1.0.0' },
    plugins,
  }, null, 2)}\n`);
  console.log(`wrote ${plugins.length} plugin(s) with ${skills.length} skill(s) to ${tilde(out)}\nadd it in Claude Code: /plugin marketplace add <git repo or path>`);
}

async function exportSite(f) {
  if (!f.out) throw new Error('usage: skillyard export site --out <dir> [--data ./data]');
  const store = new Store(dataDir(f));
  const out = path.resolve(f.out);
  const webDir = path.join(REPO_ROOT, 'web');
  fs.rmSync(out, { recursive: true, force: true });
  fs.mkdirSync(path.join(out, 'api'), { recursive: true });
  for (const file of fs.readdirSync(webDir)) fs.copyFileSync(path.join(webDir, file), path.join(out, file));
  fs.writeFileSync(path.join(out, 'static.js'), 'window.SKILLYARD_STATIC = true;\n');
  fs.writeFileSync(path.join(out, '.nojekyll'), '');
  const all = store.search({ limit: 10000 }, ADMIN).map(({ score, ...s }) => s);
  const orgs = Object.values(store.db.orgs).map(({ slug, name, description, website }) => ({ slug, name, description, website }));
  fs.writeFileSync(path.join(out, 'api', 'index.json'), JSON.stringify({ exportedAt: new Date().toISOString(), orgs, skills: all }));
  for (const s of all) {
    const info = store.get(s.scope, s.name, 'latest', ADMIN);
    const dir = path.join(out, 'api', 'skills', `@${s.scope}`);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, `${s.name}.json`), JSON.stringify(info));
    for (const rel of info.files) {
      const dest = path.join(dir, s.name, 'files', rel);
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.writeFileSync(dest, store.readFile(s.scope, s.name, 'latest', rel, ADMIN));
    }
  }
  console.log(`wrote static site with ${all.length} skills to ${tilde(out)}`);
}

// ---- helpers --------------------------------------------------------------

function tilde(p) {
  const h = os.homedir();
  const rel = path.relative(process.cwd(), p);
  if (!rel.startsWith('..') && !path.isAbsolute(rel)) return rel || '.';
  return p.startsWith(h) ? `~${p.slice(h.length)}` : p;
}

const shq = (s) => (/^[\w@%+=:,./-]+$/.test(s) ? s : `'${s.replace(/'/g, "'\\''")}'`);
