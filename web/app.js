// Skillyard web UI: hash-routed, no build step, no dependencies.
const app = document.getElementById('app');
const ORIGIN = window.SKILLYARD_STATIC ? 'https://skills.your-company.com' : location.origin;
const CATEGORY_LABELS = {
  engineering: 'Engineering', devops: 'DevOps', testing: 'Testing', security: 'Security', data: 'Data', docs: 'Docs',
  product: 'Product', ai: 'AI', support: 'Support', sales: 'Sales', compliance: 'Compliance', people: 'People', other: 'Other',
};

// ---- state & api -------------------------------------------------------------

const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { v === null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch { /* storage unavailable */ } },
};
let token = store.get('skillyard.token');
let me = { anonymous: true };

// Static mode (GitHub Pages demo): the same UI reads a pre-exported JSON snapshot and fakes sign-in for the
// fictional demo companies, so visitors can see how private skills look without a server.
const STATIC = !!window.SKILLYARD_STATIC;
let snapshot;
async function staticApi(path) {
  snapshot ||= await (await fetch('api/index.json')).json();
  const [p, qs = ''] = path.split('?');
  const q = new URLSearchParams(qs);
  const who = token && snapshot.orgs.some((o) => o.slug === token) ? token : null;
  const visible = snapshot.skills.filter((s) => s.visibility === 'public' || s.scope === who);
  const notFound = () => Object.assign(new Error('not found'), { status: 404 });
  if (p === '/api/whoami') return who ? { org: who, scopes: ['read'], admin: false } : { anonymous: true };
  if (p === '/api/stats') {
    const categories = {};
    for (const s of visible) categories[s.category] = (categories[s.category] || 0) + 1;
    return { skills: visible.length, public: visible.filter((s) => s.visibility === 'public').length, private: visible.filter((s) => s.visibility === 'private').length, orgs: new Set(visible.map((s) => s.scope)).size, categories };
  }
  if (p === '/api/skills') {
    const terms = (q.get('q') || '').toLowerCase().split(/\s+/).filter(Boolean);
    const skills = visible.filter((s) => (!q.get('scope') || s.scope === q.get('scope')) && (!q.get('category') || s.category === q.get('category'))
      && terms.every((t) => [s.name, s.title, s.summary, s.description, s.tags.join(' '), s.scope].join(' ').toLowerCase().includes(t)));
    return { skills };
  }
  if (p === '/api/orgs') return { orgs: snapshot.orgs.map((o) => ({ ...o, skillCount: visible.filter((s) => s.scope === o.slug).length, privateCount: visible.filter((s) => s.scope === o.slug && s.visibility === 'private').length })).filter((o) => o.skillCount) };
  let m = /^\/api\/orgs\/([a-z0-9-]+)$/.exec(p);
  if (m) {
    const org = snapshot.orgs.find((o) => o.slug === m[1]);
    if (!org) throw notFound();
    return { ...org, member: who === org.slug, skills: visible.filter((s) => s.scope === org.slug) };
  }
  m = /^\/api\/skills\/@([a-z0-9-]+)\/([a-z0-9-]+)(\/files\/.+)?$/.exec(p);
  if (m && visible.some((s) => s.scope === m[1] && s.name === m[2])) {
    const res = await fetch(`api/skills/@${m[1]}/${m[2]}${m[3] || '.json'}`);
    if (!res.ok) throw notFound();
    return m[3] ? res.text() : res.json();
  }
  throw notFound();
}

async function api(path, opts = {}) {
  if (STATIC) return staticApi(path);
  const headers = { ...(opts.body ? { 'Content-Type': 'application/json' } : {}) };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(path.replace(/^\//, ''), { method: opts.method || 'GET', headers, body: opts.body ? JSON.stringify(opts.body) : undefined });
  const ct = res.headers.get('content-type') || '';
  const data = ct.includes('json') && !opts.raw ? await res.json() : await res.text();
  if (!res.ok) throw Object.assign(new Error(data.error || data || res.statusText), { status: res.status });
  return data;
}

async function refreshMe() {
  try { me = await api('/api/whoami'); } catch (e) {
    if (e.status === 401) { token = null; store.set('skillyard.token', null); }
    me = { anonymous: true };
  }
  const btn = document.getElementById('auth');
  btn.textContent = me.anonymous ? 'Sign in' : me.admin ? 'Admin · Sign out' : `@${me.org} · Sign out`;
}

// ---- helpers -----------------------------------------------------------------

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const h = (strings, ...vals) => strings.reduce((out, s, i) => out + s + (i < vals.length ? (vals[i]?.__html ?? esc(vals[i])) : ''), '');
const raw = (html) => ({ __html: html });
const installRef = (s) => (s.scope === 'skillyard' ? s.name : s.id);
const skillHref = (s) => `#/skill/${s.id}`;
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : '');

function copyButtons(root) {
  root.querySelectorAll('[data-copy]').forEach((b) => b.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(b.dataset.copy); b.textContent = 'Copied'; } catch { b.textContent = 'Select & copy'; }
    setTimeout(() => { b.textContent = 'Copy'; }, 1400);
  }));
}
const cmd = (text) => h`<div class="cmd"><code>${text}</code><button type="button" data-copy="${text}">Copy</button></div>`;

/** Small, safe Markdown renderer: escapes everything first, then adds a limited set of constructs. */
function markdown(src, linkBase) {
  const lines = src.replace(/\r\n/g, '\n').split('\n');
  const out = [];
  let i = 0;
  const inline = (t) => esc(t)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[\s(])\*([^*\s][^*]*)\*/g, '$1<em>$2</em>')
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_m, label, url) => {
      if (/^https?:\/\//.test(url)) return `<a href="${url}" rel="noopener noreferrer" target="_blank">${label}</a>`;
      if (linkBase && !/^[a-z]+:/i.test(url) && !url.startsWith('#')) return `<a href="${linkBase}${url}">${label}</a>`;
      return label;
    });
  while (i < lines.length) {
    const line = lines[i];
    if (/^```/.test(line)) {
      const buf = [];
      i++;
      while (i < lines.length && !/^```/.test(lines[i])) buf.push(lines[i++]);
      i++;
      out.push(`<pre><code>${esc(buf.join('\n'))}</code></pre>`);
      continue;
    }
    const hm = /^(#{1,4})\s+(.*)$/.exec(line);
    if (hm) { out.push(`<h${hm[1].length}>${inline(hm[2])}</h${hm[1].length}>`); i++; continue; }
    if (/^\s*([-*_])\s*\1\s*\1\s*$/.test(line)) { out.push('<hr>'); i++; continue; }
    if (/^\|/.test(line) && /^\|?\s*:?-+/.test(lines[i + 1] || '')) {
      const cells = (l) => l.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
      const head = cells(line);
      i += 2;
      const rows = [];
      while (i < lines.length && /^\|/.test(lines[i])) rows.push(cells(lines[i++]));
      out.push(`<table><thead><tr>${head.map((c) => `<th>${inline(c)}</th>`).join('')}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${inline(c)}</td>`).join('')}</tr>`).join('')}</tbody></table>`);
      continue;
    }
    if (/^>\s?/.test(line)) {
      const buf = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) buf.push(lines[i++].replace(/^>\s?/, ''));
      out.push(`<blockquote><p>${inline(buf.join(' '))}</p></blockquote>`);
      continue;
    }
    const lm = /^(\s*)([-*+]|\d+[.)])\s+/.exec(line);
    if (lm) {
      const ordered = /\d/.test(lm[2]);
      const items = [];
      while (i < lines.length) {
        const m = /^(\s*)([-*+]|\d+[.)])\s+(.*)$/.exec(lines[i]);
        if (m) { items.push({ depth: m[1].length >= 2 ? 1 : 0, text: m[3] }); i++; }
        else if (/^\s{2,}\S/.test(lines[i]) && items.length) { items[items.length - 1].text += ` ${lines[i].trim()}`; i++; }
        else break;
      }
      const tag = ordered ? 'ol' : 'ul';
      out.push(`<${tag}>${items.map((it) => `<li${it.depth ? ' style="margin-left:1.2em"' : ''}>${inline(it.text)}</li>`).join('')}</${tag}>`);
      continue;
    }
    if (!line.trim()) { i++; continue; }
    const buf = [];
    while (i < lines.length && lines[i].trim() && !/^(```|#{1,4}\s|>|\||\s*([-*+]|\d+[.)])\s)/.test(lines[i])) buf.push(lines[i++]);
    if (!buf.length) buf.push(lines[i++]);
    out.push(`<p>${inline(buf.join(' '))}</p>`);
  }
  return out.join('\n');
}

function splitFrontmatter(md) {
  const m = /^---\n([\s\S]*?)\n---\n?/.exec(md.replace(/\r\n/g, '\n'));
  return m ? { fm: m[1], body: md.replace(/\r\n/g, '\n').slice(m[0].length) } : { fm: null, body: md };
}

function card(s) {
  return h`<a class="card" href="${skillHref(s)}">
    <div class="meta"><span class="id">${s.id}</span>${raw(s.visibility === 'private' ? '<span class="badge private">Private</span>' : '')}</div>
    <h3>${s.title}</h3>
    <p>${s.summary}</p>
    <div class="meta"><span class="tag">${CATEGORY_LABELS[s.category] || s.category}</span>${raw(s.tags.slice(0, 3).map((t) => `<span class="tag">${esc(t)}</span>`).join(''))}<span style="margin-left:auto">v${s.latest}</span></div>
  </a>`;
}

// ---- views -------------------------------------------------------------------

async function viewBrowse(params) {
  const q = params.get('q') || '';
  const category = params.get('category') || '';
  const scope = params.get('scope') || '';
  const [stats, { skills }, { orgs }] = await Promise.all([
    api('/api/stats'),
    api(`/api/skills?${new URLSearchParams({ q, category, scope, limit: 300 })}`),
    api('/api/orgs'),
  ]);
  const cats = Object.keys(stats.categories).sort((a, b) => stats.categories[b] - stats.categories[a]);
  const setParam = (k, v) => { const p = new URLSearchParams(params); v ? p.set(k, v) : p.delete(k); location.hash = `#/?${p}`; };
  const mine = !me.anonymous && me.org ? skills.filter((s) => s.scope === me.org) : [];
  const showMine = mine.length && !q && !category && !scope;

  app.innerHTML = h`
    <section class="hero">
      <div>
        <h1>Skills your agents can use, from open source and from your own company.</h1>
        <p>Search ready-made Agent Skills, keep your team's private playbooks next to them, and install either into Claude Code, Codex, Cursor or any AGENTS.md agent with one command. Agents can also search and load skills live over MCP.</p>
      </div>
      <div class="stats" aria-label="Registry stats">
        <div><b>${stats.skills}</b><span>Skills</span></div>
        <div><b>${stats.public}</b><span>Open source</span></div>
        <div><b>${me.anonymous ? orgs.length : stats.private}</b><span>${me.anonymous ? 'Publishers' : 'Private to you'}</span></div>
      </div>
    </section>
    <form class="searchbar" id="search" role="search">
      <input name="q" type="search" value="${q}" placeholder="Search skills: code review, deploy, PCI, postmortem…" aria-label="Search skills">
      <select name="scope" aria-label="Publisher" style="max-width:220px">
        <option value="">All publishers</option>
        ${raw(orgs.map((o) => `<option value="${esc(o.slug)}" ${o.slug === scope ? 'selected' : ''}>@${esc(o.slug)} (${o.skillCount})</option>`).join(''))}
      </select>
      <button class="primary" type="submit">Search</button>
    </form>
    <div class="chips" role="group" aria-label="Categories">
      <button type="button" class="chip ${category ? '' : 'on'}" data-cat="">All</button>
      ${raw(cats.map((c) => `<button type="button" class="chip ${c === category ? 'on' : ''}" data-cat="${esc(c)}">${esc(CATEGORY_LABELS[c] || c)} · ${stats.categories[c]}</button>`).join(''))}
    </div>
    ${raw(showMine ? h`<div class="section-title"><h2>Your organization · @${me.org}</h2><a href="#/orgs/${me.org}" class="muted">Manage</a></div><div class="grid">${raw(mine.map(card).join(''))}</div>` : '')}
    <div class="section-title"><h2>${q || category || scope ? `${skills.length} result${skills.length === 1 ? '' : 's'}` : 'All skills'}</h2>
      ${raw(me.anonymous ? '<span class="muted">Sign in with an org token to see private skills</span>' : '')}</div>
    ${raw(skills.length ? `<div class="grid">${skills.filter((s) => !showMine || s.scope !== me.org).map(card).join('')}</div>` : '<div class="empty">No skills match. Try fewer words.</div>')}
  `;
  document.getElementById('search').addEventListener('submit', (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const p = new URLSearchParams(params);
    for (const k of ['q', 'scope']) fd.get(k) ? p.set(k, fd.get(k)) : p.delete(k);
    location.hash = `#/?${p}`;
  });
  app.querySelectorAll('[data-cat]').forEach((b) => b.addEventListener('click', () => setParam('category', b.dataset.cat)));
}

const INSTALL_TABS = [
  ['claude', 'Claude Code'], ['codex', 'Codex'], ['cursor', 'Cursor'], ['agents', 'AGENTS.md'], ['all', 'All agents'],
];

async function viewSkill(id, filePath) {
  const s = await api(`/api/skills/${id}`);
  const base = `#/skill/${s.id}/file/`;
  let main;
  if (filePath) {
    const text = await api(`/api/skills/${s.id}/files/${filePath.split('/').map(encodeURIComponent).join('/')}`, { raw: true });
    main = filePath.endsWith('.md')
      ? `<article class="md">${markdown(text, base + filePath.replace(/[^/]+$/, ''))}</article>`
      : `<article class="md"><pre><code>${esc(text)}</code></pre></article>`;
  } else {
    const { fm, body } = splitFrontmatter(s.skillMd);
    main = `<article class="md">${fm ? `<div class="frontmatter">${esc(fm)}</div>` : ''}${markdown(body, base)}</article>`;
  }
  const ref = installRef(s);
  app.innerHTML = h`
    <div class="crumbs"><a href="#/">Skills</a> / <a href="#/orgs/${s.scope}">@${s.scope}</a> / ${s.name}${raw(filePath ? ` / <span class="mono">${esc(filePath)}</span>` : '')}</div>
    <div class="detail">
      <div>
        <div class="meta" style="margin-bottom:8px"><span class="badge ${s.visibility}">${s.visibility}</span><span class="tag">${CATEGORY_LABELS[s.category] || s.category}</span>${raw(s.tags.map((t) => `<span class="tag">${esc(t)}</span>`).join(''))}</div>
        <h1>${s.title}</h1>
        <p class="lede">${s.summary}</p>
        ${raw(main)}
      </div>
      <aside>
        <div class="panel">
          <h3>Install</h3>
          <div class="tabs" role="tablist">${raw(INSTALL_TABS.map(([k, l], i) => `<button type="button" role="tab" data-tab="${k}" class="${i === 0 ? 'on' : ''}">${l}</button>`).join(''))}</div>
          <div id="install-cmd">${raw(cmd(`npx skillyard install ${ref} --agent claude`))}</div>
          <p class="muted" style="font-size:13px;margin:10px 0 0">Add <code>-g</code> to install for every project, <code>--save</code> to record it in <code>skills.json</code>.${raw(s.visibility === 'private' ? ' Private: run <code>skillyard login --token …</code> first.' : '')}</p>
        </div>
        <div class="panel">
          <h3>Use over MCP</h3>
          <p class="muted" style="font-size:13px;margin:0 0 8px">Connected agents call <code>get_skill</code> with:</p>
          ${raw(cmd(s.id))}
          <p style="font-size:13px;margin:10px 0 0"><a href="#/connect">Connect an agent →</a></p>
        </div>
        <div class="panel">
          <h3>Security scan</h3>
          ${raw(!s.scan ? '<p class="muted" style="margin:0;font-size:13px">Not scanned.</p>'
            : !s.scan.findings.length ? '<p style="margin:0;font-size:14px"><span class="badge public">Passed</span> No risky patterns in instructions or scripts.</p>'
            : `<p style="margin:0 0 8px;font-size:14px"><span class="badge private">${s.scan.warning} to review</span> No blocking issues.</p><ul class="files">${s.scan.findings.map((f) => `<li title="${esc(f.rule)}">${esc(f.file)}:${f.line} <span class="muted">${esc(f.message)}</span></li>`).join('')}</ul>`)}
        </div>
        <div class="panel">
          <h3>Files</h3>
          <ul class="files">${raw(s.files.map((f) => `<li><a href="${f === 'SKILL.md' ? `#/skill/${esc(s.id)}` : base + esc(f)}">${esc(f)}</a></li>`).join(''))}</ul>
        </div>
        <div class="panel">
          <h3>Details</h3>
          <dl class="kv">
            <dt>Version</dt><dd>${s.version}${raw(s.versions.length > 1 ? ` <span class="muted">(${s.versions.length} versions)</span>` : '')}</dd>
            <dt>Publisher</dt><dd><a href="#/orgs/${s.scope}">@${s.scope}</a></dd>
            <dt>Author</dt><dd>${s.author || '—'}</dd>
            <dt>License</dt><dd>${s.license || '—'}</dd>
            <dt>Updated</dt><dd>${fmtDate(s.publishedAt)}</dd>
            <dt>Installs</dt><dd>${s.downloads}</dd>
            <dt>Checksum</dt><dd class="mono" style="word-break:break-all;font-size:11.5px">${s.checksum.slice(0, 23)}…</dd>
          </dl>
        </div>
      </aside>
    </div>`;
  app.querySelectorAll('[data-tab]').forEach((b) => b.addEventListener('click', () => {
    app.querySelectorAll('[data-tab]').forEach((x) => x.classList.toggle('on', x === b));
    document.getElementById('install-cmd').innerHTML = cmd(`npx skillyard install ${ref} --agent ${b.dataset.tab}`);
    copyButtons(document.getElementById('install-cmd'));
  }));
  copyButtons(app);
}

async function viewOrgs() {
  const { orgs } = await api('/api/orgs');
  app.innerHTML = h`
    <div class="page-head"><h1>Organizations</h1><p>Every skill belongs to a publisher. Community skills live under <code>@skillyard</code>; companies publish under their own scope and choose, per skill, whether it is public or private to their tokens.</p></div>
    <table class="list"><thead><tr><th>Publisher</th><th>About</th><th>Skills</th></tr></thead><tbody>
      ${raw(orgs.map((o) => h`<tr><td><a href="#/orgs/${o.slug}"><strong>@${o.slug}</strong></a><div class="muted" style="font-size:13px">${o.name}</div></td><td>${o.description}</td><td>${o.skillCount}${raw(o.privateCount ? ` <span class="badge private">${o.privateCount} private</span>` : '')}</td></tr>`).join(''))}
    </tbody></table>`;
}

async function viewOrg(slug) {
  const org = await api(`/api/orgs/${slug}`);
  const canManage = !STATIC && (me.admin || (me.org === slug && me.scopes?.includes('publish')));
  app.innerHTML = h`
    <div class="crumbs"><a href="#/orgs">Organizations</a> / @${org.slug}</div>
    <div class="page-head"><h1>${org.name}</h1><p>${org.description}${raw(org.website ? ` · <a href="${esc(org.website)}" rel="noopener noreferrer" target="_blank">${esc(org.website.replace(/^https?:\/\//, ''))}</a>` : '')}</p></div>
    ${raw(!org.member && slug !== 'skillyard' ? '<div class="notice">You are seeing this organization\'s public skills. Members sign in with an org token to see private ones.</div>' : '')}
    <div class="section-title"><h2>Skills · ${org.skills.length}</h2></div>
    ${raw(org.skills.length ? `<div class="grid">${org.skills.map(card).join('')}</div>` : '<div class="empty">No skills visible yet.</div>')}
    ${raw(canManage ? '<div id="manage"></div>' : '')}`;
  if (canManage) renderManage(slug);
}

async function renderManage(slug) {
  const el = document.getElementById('manage');
  const [{ tokens }, { events }] = await Promise.all([api(`/api/orgs/${slug}/tokens`), api(`/api/orgs/${slug}/events`)]);
  el.innerHTML = h`
    <div class="section-title"><h2>Access tokens</h2></div>
    <p class="muted" style="margin-top:-6px">Give each teammate or CI job its own read token; give publish tokens only to maintainers. Tokens are shown once.</p>
    <form id="new-token" class="row" style="margin-bottom:12px">
      <input name="name" placeholder="Name, e.g. laptop-dana or ci" required style="max-width:280px">
      <select name="scopes" style="max-width:200px"><option value="read">read</option><option value="read,publish">read + publish</option></select>
      <button class="primary">Create token</button>
    </form>
    <div id="token-out"></div>
    <table class="list"><thead><tr><th>Name</th><th>Scopes</th><th>Created</th><th>Last used</th><th></th></tr></thead><tbody>
      ${raw(tokens.map((t) => h`<tr><td>${t.name} <span class="muted mono">${t.id}</span></td><td>${t.scopes.join(', ')}</td><td>${fmtDate(t.createdAt)}</td><td>${t.lastUsedAt ? fmtDate(t.lastUsedAt) : 'never'}</td><td><button type="button" class="ghost" data-revoke="${t.id}">Revoke</button></td></tr>`).join(''))}
    </tbody></table>
    <div class="section-title"><h2>Activity</h2></div>
    ${raw(events.length ? `<table class="list"><tbody>${events.slice(0, 30).map((e) => h`<tr><td class="muted">${new Date(e.at).toLocaleString()}</td><td>${e.type}</td><td class="mono">${e.skill ? `${e.skill}${e.version ? `@${e.version}` : ''}` : e.tokenId || ''}</td></tr>`).join('')}</tbody></table>` : '<div class="empty">No activity yet.</div>')}`;
  document.getElementById('new-token').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    try {
      const t = await api(`/api/orgs/${slug}/tokens`, { method: 'POST', body: { name: fd.get('name'), scopes: fd.get('scopes').split(',') } });
      await renderManage(slug);
      document.getElementById('token-out').innerHTML = `<div class="notice">New token for <strong>${esc(t.name)}</strong> — copy it now, it won't be shown again:${cmd(t.token)}</div>`;
      copyButtons(document.getElementById('token-out'));
    } catch (err) { alertInline(el, err.message); }
  });
  el.querySelectorAll('[data-revoke]').forEach((b) => b.addEventListener('click', async () => {
    b.disabled = true;
    try { await api(`/api/orgs/${slug}/tokens/${b.dataset.revoke}`, { method: 'DELETE' }); await renderManage(slug); } catch (err) { alertInline(el, err.message); }
  }));
}

function alertInline(el, msg) {
  const p = document.createElement('p');
  p.className = 'error';
  p.setAttribute('role', 'alert');
  p.textContent = msg;
  el.prepend(p);
}

function viewConnect() {
  const url = `${ORIGIN}/mcp`;
  const tok = '${SKILLYARD_TOKEN}';
  const agents = [
    ['Claude Code', 'Adds Skillyard as a remote MCP server for every project.', `claude mcp add --transport http --scope user skillyard ${url} --header "Authorization: Bearer $SKILLYARD_TOKEN"`],
    ['OpenAI Codex', 'Append to ~/.codex/config.toml.', `[mcp_servers.skillyard]\nurl = "${url}"\nbearer_token_env_var = "SKILLYARD_TOKEN"`],
    ['Cursor', 'Add to .cursor/mcp.json in your project.', JSON.stringify({ mcpServers: { skillyard: { url, headers: { Authorization: 'Bearer ${env:SKILLYARD_TOKEN}' } } } }, null, 2)],
    ['VS Code / Copilot', 'Add to .vscode/mcp.json.', JSON.stringify({ servers: { skillyard: { type: 'http', url, headers: { Authorization: 'Bearer ${env:SKILLYARD_TOKEN}' } } } }, null, 2)],
    ['Gemini CLI', 'Add to ~/.gemini/settings.json.', JSON.stringify({ mcpServers: { skillyard: { httpUrl: url, headers: { Authorization: 'Bearer $SKILLYARD_TOKEN' } } } }, null, 2)],
    ['Claude Desktop & stdio clients', 'Runs a local stdio bridge to this registry.', JSON.stringify({ mcpServers: { skillyard: { command: 'npx', args: ['-y', 'skillyard', 'mcp'], env: { SKILLYARD_REGISTRY: ORIGIN, SKILLYARD_TOKEN: '<your token>' } } } }, null, 2)],
  ];
  void tok;
  app.innerHTML = h`
    <div class="page-head"><h1>Connect an agent</h1><p>Two ways to give an agent your skills. <strong>Install</strong> copies skills into the folder the agent already reads, so they work offline and load automatically. <strong>MCP</strong> lets the agent search the whole registry live and pull a skill when a task calls for it — useful when your company has more skills than you want installed.</p></div>
    <div class="steps">
      <div class="step"><h3>1 · Point the CLI at this registry</h3><p>Private skills need an org token; public ones don't.</p>${raw(cmd(`npx skillyard login --registry ${ORIGIN} --token sy_…`))}</div>
      <div class="step"><h3>2 · Install skills into your agents</h3><p>Detects Claude Code, Codex, Cursor and AGENTS.md in the current project; pick explicitly with <code>--agent</code>.</p>${raw(cmd('npx skillyard install code-review @acme/deploy-runbook --agent claude,codex --save'))}<p style="margin-top:12px">Teammates then run one command to get the same set:</p>${raw(cmd('npx skillyard sync'))}</div>
      <div class="step"><h3>3 · Or connect over MCP</h3><p>The registry is an MCP server at <code>${url}</code> with tools <code>search_skills</code>, <code>get_skill</code> and <code>read_skill_file</code>, and every skill as a prompt. <code>npx skillyard connect &lt;agent&gt; --write</code> sets this up for you.</p></div>
    </div>
    <div class="section-title"><h2>MCP config by agent</h2><span class="muted">export SKILLYARD_TOKEN=sy_… first</span></div>
    <div class="agents-grid">${raw(agents.map(([name, note, snippet]) => h`<div class="panel"><h3>${name}</h3><p class="muted" style="font-size:13px;margin:0 0 8px">${note}</p>${raw(cmd(snippet))}</div>`).join(''))}</div>`;
  copyButtons(app);
}

const CAUGHT = { scan: 'Security scan', validate: 'Format check', eval: 'Lift eval', review: 'Human review' };

function registryLink(p) {
  const m = /registry\/public\/([a-z0-9-]+)$/.exec(p) || /seed\/orgs\/([a-z0-9-]+)\/skills\/([a-z0-9-]+)$/.exec(p);
  if (!m) return null;
  return m[2] ? `#/skill/@${m[1]}/${m[2]}` : `#/skill/@skillyard/${m[1]}`;
}

function codeBlock(side) {
  return `<div class="code-lines">${side.lines.map((l) => `<div class="${l.hit ? 'hit' : ''}"><span class="ln">${l.n}</span><span>${esc(l.text) || ' '}</span></div>`).join('')}${side.truncated ? '<div class="more">…</div>' : ''}</div>`;
}

function verdict(l) {
  const b = l.bad;
  const crit = b.scan.filter((f) => f.severity === 'critical');
  if (crit.length) return ['bad', `Blocked: ${crit[0].message}`];
  if (b.errors.length) return ['bad', `Rejected: ${b.errors[0]}`];
  const warn = [...b.warnings, ...b.scan.map((f) => f.message)];
  if (warn.length) return ['warn', `Warning: ${warn[0]}`];
  if (l.caughtBy.includes('eval')) return ['quiet', 'Passes every static check. Only measuring catches it.'];
  return ['quiet', 'Passes every check. Only a human reviewer catches it.'];
}

async function viewExamples(params) {
  const data = await (await fetch('examples.json')).json();
  const kind = params.get('kind') || '';
  const lessons = data.lessons.filter((l) => !kind || l.kind === kind);
  const pct = (x) => `${Math.round(x * 100)}%`;
  app.innerHTML = h`
    <div class="page-head"><h1>Good skills, bad skills</h1>
    <p>Twelve skills that look reasonable and aren't, each next to a version that works. Every verdict below is the real output of <code>skillyard validate</code>, <code>skillyard scan</code> or <code>skillyard eval</code>, not a description of what they'd say. The bad ones live in <a href="https://github.com/agentwik-labs/skillyard/tree/main/examples/bad">examples/bad</a> so you can test your own tools on them; don't install them.</p></div>
    <div class="chips" role="group" aria-label="Filter">
      ${raw(['', 'security', 'quality'].map((k) => `<button type="button" class="chip ${k === kind ? 'on' : ''}" data-kind="${k}">${k ? k[0].toUpperCase() + k.slice(1) : 'All'} · ${data.lessons.filter((l) => !k || l.kind === k).length}</button>`).join(''))}
    </div>
    ${raw(lessons.map((l, i) => {
      const [vk, vtext] = verdict(l);
      const link = registryLink(l.good.path);
      const m = l.measured;
      return h`<section class="lesson" id="${l.id}">
        <div class="lesson-head">
          <span class="lesson-n">${String(i + 1).padStart(2, '0')}</span>
          <h2>${l.title}</h2>
          <span class="badge ${l.kind === 'security' ? 'private' : 'public'}">${l.kind}</span>
          <span class="muted caught">Caught by: ${l.caughtBy.map((c) => CAUGHT[c]).join(', ')}</span>
        </div>
        <p class="why">${l.why}</p>
        <div class="pair">
          <div class="side bad-side">
            <div class="side-head"><strong>Bad</strong> <span class="mono">${l.bad.name}/${l.bad.file}</span></div>
            <div class="verdict ${vk}">${vtext}</div>
            ${raw(codeBlock(l.bad))}
            ${raw(l.bad.scan.length + l.bad.warnings.length + l.bad.errors.length > 1 ? `<ul class="findings">${[...l.bad.errors.map((e) => ['error', e]), ...l.bad.scan.map((f) => [f.severity, `${f.file}:${f.line} ${f.message}`]), ...l.bad.warnings.map((w) => ['warning', w])].map(([sev, t]) => `<li><span class="sev ${sev}">${sev}</span> ${esc(t)}</li>`).join('')}</ul>` : '')}
          </div>
          <div class="side good-side">
            <div class="side-head"><strong>Good</strong> <span class="mono">${l.good.name}/${l.good.file}</span>${raw(link ? ` <a href="${link}">open in registry →</a>` : '')}</div>
            <div class="verdict ok">${l.good.blocked ? 'Check failed' : `Passes: ${l.good.scan.length ? `${l.good.scan.length} warning(s) to review` : 'format check and security scan clean'}`}</div>
            ${raw(codeBlock(l.good))}
          </div>
        </div>
        ${raw(m ? h`<div class="measured"><strong>Measured</strong> (${m.model}, ${m.runs} runs per condition): no skill ${pct(m.without)} · this bad skill ${pct(m.withBad)}${raw(m.withGood != null ? ` · the good skill ${esc(pct(m.withGood))}` : '')}${raw(m.note ? ` <span class="muted">${esc(m.note)}</span>` : '')}</div>` : '')}
        <p class="fix"><strong>Fix:</strong> ${l.fix}</p>
      </section>`;
    }).join(''))}`;
  app.querySelectorAll('[data-kind]').forEach((b) => b.addEventListener('click', () => { location.hash = b.dataset.kind ? `#/examples?kind=${b.dataset.kind}` : '#/examples'; }));
}

function viewTeams() {
  const tiers = [
    ['Self-host', 'Free', 'Run Skillyard yourself. Private org skills, tokens, scan on publish, MCP, installs for Claude Code, Codex, Cursor and AGENTS.md agents. MIT licensed.', 'Get the code', 'https://github.com/agentwik-labs/skillyard'],
    ['Skills pack', 'From $3,000', 'We interview your team, write 10 private skills from how you actually ship (deploys, reviews, incidents, compliance, support), prove each one with a with/without eval, and install them across your agents.', 'Ask on X', 'https://x.com/agentwik'],
    ['Skills audit', '$750', 'We scan and eval the skills your team already uses, public and internal: what runs code, what talks to the network, which ones make your agent worse. You get a ranked report in a week.', 'Ask on X', 'https://x.com/agentwik'],
  ];
  app.innerHTML = h`
    <div class="page-head"><h1>Your agents don't know how your company works. Skills fix that.</h1>
    <p>Every team re-explains the same things to their AI agents: how to deploy, what "done" means, what you can't say to customers. A private skill writes it down once, and every agent on the team follows it. We build those skills with you, and we measure whether each one actually helps.</p></div>
    <div class="agents-grid">${raw(tiers.map(([name, price, body, cta, href]) => h`<div class="panel" style="display:flex;flex-direction:column;gap:10px"><h3>${name}</h3><div style="font-size:26px;font-weight:600;letter-spacing:-0.02em">${price}</div><p style="margin:0;color:var(--ink-2);flex:1">${body}</p><a class="btn ${name === 'Skills pack' ? 'primary' : ''}" href="${href}" target="_blank" rel="noopener noreferrer" style="align-self:flex-start">${cta}</a></div>`).join(''))}</div>
    <div class="section-title"><h2>Why measure</h2></div>
    <div class="steps">
      <div class="step"><h3>Skills can make agents worse</h3><p>Research on agent skills found that curated skills help on average, but a meaningful share of tasks got worse with a skill loaded, and self-written skills came out slightly negative. We run every skill we deliver with and without it, on your tasks, and keep only the ones that move the score.</p>${raw(cmd('npx skillyard eval ./skills/deploy-runbook --model haiku --runs 3'))}</div>
      <div class="step"><h3>Skills run code with your permissions</h3><p>One in five popular public skills ships scripts. Skillyard scans every publish for hidden instructions, secrets, remote-code installs and secret exfiltration, and blocks the dangerous ones. <a href="https://github.com/agentwik-labs/skillyard/blob/main/reports/2026-10-top-skills-scan.md">Read our scan of the 34 most-installed skill repos.</a></p></div>
      <div class="step"><h3>One copy for every agent</h3><p>Claude, Codex and Cursor each have their own way to share team skills, and each stops at its own agent. Skillyard keeps one private copy and installs it for all of them, or serves it live over MCP.</p></div>
    </div>`;
}

function viewPublish() {
  if (STATIC) {
    app.innerHTML = h`<div class="page-head"><h1>Publish a skill</h1><p>This is a read-only demo. Publishing needs a running registry: <code>npx skillyard serve</code>, or see the README on GitHub.</p></div>${raw(cmd('git clone https://github.com/agentwik-labs/skillyard && cd skillyard && npm run dev'))}`;
    copyButtons(app);
    return;
  }
  const canPublish = me.admin || me.scopes?.includes('publish');
  app.innerHTML = h`
    <div class="page-head"><h1>Publish a skill</h1><p>A skill is a folder with a <code>SKILL.md</code> (YAML frontmatter with <code>name</code> and <code>description</code>, then instructions) and optional <code>scripts/</code>, <code>references/</code> and <code>templates/</code>. Add a <code>skill.json</code> for version, category and tags. Versions are immutable: bump <code>version</code> to publish a change.</p></div>
    <div class="steps">
      <div class="step"><h3>From the CLI</h3>${raw(cmd('npx skillyard new my-skill'))}<p style="margin-top:12px"></p>${raw(cmd('npx skillyard validate my-skill && npx skillyard publish my-skill --org acme --visibility private'))}</div>
      <div class="step"><h3>From this page</h3>
        ${raw(canPublish ? h`<p>Choose a skill folder. It is validated by the server and published under <strong>@${me.org || '…'}</strong>.</p>
        <form id="upload" class="row">
          ${raw(me.admin ? '<input name="org" placeholder="org slug" required style="max-width:180px">' : '')}
          <input type="file" name="dir" webkitdirectory multiple required style="max-width:340px">
          <select name="visibility" style="max-width:160px"><option value="">Visibility from skill.json</option><option value="private">Private</option><option value="public">Public</option></select>
          <button class="primary">Publish</button>
        </form><div id="upload-out"></div>` : '<p class="muted">Sign in with a token that has the <code>publish</code> scope to upload from the browser.</p>')}
      </div>
    </div>`;
  const form = document.getElementById('upload');
  if (!form) return;
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const out = document.getElementById('upload-out');
    const fd = new FormData(form);
    const list = [...form.dir.files];
    if (!list.length) return;
    const root = list[0].webkitRelativePath.split('/')[0];
    const files = {};
    for (const f of list) {
      const rel = f.webkitRelativePath.slice(root.length + 1);
      if (!rel || rel.split('/').some((p) => p.startsWith('.') || p === 'node_modules' || p === '__pycache__')) continue;
      const buf = new Uint8Array(await f.arrayBuffer());
      let bin = '';
      for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
      files[rel] = btoa(bin);
    }
    try {
      const r = await api(`/api/skills/@${me.admin ? fd.get('org') : me.org}`, { method: 'POST', body: { files, visibility: fd.get('visibility') || undefined } });
      out.innerHTML = `<div class="notice">Published <a href="#/skill/${esc(r.id)}">${esc(r.id)}@${esc(r.latest)}</a> (${esc(r.visibility)}).${r.warnings?.length ? `<br>Warnings: ${r.warnings.map(esc).join('; ')}` : ''}</div>`;
    } catch (err) { out.innerHTML = `<p class="error" role="alert">${esc(err.message)}</p>`; }
  });
}

// ---- router ------------------------------------------------------------------

async function route() {
  const hash = location.hash.slice(1) || '/';
  const [pathPart, query = ''] = hash.split('?');
  const params = new URLSearchParams(query);
  document.querySelectorAll('.top nav a').forEach((a) => {
    const target = a.getAttribute('href').slice(1);
    a.classList.toggle('on', target === '/' ? pathPart === '/' || pathPart.startsWith('/skill') : pathPart.startsWith(target));
  });
  try {
    let m;
    if ((m = /^\/skill\/(@[a-z0-9-]+\/[a-z0-9-]+)(?:\/file\/(.+))?$/.exec(pathPart))) await viewSkill(m[1], m[2] && decodeURIComponent(m[2]));
    else if (pathPart === '/orgs') await viewOrgs();
    else if ((m = /^\/orgs\/([a-z0-9-]+)$/.exec(pathPart))) await viewOrg(m[1]);
    else if (pathPart === '/connect') viewConnect();
    else if (pathPart === '/publish') viewPublish();
    else if (pathPart === '/teams') viewTeams();
    else if (pathPart === '/examples') await viewExamples(params);
    else await viewBrowse(params);
    document.title = `${document.querySelector('main h1')?.textContent?.slice(0, 60) || 'Skillyard'} · Skillyard`;
    if (pathPart === '/') document.title = 'Skillyard';
  } catch (e) {
    app.innerHTML = h`<div class="empty"><strong>${e.status === 404 ? 'Not found' : 'Something went wrong'}</strong><p>${e.message}</p>${raw(e.status === 404 && me.anonymous ? '<p>If this is a private skill, sign in with your org token.</p>' : '')}<p><a href="#/">Back to all skills</a></p></div>`;
  }
  if (!location.hash.includes('/file/')) window.scrollTo(0, 0);
}

document.getElementById('auth').addEventListener('click', async () => {
  if (!me.anonymous) {
    token = null;
    store.set('skillyard.token', null);
    await refreshMe();
    return route();
  }
  document.getElementById('login-error').textContent = '';
  document.getElementById('login').showModal();
});

document.getElementById('login').addEventListener('close', async (e) => {
  const dlg = e.target;
  if (dlg.returnValue !== 'ok') return;
  const value = document.getElementById('token-input').value.trim();
  const prev = token;
  token = value;
  try {
    const who = await api('/api/whoami');
    if (who.anonymous) throw new Error('token not recognized');
    store.set('skillyard.token', value);
    document.getElementById('token-input').value = '';
    await refreshMe();
    route();
  } catch (err) {
    token = prev;
    document.getElementById('login-error').textContent = err.status === 401 ? 'That token is not valid for this registry.' : err.message;
    dlg.returnValue = '';
    dlg.showModal();
  }
});

if (STATIC) {
  document.querySelector('#login .muted').innerHTML = 'This is a static demo with two fictional companies. Type <code>acme</code> or <code>northwind</code> to see their private skills.';
  document.getElementById('token-input').placeholder = 'acme';
}
window.addEventListener('hashchange', route);
refreshMe().then(route);
