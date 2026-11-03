// Skillyard Studio UI. Hash-routed, no build step. Everything shown from logs is untrusted text: always escaped.
const app = document.getElementById('app');
const TYPE_LABELS = {
  interrupted: 'Stopped mid-action', 'did-too-much': 'Did more than asked', 'ignored-instruction': 'Ignored an instruction',
  'risky-action': 'Risky action', 'wrong-or-broken': 'Wrong or broken', 'made-it-up': 'Claimed without checking',
  style: 'Wrong form or tone', 'stop-or-redirect': 'Redirected',
};
let S = null; // last /api/state
let selected = null; // proposal id
let inboxTab = 'pending';
let poll = null;
let projectFilter = null; // a repo name, or null for all projects

// ---- helpers -----------------------------------------------------------------------
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const nf = new Intl.NumberFormat('en');
const pct = (x) => `${Math.round(x * 100)}%`;
const signedPts = (x) => { const v = Math.round(x * 100); return `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v)} pts`; };
const rate = (x) => `${x.toFixed(1)}`;
function ago(iso) {
  if (!iso) return '—';
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  const d = Math.round(s / 86400);
  return d < 14 ? `${d} d ago` : new Date(iso).toLocaleDateString('en', { day: 'numeric', month: 'short' });
}
const weekLabel = (w) => new Date(`${w}T00:00:00Z`).toLocaleDateString('en', { day: 'numeric', month: 'short', timeZone: 'UTC' });

// Read-only public demo: the same UI over a snapshot of the fictional team's Studio.
const STATIC = !!window.STUDIO_STATIC;
let snapshot = null;
async function staticApi(path, body) {
  snapshot ||= await (await fetch('demo-snapshot.json')).json();
  if (body !== undefined) throw new Error('This is a read-only demo. Run npx skillyard studio --demo to approve, edit and undo for real.');
  const [p, qs = ''] = path.split('?');
  if (p === '/api/state') return snapshot.state;
  if (p === '/api/skills') return { skills: snapshot.skills };
  if (p === '/api/preview') return snapshot.preview;
  if (p === '/api/diff') return { diff: snapshot.diffs[new URLSearchParams(qs).get('id')] || [] };
  throw new Error('not in the demo snapshot');
}

async function api(path, body) {
  if (STATIC) return staticApi(path, body);
  const res = await fetch(path, body === undefined ? {} : { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Skillyard-Studio': '1' }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || res.statusText);
  return data;
}

function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => t.classList.remove('show'), 3200);
}

async function refresh() {
  S = await api(`/api/state${projectFilter ? `?project=${encodeURIComponent(projectFilter)}` : ''}`);
  const pending = S.pipeline.pending;
  document.getElementById('nav-pending').textContent = pending ? String(pending) : '';
  document.getElementById('scope').textContent = S.demo ? 'Demo · Fernway (fictional team)' : `This Mac · ${S.consent.readLogs.sources.map((s) => (s === 'claude' ? 'Claude Code' : 'Codex')).join(' + ')}`;
  if (S.demo) document.getElementById('side-note').textContent = 'Demo data. Your own logs are not read, and approvals install into a sandbox.';
  renderJob();
  return S;
}

function renderJob() {
  const el = document.getElementById('job');
  if (STATIC) { el.innerHTML = '<span>Demo snapshot</span>'; return; }
  const j = S?.job;
  if (j && !j.finishedAt) {
    el.innerHTML = `<i class="spin" aria-hidden="true"></i><span>${esc(j.step)}${j.total ? ` · ${nf.format(j.done || 0)} of ${nf.format(j.total)} sessions` : ''}</span>`;
    if (!poll) poll = setInterval(async () => { await refresh(); if (!S.job || S.job.finishedAt) { clearInterval(poll); poll = null; route(); if (S.job?.error) toast(S.job.error); else toast(S.job.kind === 'review' ? 'Review finished. New proposals are in your inbox.' : 'Logs read.'); } }, 1500);
  } else {
    el.innerHTML = S?.lastScan ? `<span>Logs read ${esc(ago(S.lastScan))}</span><button class="btn quiet" type="button" id="rescan">Read again</button>` : '';
    document.getElementById('rescan')?.addEventListener('click', () => startJob('/api/scan'));
  }
}

async function startJob(path, body = {}) {
  try {
    await api(path, body);
    await refresh();
  } catch (e) { toast(e.message); }
}

// ---- views ------------------------------------------------------------------------

function viewWelcome() {
  setCrumb('Welcome');
  app.innerHTML = `
  <div class="welcome">
    <h1>Your agents keep making the same mistakes. Let's write them down.</h1>
    <p>Studio reads your AI agent sessions on this Mac, finds the moments you corrected the agent, and proposes skills that fix the ones that repeat. You approve every change. Nothing is read until you allow it below.</p>
    <div class="steps3">
      <div><h3>Find</h3><p>Reads Claude Code and Codex logs locally and spots corrections: "no", "I didn't ask for that", "that's wrong".</p><span class="who">On this Mac only</span></div>
      <div><h3>Propose</h3><p>Groups repeats into themes and drafts a skill or an edit to one you have, with tests built from your real requests.</p><span class="who">Only with your second OK</span></div>
      <div><h3>Prove, then you decide</h3><p>Runs each draft with and without, shows the difference, and installs it only when you approve.</p><span class="who">Undo any time</span></div>
    </div>
    <div class="gate">
      <div>
        <h3>Allow Studio to read agent logs on this Mac</h3>
        <p>Reads <span class="mono">~/.claude/projects</span> and <span class="mono">~/.codex/sessions</span>. Keeps only what you typed when you corrected the agent, what you had asked, and the agent's last reply, redacted (emails, keys, tokens and long numbers removed). Stored in <span class="mono">~/.skillyard/studio</span>; turning this off deletes it.</p>
      </div>
      <button class="btn go" type="button" id="allow">Allow and read logs</button>
    </div>
  </div>`;
  document.getElementById('allow').addEventListener('click', async () => {
    await api('/api/consent', { readLogs: { granted: true } });
    await startJob('/api/scan');
    location.hash = '#/';
    route();
  });
}

function viewOverview() {
  setCrumb('Overview');
  const t = S.totals;
  const top = S.byType.find((x) => x.type !== 'interrupted') || S.byType[0];
  const oneIn = t.corrections ? Math.round(t.prompts / t.corrections) : null;
  const pending = S.proposals.filter((p) => p.status === 'pending');
  const series = S.series;
  const last = series[series.length - 1];
  const prev = series[series.length - 2];
  const finding = !t.prompts
    ? 'No sessions read yet.'
    : `1 in ${nf.format(oneIn || 0)} of your prompts ends in a correction${top ? `; the most common is <b>${esc(top.label.toLowerCase())}</b> (${nf.format(top.n)} of ${nf.format(t.corrections)})` : ''}.`;
  const lift = S.pipeline.avgLift;
  app.innerHTML = `
  <div class="title-row">
    <div><h1>${projectFilter ? `Overview · <span class="mono" style="font-size:20px">${esc(projectFilter)}</span>` : 'Overview'}</h1><p class="finding">${finding} <span class="muted">${nf.format(t.prompts)} prompts across ${nf.format(t.sessions)} sessions${projectFilter ? '' : ` in ${nf.format(S.byRepo.length)} projects`}.</span>${projectFilter ? ` <a href="#/" class="muted" style="font-size:13px">Show all projects</a>` : ''}</p></div>
    <div class="actions">
      ${pending.length ? `<a class="btn primary" href="#/proposals">Review ${pending.length} proposal${pending.length === 1 ? '' : 's'}</a>` : ''}
      <button class="btn ${pending.length ? '' : 'primary'}" type="button" id="find">Find fixes</button>
    </div>
  </div>
  <div class="pipe" aria-label="From corrections to proven skills">
    <a href="#/corrections"><div class="label">Corrections found</div><b>${nf.format(S.pipeline.corrections)}</b><div class="sub">${t.prompts ? `${rate(t.rate)} per 100 prompts` : '—'}</div></a>
    <a href="#/themes"><div class="label">Themes that repeat</div><b>${S.pipeline.themes || '<span class="dash">—</span>'}</b><div class="sub">${S.job && !S.job.finishedAt && S.job.kind === 'review' ? 'review in progress' : S.lastReview ? `reviewed ${esc(ago(S.lastReview))}` : 'not reviewed yet'}</div></a>
    <a href="#/proposals" class="${pending.length ? 'hot' : ''}"><div class="label">Waiting for you</div><b>${nf.format(pending.length)}</b><div class="sub">${nf.format(S.pipeline.proposals)} proposed in total</div></a>
    <a href="#/proposals"><div class="label">Approved</div><b>${nf.format(S.pipeline.approved)}</b><div class="sub">installed in your agents</div></a>
    <div><div class="label">Average lift</div><b>${lift == null ? '<span class="dash">—</span>' : esc(signedPts(lift))}</b><div class="sub">tested before approval</div></div>
  </div>
  <div class="section row2">
    <div class="card">
      <div class="chart-head"><h3>Corrections per 100 prompts, by week</h3><span class="meta">${last ? `This week ${rate(last.rate)}${prev ? `, ${esc(rateDelta(last.rate, prev.rate))} on the week of ${esc(weekLabel(prev.week))}` : ''}` : ''}</span></div>
      <div class="chart" id="rate-chart"></div>
    </div>
    <div class="card">
      <div class="chart-head"><h3>What went wrong</h3><span class="meta">${nf.format(t.corrections)} corrections</span></div>
      <div id="type-chart"></div>
    </div>
  </div>
  ${projectFilter ? '' : `<div class="section">
    <div class="section-head"><h2>By project</h2><a href="#/projects">View all ${nf.format(S.byRepo.length)}</a></div>
    ${projectsTable(S.byRepo.slice(0, 5), true)}
  </div>`}
  <div class="section">
    <div class="section-head"><h2>Latest corrections${projectFilter ? ` in ${esc(projectFilter)}` : ''}</h2><a href="#/corrections${projectFilter ? `?project=${encodeURIComponent(projectFilter)}` : ''}">View all ${nf.format(t.corrections)}</a></div>
    ${correctionsTable(S.corrections.slice(0, 5))}
  </div>`;
  document.getElementById('find').addEventListener('click', findFixes);
  if (series.length >= 2) {
    window.Charts.line(document.getElementById('rate-chart'), {
      labels: series.map((x) => weekLabel(x.week)),
      series: [{ name: 'Corrections per 100 prompts', values: series.map((x) => +x.rate.toFixed(1)) }],
      format: window.Charts.fmt.dec(1), height: 220, endLabel: true,
    });
  } else document.getElementById('rate-chart').innerHTML = '<div class="empty"><h3>Not enough weeks yet</h3>The trend appears after two weeks of sessions.</div>';
  const typeEl = document.getElementById('type-chart');
  if (S.byType.length) window.Charts.barList(typeEl, S.byType.map((x) => ({ label: x.label, value: x.n })), { format: window.Charts.fmt.int });
  else typeEl.innerHTML = '<p class="muted">No corrections yet.</p>';
  bindCorrectionRows();
  bindProjectRows();
}

function projectsTable(rows, compact = false) {
  if (!rows.length) return '<div class="empty"><h3>No projects yet</h3>Sessions appear here once logs are read.</div>';
  const MIN = 20; // below this many prompts a rate is noise
  const max = Math.max(...rows.filter((r) => r.prompts >= MIN).map((r) => r.rate), 1);
  return `<table class="projects">
    <thead><tr><th>Project</th><th class="n">Prompts</th><th class="n">Corrections</th><th>Per 100 prompts</th><th class="n hide-sm">Last 4 weeks</th><th class="hide-sm">Top issue</th>${compact ? '' : '<th class="n hide-sm">Themes</th><th class="hide-sm">Last active</th><th class="hide-sm">Model review</th>'}</tr></thead>
    <tbody>${rows.map((r) => {
      const d = r.recentRate != null && r.priorRate != null ? r.recentRate - r.priorRate : null;
      return `<tr class="link" data-proj="${esc(r.project)}">
        <td><span class="mono">${esc(r.project)}</span>${r.branches > 1 ? `<div class="muted" style="font-size:12px">${r.branches} branches</div>` : ''}</td>
        <td class="n">${nf.format(r.prompts)}</td>
        <td class="n">${nf.format(r.corrections)}</td>
        <td>${r.prompts < MIN ? '<span class="muted" style="font-size:13px">too few prompts</span>' : `<div class="rate"><span class="num">${rate(r.rate)}</span><i style="width:${Math.max(2, (r.rate / max) * 100)}%"></i></div>`}</td>
        <td class="n hide-sm">${r.recentRate == null ? '<span class="dash">—</span>' : `<span class="num">${rate(r.recentRate)}</span>${d == null ? '' : ` <span class="delta ${d < -0.5 ? 'good' : d > 0.5 ? 'bad' : ''}">${esc(rateDelta(r.recentRate, r.priorRate))}</span>`}`}</td>
        <td class="hide-sm">${r.topType ? `<span class="pill">${esc(r.topType.label)}</span>` : '<span class="dash">—</span>'}</td>
        ${compact ? '' : `<td class="n hide-sm">${r.themes || '<span class="dash">—</span>'}</td><td class="when hide-sm">${esc(ago(r.last))}</td><td class="hide-sm">${r.reviewExcluded ? '<span class="muted">Kept local</span>' : 'Included'}</td>`}
      </tr>`;
    }).join('')}</tbody></table>`;
}
function bindProjectRows() {
  app.querySelectorAll('[data-proj]').forEach((r) => r.addEventListener('click', () => { location.hash = `#/?project=${encodeURIComponent(r.dataset.proj)}`; }));
}

function viewProjects() {
  setCrumb('Projects');
  const rows = S.byRepo;
  const worst = [...rows].filter((r) => r.prompts >= 40).sort((a, b) => b.rate - a.rate)[0];
  app.innerHTML = `
  <div class="title-row"><div><h1>Projects</h1><p class="finding">${rows.length ? `${nf.format(rows.length)} repositories. ${worst ? `<b class="mono" style="font-weight:500">${esc(worst.project)}</b> has the most corrections per prompt (${rate(worst.rate)} per 100).` : ''}` : 'No projects yet.'} <span class="muted">Worktrees and branches count toward their repository.</span></p></div></div>
  ${projectsTable(rows)}
  <p class="muted" style="font-size:13px;margin-top:12px">Last 4 weeks compares corrections per 100 prompts with the 4 weeks before; shown when a project had at least 10 prompts in both. Choose which projects are counted or sent for review in <a href="#/privacy">Privacy and consent</a>.</p>`;
  bindProjectRows();
}

const rateDelta = (a, b) => { const d = a - b; return `${d > 0 ? '+' : d < 0 ? '−' : ''}${Math.abs(d).toFixed(1)}`; };

async function findFixes() {
  if (!S.consent.modelReview.granted) {
    location.hash = '#/privacy';
    toast('Allow model review first. You can see exactly what is sent.');
    return;
  }
  await startJob('/api/review', { max: 3 });
  toast('Review started. It reads new sessions, groups themes, drafts skills and tests each one.');
}

function correctionsTable(rows) {
  if (!rows.length) return '<div class="empty"><h3>No corrections found</h3>Either your agents are doing great or the logs are empty.</div>';
  return `<table>
    <thead><tr><th>When</th><th>Kind</th><th>Project</th><th>What you said</th><th class="hide-sm">What you had asked</th></tr></thead>
    <tbody>${rows.map((c) => `<tr class="link" data-cid="${esc(c.id)}">
      <td class="when">${esc(ago(c.time))}</td>
      <td><span class="pill">${esc(TYPE_LABELS[c.type] || c.type)}</span></td>
      <td class="mono">${esc(c.project)}</td>
      <td><span class="quote clip">${esc(c.said)}</span></td>
      <td class="hide-sm muted"><span class="clip">${esc(c.asked) || '<span class="dash">—</span>'}</span></td>
    </tr>`).join('')}</tbody></table>`;
}
function bindCorrectionRows() {
  app.querySelectorAll('[data-cid]').forEach((r) => r.addEventListener('click', () => { location.hash = `#/corrections?id=${r.dataset.cid}`; }));
}

function viewCorrections(params) {
  setCrumb('Corrections');
  const type = params.get('type') || '';
  const project = params.get('project') || '';
  const q = (params.get('q') || '').toLowerCase();
  const focus = params.get('id');
  let rows = S.corrections.filter((c) => (!type || c.type === type) && (!project || c.project === project) && (!q || `${c.said} ${c.asked}`.toLowerCase().includes(q)));
  if (focus) rows = rows.filter((c) => c.id === focus).concat(rows.filter((c) => c.id !== focus));
  const one = focus && S.corrections.find((c) => c.id === focus);
  app.innerHTML = `
  <div class="title-row"><div><h1>Corrections</h1><p class="finding muted">Every time you pushed back on an agent, redacted. ${nf.format(S.totals.corrections)} in ${nf.format(S.totals.prompts)} prompts.</p></div></div>
  ${one ? `<div class="card" style="margin-bottom:24px">
    <div class="ev" style="border:0"><div><div class="label"><span>You asked</span><span class="mono">${esc(one.project)}</span></div>${esc(one.asked) || '<span class="dash">—</span>'}</div>
    <div><div class="label"><span>The agent said</span></div>${esc(one.agent) || '<span class="dash">—</span>'}</div></div>
    <p style="margin:12px 14px 4px"><span class="pill">${esc(TYPE_LABELS[one.type])}</span> <span class="quote">${esc(one.said)}</span></p>
    <p class="muted" style="margin:4px 14px 0;font-size:13px">${esc(new Date(one.time).toLocaleString())}${one.skills.length ? ` · skills loaded: <span class="mono">${esc(one.skills.join(', '))}</span>` : ''}${one.tools.length ? ` · tools: ${esc(one.tools.slice(0, 6).join(', '))}` : ''}</p>
  </div>` : ''}
  <form class="filters" id="filters">
    <input name="q" type="search" placeholder="Search what you said or asked" value="${esc(params.get('q') || '')}" aria-label="Search corrections">
    <select name="type" aria-label="Kind"><option value="">All kinds</option>${Object.entries(TYPE_LABELS).map(([k, l]) => `<option value="${k}" ${k === type ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select>
    <select name="project" aria-label="Project"><option value="">All projects</option>${S.byProject.map((p) => `<option value="${esc(p.project)}" ${p.project === project ? 'selected' : ''}>${esc(p.project)} (${p.n})</option>`).join('')}</select>
    <span class="muted" style="font-size:13px">${nf.format(rows.length)} shown</span>
  </form>
  ${correctionsTable(rows.slice(0, 200))}`;
  const f = document.getElementById('filters');
  f.addEventListener('change', () => submitFilters(f));
  f.addEventListener('submit', (e) => { e.preventDefault(); submitFilters(f); });
  bindCorrectionRows();
}
function submitFilters(f) {
  const p = new URLSearchParams();
  for (const [k, v] of new FormData(f)) if (v) p.set(k, v);
  location.hash = `#/corrections?${p}`;
}

function viewThemes() {
  setCrumb('Themes');
  const themes = S.themes;
  app.innerHTML = `
  <div class="title-row"><div><h1>Themes</h1><p class="finding muted">Corrections that repeat, grouped by the last review${S.lastReview ? ` (${esc(ago(S.lastReview))})` : ''}.</p></div>
  <div class="actions"><button class="btn primary" type="button" id="find">Review again</button></div></div>
  ${themes.length ? `<table><thead><tr><th>Theme</th><th>Fix</th><th class="n">Corrections</th><th>Proposal</th></tr></thead><tbody>
  ${themes.map((t) => {
    const p = S.proposals.find((x) => x.themeId === t.id);
    return `<tr><td><b style="font-weight:500">${esc(t.title)}</b><div class="muted" style="font-size:13px;max-width:640px">${esc(t.problem)}</div></td>
      <td><span class="pill">${t.kind === 'improve' ? 'Improve' : 'New skill'}</span> <span class="mono">${esc(t.skill)}</span></td>
      <td class="n">${nf.format(t.correctionIds.length)}</td>
      <td>${p ? `<a href="#/proposals?id=${esc(p.id)}">${esc(statusLabel(p))}</a>` : '<span class="dash">—</span>'}</td></tr>`;
  }).join('')}</tbody></table>` : `<div class="empty"><h3>No themes yet</h3>Run a review to group your corrections into themes that a skill could fix.<br><button class="btn primary" type="button" id="find2">Find fixes</button></div>`}`;
  document.getElementById('find')?.addEventListener('click', findFixes);
  document.getElementById('find2')?.addEventListener('click', findFixes);
}
const statusLabel = (p) => ({ pending: 'Waiting for you', approved: 'Approved', rejected: 'Rejected' }[p.status] || p.status);

function viewProposals(params) {
  setCrumb('Proposals');
  if (params.get('id')) { selected = params.get('id'); const p = S.proposals.find((x) => x.id === selected); if (p) inboxTab = p.status; }
  const list = S.proposals.filter((p) => p.status === inboxTab);
  if (!list.some((p) => p.id === selected)) selected = list[0]?.id || null;
  const counts = { pending: 0, approved: 0, rejected: 0 };
  S.proposals.forEach((p) => { counts[p.status] = (counts[p.status] || 0) + 1; });
  const pending = counts.pending;
  app.innerHTML = `
  <div class="title-row"><div><h1>Proposals</h1><p class="finding">${pending ? `${pending} change${pending === 1 ? '' : 's'} waiting for you. Each one was drafted from your corrections and tested before it got here.` : 'Nothing is waiting for you.'}</p></div>
  <div class="actions"><button class="btn" type="button" id="find">Find more fixes</button></div></div>
  ${S.proposals.length ? `<div class="inbox">
    <div class="inbox-list">
      <div class="inbox-tabs" role="tablist">${['pending', 'approved', 'rejected'].map((k) => `<button type="button" role="tab" data-tab="${k}" class="${k === inboxTab ? 'on' : ''}">${{ pending: 'Waiting', approved: 'Approved', rejected: 'Rejected' }[k]} ${counts[k] || 0}</button>`).join('')}</div>
      ${list.length ? list.map(itemRow).join('') : `<p class="muted" style="padding:16px">None here.</p>`}
    </div>
    <div class="detail" id="detail">${selected ? '' : '<p class="muted">Select a proposal.</p>'}</div>
  </div>` : `<div class="empty"><h3>No proposals yet</h3>Studio drafts a skill when the same kind of correction keeps coming back, then tests it. Run a review to start.<br><button class="btn primary" type="button" id="find2">Find fixes</button></div>`}`;
  document.getElementById('find')?.addEventListener('click', findFixes);
  document.getElementById('find2')?.addEventListener('click', findFixes);
  app.querySelectorAll('[data-tab]').forEach((b) => b.addEventListener('click', () => { inboxTab = b.dataset.tab; selected = null; viewProposals(new URLSearchParams()); }));
  app.querySelectorAll('[data-pid]').forEach((b) => b.addEventListener('click', () => { selected = b.dataset.pid; viewProposals(new URLSearchParams()); }));
  if (selected) renderDetail(S.proposals.find((p) => p.id === selected));
}

function groupEvidence(list) {
  const by = new Map();
  for (const c of list) {
    const k = `${c.asked}\u0000${c.said}`;
    const g = by.get(k);
    if (g) g.times++; else by.set(k, { ...c, times: 1 });
  }
  return [...by.values()];
}

// With 2 cases x 2 runs a side, one flipped check moves the score by about 8-17 points; treat that as noise.
const NOISE = 0.17;
function liftClass(l) { return l == null || Math.abs(l) <= NOISE ? 'flat' : l > 0 ? '' : 'down'; }

function itemRow(p) {
  const bestAlt = (p.alternatives || []).filter((a) => a.eval).sort((a, b) => b.eval.candidate - a.eval.candidate)[0];
  const l = p.eval ? Math.max(p.eval.lift, bestAlt ? bestAlt.eval.candidate - p.eval.baseline : -Infinity) : null;
  return `<button type="button" class="item ${p.id === selected ? 'on' : ''}" data-pid="${esc(p.id)}">
    <div class="k"><span>${p.kind === 'improve' ? 'Improve' : 'New skill'} · <span class="mono">${esc(p.skill)}</span></span>
    ${l == null ? '<span class="pill">Untested</span>' : `<span class="pill ${l > NOISE ? 'pos' : l < -NOISE ? 'neg' : ''}">${Math.abs(l) <= NOISE ? 'Within noise' : esc(signedPts(l))}</span>`}</div>
    <div class="t">${esc(p.title)}</div>
    <div class="m"><span>${nf.format(p.evidence.length)} correction${p.evidence.length === 1 ? '' : 's'}</span>${p.alternatives?.length ? `<span>·</span><span>${p.alternatives.length} found</span>` : ''}<span>·</span><span>${esc(ago(p.createdAt))}</span></div>
  </button>`;
}

let detailTab = 'change';
const choices = {}; // proposal id -> 'draft' or a library skill id

function defaultChoice(p) {
  const best = (p.alternatives || []).filter((a) => a.eval).sort((a, b) => b.eval.candidate - a.eval.candidate)[0];
  // Prefer a maintained library skill only when it clearly beats the draft.
  return best && p.eval && best.eval.candidate > p.eval.candidate + NOISE ? best.id : 'draft';
}

function optionsHtml(p) {
  const alts = p.alternatives || [];
  if (!p.searchedAt && !alts.length) return '';
  const chosen = choices[p.id] || defaultChoice(p);
  const base = p.eval?.baseline;
  const row = (id, title, sub, score) => {
    const lift = score != null && base != null ? score - base : null;
    return `<label class="opt ${chosen === id ? 'on' : ''}"><input type="radio" name="choice" value="${esc(id)}" ${chosen === id ? 'checked' : ''} ${p.status !== 'pending' ? 'disabled' : ''}>
      <span class="opt-main"><b>${title}</b><span class="muted">${sub}</span></span>
      <span class="opt-score num">${score == null ? '<span class="dash">—</span>' : pct(score)}</span>
      <span>${lift == null ? '' : `<span class="pill ${lift > NOISE ? 'pos' : lift < -NOISE ? 'neg' : ''}">${Math.abs(lift) <= NOISE ? 'Within noise' : esc(signedPts(lift))}</span>`}</span></label>`;
  };
  return `<div class="section-head"><h2>Options</h2><span class="meta">${alts.length ? `${alts.length} found in the library` : `nothing in the library fits (${nf.format(p.searched?.candidates || 0)} checked)`}</span></div>
  <div class="options" id="options">
    ${row('draft', `Drafted for you <span class="mono">${esc(p.skill)}</span>`, 'Written from your corrections', p.eval?.candidate)}
    ${alts.map((a) => row(a.id, `Found <span class="mono">${esc(a.id)}</span>`, `${esc(a.reason || a.description || '').slice(0, 160)} · ${esc(a.license || 'licence unknown')}${a.source ? ` · <a href="${esc(a.source.repo)}" target="_blank" rel="noopener noreferrer">${esc(a.source.repo.replace('https://github.com/', ''))}</a>` : ''}`, a.eval?.candidate)).join('')}
  </div>`;
}
let editing = false;

async function renderDetail(p) {
  const el = document.getElementById('detail');
  if (!p) return;
  const e = p.eval;
  const blocked = p.checks.blocked;
  let diffHtml = '';
  if (p.kind === 'improve' && p.before) {
    const { diff } = await api(`/api/diff?id=${encodeURIComponent(p.id)}`);
    diffHtml = collapseDiff(diff);
  } else {
    diffHtml = p.after.split('\n').map((t) => `<div class="add" data-op="+">${esc(t) || '&nbsp;'}</div>`).join('');
  }
  const verdictWhy = !e ? (p.origin === 'created' && S.job && !S.job.finishedAt ? 'Testing now…' : 'Not tested: no example request and checks were given.')
    : e.lift > NOISE ? `Scored clearly higher than ${esc(e.baselineLabel.toLowerCase())} on tests built from your requests.`
      : e.lift < -NOISE ? `Scored clearly lower than ${esc(e.baselineLabel.toLowerCase())}. Approving it would likely make things worse; consider rejecting.`
        : `Within noise: no clear difference from ${esc(e.baselineLabel.toLowerCase())} at this many runs. Approve only if the change itself reads right to you.`;
  el.innerHTML = `
    <div class="k" style="font-size:13px;color:var(--muted)">${p.origin === 'created' ? `Created from the ${esc(p.generator)} generator · <span class="mono">${esc(p.skill)}</span>` : p.kind === 'improve' ? `Improve your <span class="mono">${esc(p.skill)}</span> skill` : `New skill <span class="mono">${esc(p.skill)}</span>`}</div>
    <h2>${esc(p.title)}</h2>
    <p class="lede">${esc(p.problem)}${p.summary ? ` ${esc(p.summary)}` : ''}</p>
    <div class="verdict">
      <div><div class="label">${esc(e?.baselineLabel || 'Before')}</div><b>${e ? pct(e.baseline) : '<span class="dash">—</span>'}</b></div>
      <div><div class="label">With this change</div><b>${e ? pct(e.candidate) : '<span class="dash">—</span>'}</b></div>
      <div class="lift ${liftClass(e?.lift)}"><div class="label">Lift</div><b>${e ? esc(signedPts(e.lift)) : '<span class="dash">—</span>'}</b></div>
      <div class="why">${verdictWhy}${e ? ` <span class="muted">Answers by ${esc(e.model)}, graded by ${esc(e.judge || 'haiku')}; ${e.cases.length} case${e.cases.length === 1 ? '' : 's'}, ${e.runs} run${e.runs === 1 ? '' : 's'} each.</span>` : ''}</div>
    </div>
    ${optionsHtml(p)}
    ${p.origin === 'created' ? '' : `<div class="section-head"><h2>Why: your corrections</h2><span class="meta">${nf.format(p.evidence.length)} found</span></div>`}
    <div class="evidence">${groupEvidence(p.evidence).slice(0, 4).map((c) => `<div class="ev">
      <div><div class="label"><span>You asked</span><span class="mono">${esc(c.project)}</span></div>${esc(c.asked) || '<span class="dash">—</span>'}</div>
      <div><div class="label"><span>You said${c.times > 1 ? `, ${c.times} times` : ''}</span><span>${esc(ago(c.time))}</span></div><span class="quote">${esc(c.said)}</span></div>
    </div>`).join('')}${groupEvidence(p.evidence).length > 4 ? `<p class="muted" style="margin:0;font-size:13px">and ${groupEvidence(p.evidence).length - 4} more</p>` : ''}</div>
    <div class="tabs" role="tablist">
      ${[['change', p.kind === 'improve' ? 'The change' : 'The skill'], ['tests', `Tests${e ? ` (${e.cases.length})` : ''}`], ['checks', `Checks${p.checks.warnings.length + p.checks.scan.length ? ` (${p.checks.warnings.length + p.checks.scan.length})` : ''}`]].map(([k, l]) => `<button type="button" data-dt="${k}" class="${k === detailTab ? 'on' : ''}">${l}</button>`).join('')}
    </div>
    <div id="dt"></div>
    <div class="decide">${decideBar(p, blocked)}</div>`;
  const dt = document.getElementById('dt');
  const showTab = () => {
    el.querySelectorAll('[data-dt]').forEach((b) => b.classList.toggle('on', b.dataset.dt === detailTab));
    const chosen = choices[p.id] || defaultChoice(p);
    const alt = (p.alternatives || []).find((a) => a.id === chosen);
    if (detailTab === 'change' && alt) dt.innerHTML = `<p class="muted" style="font-size:13px;margin-top:0">Installs <span class="mono">${esc(alt.id)}</span> as published${alt.source ? `, from <a href="${esc(alt.source.repo)}/tree/${esc(alt.source.commit)}/${esc(alt.source.path)}" target="_blank" rel="noopener noreferrer">its source</a>` : ''}. Licence: ${esc(alt.license || 'unknown')}.</p><div class="diff">${alt.skillMd.split('\n').map((t) => `<div class="add" data-op="+">${esc(t) || '&nbsp;'}</div>`).join('')}</div>`;
    else if (detailTab === 'change') dt.innerHTML = editing && p.status === 'pending'
      ? `<textarea class="editor" id="editor" spellcheck="false" aria-label="Edit SKILL.md">${esc(p.after)}</textarea><p class="muted" style="font-size:13px">Your edit is checked again (format and security scan) when you approve. Edited versions are not re-tested.</p>`
      : `<div class="diff">${diffHtml}</div>`;
    else if (detailTab === 'tests') dt.innerHTML = e ? e.cases.map((c) => caseHtml(c, alt)).join('') : '<p class="muted">No tests ran for this draft.</p>';
    else dt.innerHTML = checksHtml(p.checks);
  };
  el.querySelectorAll('[data-dt]').forEach((b) => b.addEventListener('click', () => { detailTab = b.dataset.dt; showTab(); }));
  el.querySelectorAll('input[name=choice]').forEach((r) => r.addEventListener('change', () => { choices[p.id] = r.value; editing = false; renderDetail(p); }));
  showTab();
  bindDecide(p);
}

function collapseDiff(diff) {
  // Show changes with 3 lines of context; fold long unchanged runs.
  const keep = new Set();
  diff.forEach((d, i) => { if (d.op !== ' ') for (let k = i - 3; k <= i + 3; k++) keep.add(k); });
  const out = [];
  let folded = 0;
  diff.forEach((d, i) => {
    if (d.op === ' ' && !keep.has(i)) { folded++; return; }
    if (folded) { out.push(`<div class="gap" data-op="⋯">${folded} unchanged line${folded === 1 ? '' : 's'}</div>`); folded = 0; }
    out.push(`<div class="${d.op === '+' ? 'add' : d.op === '-' ? 'del' : ''}" data-op="${d.op === ' ' ? '' : esc(d.op)}">${esc(d.text) || '&nbsp;'}</div>`);
  });
  if (folded) out.push(`<div class="gap" data-op="⋯">${folded} unchanged line${folded === 1 ? '' : 's'}</div>`);
  return out.join('');
}

function caseHtml(c, alt) {
  const col = (label, runs) => {
    const avg = runs.length ? runs.reduce((a, r) => a + r.score, 0) / runs.length : 0;
    const r = runs[0];
    return `<div><h4><span>${esc(label)}</span><span class="num">${pct(avg)}</span></h4>
      ${r ? `<ul class="checks">${r.checks.map((x) => `<li><span class="${x.pass ? 'ok' : 'no'}" aria-label="${x.pass ? 'pass' : 'fail'}">${x.pass ? '✓' : '✕'}</span><span>${esc(x.label)}</span></li>`).join('')}</ul>
      <details class="out"><summary>Agent's answer</summary><pre>${esc(r.output || '(no output)')}</pre></details>` : '<p class="muted">Did not run.</p>'}</div>`;
  };
  const e = S.proposals.find((p) => p.id === selected)?.eval;
  return `<div class="case"><div class="case-head"><div class="muted" style="font-size:12px">Built from your request · <span class="mono">${esc(c.name)}</span></div><div class="prompt">${esc(c.prompt)}</div></div>
    <div class="case-cols ${alt ? 'three' : ''}">${col(e?.baselineLabel || 'Before', c.before)}${col('Drafted skill', c.after)}${alt ? col(alt.id, alt.eval?.cases.find((x) => x.name === c.name)?.after || []) : ''}</div></div>`;
}

function checksHtml(ch) {
  const rows = [
    ...ch.errors.map((m) => ['neg', 'Format', m]),
    ...ch.scan.map((f) => [f.severity === 'critical' ? 'neg' : 'warn', 'Security', `${f.file}:${f.line} ${f.message}`]),
    ...ch.warnings.map((m) => ['warn', 'Format', m]),
  ];
  return rows.length ? `<table><tbody>${rows.map(([k, a, m]) => `<tr><td style="width:110px"><span class="pill ${k}">${a}</span></td><td>${esc(m)}</td></tr>`).join('')}</tbody></table>`
    : '<p><span class="pill pos">Passed</span> Format check and security scan found nothing.</p>';
}

function impactHtml(p) {
  const i = p.impact;
  if (!i) return '';
  if (!i.enough) return `<span class="decided" style="flex-basis:100%;margin:0">Impact: waiting for more sessions (${nf.format(i.after.prompts)} prompts since approval, needs 30) to compare <i>${esc(i.kinds.join(', ').toLowerCase())}</i> corrections before and after.</span>`;
  const d = i.after.rate - i.before.rate;
  return `<span class="decided" style="flex-basis:100%;margin:0">Impact: <b>${esc(i.kinds.join(', ').toLowerCase())}</b> corrections went from ${rate(i.before.rate)} to ${rate(i.after.rate)} per 100 prompts <span class="delta ${d < -0.5 ? 'good' : d > 0.5 ? 'bad' : ''}">${esc(rateDelta(i.after.rate, i.before.rate))}</span> (4 weeks before vs since approval).</span>`;
}

function decideBar(p, blocked) {
  if (p.status === 'approved') return `${impactHtml(p)}<span class="decided">Approved ${esc(ago(p.decidedAt))}${p.chosen && p.chosen !== 'draft' ? ` (${esc(p.chosen)} from the library)` : ''} and installed for ${esc((p.installed || []).map((i) => (i.agent === 'claude' ? 'Claude Code' : i.agent === 'codex' ? 'Codex' : i.agent)).join(', '))}${p.edited ? ' (edited)' : ''}.</span><button class="btn" type="button" id="undo">Undo</button>`;
  if (p.status === 'rejected') return `<span class="decided">Rejected ${esc(ago(p.decidedAt))}${p.reason ? `: ${esc(p.reason)}` : ''}. Studio won't propose this theme again.</span>`;
  const agents = S.agents.map((a) => `<label><input type="checkbox" name="agent" value="${esc(a.id)}" ${a.id === 'claude' ? 'checked' : ''}> ${esc(a.label)}</label>`).join('');
  return `<div class="agents"><span>Install for</span>${agents}</div>
    ${(choices[p.id] || defaultChoice(p)) === 'draft' ? `<button class="btn quiet" type="button" id="edit">${editing ? 'Stop editing' : 'Edit'}</button>` : ''}
    <button class="btn danger" type="button" id="reject">Reject</button>
    <button class="btn go" type="button" id="approve" ${blocked ? 'disabled title="Failed the format check or security scan"' : ''}>Approve and install</button>`;
}

function bindDecide(p) {
  document.getElementById('edit')?.addEventListener('click', () => { editing = !editing; detailTab = 'change'; renderDetail(p); });
  document.getElementById('reject')?.addEventListener('click', () => {
    const bar = document.querySelector('.decide');
    bar.innerHTML = `<input id="reason" placeholder="Why reject this? Optional, it guides the next review" style="flex:1;min-width:220px;height:32px;border:1px solid var(--control);border-radius:6px;padding:0 10px" aria-label="Reason">
      <button class="btn quiet" type="button" id="cancel-reject">Cancel</button><button class="btn danger" type="button" id="confirm-reject">Reject proposal</button>`;
    document.getElementById('reason').focus();
    document.getElementById('cancel-reject').addEventListener('click', () => renderDetail(p));
    document.getElementById('confirm-reject').addEventListener('click', async () => {
      try { await api(`/api/proposals/${p.id}/reject`, { reason: document.getElementById('reason').value }); await refresh(); toast('Rejected. This theme will not be proposed again.'); viewProposals(new URLSearchParams()); } catch (e) { toast(e.message); }
    });
  });
  document.getElementById('approve')?.addEventListener('click', async () => {
    const agents = [...document.querySelectorAll('input[name=agent]:checked')].map((i) => i.value);
    if (!agents.length) return toast('Choose at least one agent.');
    const skillMd = editing ? document.getElementById('editor')?.value : undefined;
    try {
      await api(`/api/proposals/${p.id}/approve`, { agents, skillMd, choice: choices[p.id] || defaultChoice(p) });
      editing = false;
      await refresh();
      toast(`Installed ${p.skill}. Undo any time from Approved.`);
      inboxTab = 'pending';
      selected = null;
      viewProposals(new URLSearchParams());
    } catch (e) { toast(e.message); }
  });
  document.getElementById('undo')?.addEventListener('click', async () => {
    try { await api(`/api/proposals/${p.id}/undo`, {}); await refresh(); toast('Undone. The previous version is back.'); inboxTab = 'pending'; viewProposals(new URLSearchParams(`id=${p.id}`)); } catch (e) { toast(e.message); }
  });
}

async function viewSkills() {
  setCrumb('Skills');
  const { skills } = await api('/api/skills');
  const where = { claude: 'Claude Code', codex: 'Codex', studio: 'Studio library' };
  app.innerHTML = `
  <div class="title-row"><div><h1>Skills</h1><p class="finding muted">What your agents load today. Studio proposes edits to these when your corrections show a gap.</p></div></div>
  ${skills.length ? `<table><thead><tr><th>Skill</th><th>Where</th><th>Managed by</th><th class="hide-sm">Description</th></tr></thead><tbody>
  ${skills.map((k) => `<tr><td class="mono">${esc(k.name)}</td><td>${esc(where[k.where] || k.where)}</td><td>${k.managed ? 'Skillyard' : '<span class="muted">You</span>'}</td><td class="hide-sm muted"><span class="clip">${esc(k.description)}</span></td></tr>`).join('')}</tbody></table>`
    : '<div class="empty"><h3>No skills installed</h3>Approve a proposal to install your first one.</div>'}`;
}

async function viewPrivacy() {
  setCrumb('Privacy and consent');
  const c = S.consent;
  const pv = c.readLogs.granted ? await api('/api/preview') : null;
  const sw = (id, on, label) => `<button class="switch" type="button" role="switch" id="${id}" aria-checked="${on}" aria-label="${esc(label)}"></button>`;
  app.innerHTML = `
  <div class="title-row"><div><h1>Privacy and consent</h1><p class="finding muted">Three separate permissions. Each one is off until you turn it on, and every change is logged below.</p></div></div>
  <div class="gate">
    <div><h3>1. Read agent logs on this Mac</h3>
      <p>Finds corrections in your Claude Code and Codex sessions. Keeps only the redacted correction, what you had asked, and the agent's last reply. Turning this off deletes everything Studio read.</p>
      <div class="state ${c.readLogs.granted ? 'on' : ''}">${c.readLogs.granted ? `On since ${esc(new Date(c.readLogs.at).toLocaleDateString())}` : 'Off'}</div></div>
    ${sw('sw-read', c.readLogs.granted, 'Read agent logs')}
  </div>
  ${c.readLogs.granted ? `<div class="gate"><div style="grid-column:1/-1"><h3>Projects</h3><p>Choose per repository. <b>Count</b> includes it in your numbers on this Mac. <b>Send for review</b> lets its redacted corrections go to the model. Keep work for an employer or client local, or leave it out entirely.</p>
    <table class="proj-table" id="proj"><thead><tr><th>Project</th><th class="n">Prompts</th><th class="n">Corrections</th><th>Count</th><th>Send for review</th></tr></thead><tbody>
    ${S.projects.filter((p) => p.prompts > 0).map((p) => `<tr><td class="mono">${esc(p.project)}</td><td class="n">${nf.format(p.prompts)}</td><td class="n">${nf.format(p.corrections)}</td>
      <td><input type="checkbox" data-kind="count" value="${esc(p.project)}" ${p.excluded ? '' : 'checked'} aria-label="Count ${esc(p.project)}"></td>
      <td><input type="checkbox" data-kind="send" value="${esc(p.project)}" ${(c.readLogs.reviewExclude || []).includes(p.project) || p.excluded ? '' : 'checked'} ${p.excluded ? 'disabled' : ''} aria-label="Send ${esc(p.project)} for review"></td></tr>`).join('')}
    </tbody></table></div></div>` : ''}
  <div class="gate">
    <div><h3>2. Let a model review redacted excerpts</h3>
      <p>Sends short, redacted excerpts to ${esc(c.modelReview.model === 'haiku' ? 'Claude Haiku' : c.modelReview.model)} through your own Claude Code login, to group themes, draft skills and grade tests. No code, files or tool output are sent.</p>
      <div class="state ${c.modelReview.granted ? 'on' : ''}">${c.modelReview.granted ? `On since ${esc(new Date(c.modelReview.at).toLocaleDateString())}` : 'Off'}${pv ? ` · the next review sends ${nf.format(pv.count)} excerpts` : ''}</div>
      ${pv ? `<details style="margin-top:10px"><summary style="cursor:pointer;font-size:13px">See exactly what would be sent</summary><p class="muted" style="font-size:13px">${esc(pv.note)}</p><div class="preview">${pv.sample.map((x) => `<div><span class="pill">${esc(TYPE_LABELS[x.type])}</span> <span class="mono">${esc(x.project)}</span><br><span class="muted">Asked:</span> ${esc(x.asked) || '—'}<br><span class="muted">Said:</span> ${esc(x.said)}</div>`).join('')}</div></details>` : ''}
    </div>
    ${sw('sw-model', c.modelReview.granted, 'Model review')}
  </div>
  <div class="gate">
    <div><h3>3. Review automatically</h3>
      <p>Runs a review on a schedule and leaves new proposals in your inbox. It never installs anything: every change still waits for your approval.</p>
      <div class="state">${c.autoReview.schedule === 'off' ? 'Off' : `${esc(c.autoReview.schedule === 'daily' ? 'Every day' : 'Every Monday')} at 9:00`}</div>
      ${c.autoReview.schedule !== 'off' ? `<p class="cron">Add this line to your crontab (<span class="mono">crontab -e</span>) to run it:</p><pre class="mono" style="background:var(--raised);padding:10px 12px;border-radius:6px;white-space:pre-wrap">${esc(c.autoReview.schedule === 'daily' ? '0 9 * * *' : '0 9 * * 1')} npx skillyard studio review</pre>` : ''}
    </div>
    <select id="auto" aria-label="Automatic review" style="height:32px;border:1px solid var(--control);border-radius:6px;padding:0 8px" ${c.modelReview.granted ? '' : 'disabled'}>
      ${[['off', 'Off'], ['weekly', 'Weekly'], ['daily', 'Daily']].map(([v, l]) => `<option value="${v}" ${v === c.autoReview.schedule ? 'selected' : ''}>${l}</option>`).join('')}
    </select>
  </div>
  <div class="gate">
    <div><h3>4. Notify your team</h3>
      <p>Post new proposals to a Slack incoming webhook, or any https webhook (Zapier, n8n, Make) that forwards to Linear, Jira or email. Only titles and test scores are sent, never your corrections.</p>
      <div class="state ${c.notify?.webhook ? 'on' : ''}">${c.notify?.webhook ? `On · ${esc(new URL(c.notify.webhook).host)}` : 'Off'}</div>
      <form id="notify" class="row" style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap">
        <input name="webhook" type="url" placeholder="https://hooks.slack.com/services/…" value="${esc(c.notify?.webhook || '')}" style="flex:1;min-width:260px;height:32px;border:1px solid var(--control);border-radius:6px;padding:0 10px" aria-label="Webhook URL">
        <button class="btn" type="submit">Save</button>
        ${c.notify?.webhook ? '<button class="btn quiet" type="button" id="notify-test">Send a test</button>' : ''}
      </form>
    </div>
  </div>
  <div class="section">
    <div class="section-head"><h2>Consent and change log</h2><span class="meta">Newest first</span></div>
    ${S.log.length ? `<table><tbody>${S.log.map((l) => `<tr><td class="when" style="width:170px">${esc(new Date(l.at).toLocaleString())}</td><td style="font-weight:500">${esc(l.action)}</td><td class="muted">${esc(l.detail)}</td></tr>`).join('')}</tbody></table>` : '<p class="muted">Nothing yet.</p>'}
  </div>`;
  const flip = async (key, on) => {
    if (key === 'readLogs' && !on && !flip.confirmed) {
      const st = document.querySelector('#sw-read').previousElementSibling.querySelector('.state');
      st.innerHTML = 'This deletes everything Studio read. <button class="btn danger" type="button" id="really-off" style="margin-left:8px">Turn off and delete</button>';
      document.getElementById('really-off').addEventListener('click', () => { flip.confirmed = true; flip('readLogs', false); });
      return;
    }
    flip.confirmed = false;
    await api('/api/consent', { [key]: { granted: on } });
    await refresh();
    if (key === 'readLogs' && on) await startJob('/api/scan');
    viewPrivacy();
  };
  document.getElementById('sw-read').addEventListener('click', (e) => flip('readLogs', e.currentTarget.getAttribute('aria-checked') !== 'true'));
  document.getElementById('sw-model').addEventListener('click', (e) => {
    if (!c.readLogs.granted) return toast('Allow reading logs first.');
    flip('modelReview', e.currentTarget.getAttribute('aria-checked') !== 'true');
  });
  document.getElementById('notify')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    try { await api('/api/consent', { notify: { webhook: new FormData(e.target).get('webhook') } }); await refresh(); viewPrivacy(); toast('Saved.'); } catch (err) { toast(err.message); }
  });
  document.getElementById('notify-test')?.addEventListener('click', async () => {
    try { await api('/api/notify-test', {}); toast('Test message sent.'); } catch (err) { toast(err.message); }
  });
  document.getElementById('auto').addEventListener('change', async (e) => { await api('/api/consent', { autoReview: { schedule: e.target.value } }); await refresh(); viewPrivacy(); });
  document.getElementById('proj')?.addEventListener('change', async () => {
    const all = [...document.querySelectorAll('#proj input[data-kind=count]')].map((i) => i.value);
    const excludeProjects = [...document.querySelectorAll('#proj input[data-kind=count]:not(:checked)')].map((i) => i.value);
    const reviewExclude = all.filter((p) => !document.querySelector(`#proj input[data-kind=send][value="${CSS.escape(p)}"]`)?.checked);
    await api('/api/consent', { excludeProjects, reviewExclude });
    await refresh();
    viewPrivacy();
    toast(`${all.length - excludeProjects.length} counted, ${all.length - reviewExclude.length} sent for review`);
  });
}

// ---- create ------------------------------------------------------------------------

let gens = null;
const createState = { gen: null, mode: 'document', answers: {}, document: '', built: null, busy: false };

async function viewCreate(params) {
  setCrumb('Create a skill');
  if (!gens) gens = (await import('./generators.js')).GENERATORS;
  const genMod = await import('./generators.js');
  createState.gen = params.get('g') || null;
  const g = gens.find((x) => x.id === createState.gen);
  if (!g) {
    app.innerHTML = `
    <div class="title-row"><div><h1>Create a skill</h1><p class="finding">Pick the kind of knowledge you want your agents to follow. Paste a document you already have (an SOP, a wiki page, a policy) and Studio fills it in, or answer a few questions.</p></div></div>
    <div class="gens">${gens.map((x) => `<a class="gen" href="#/create?g=${x.id}"><b>${esc(x.title)}</b><span>${esc(x.summary)}</span></a>`).join('')}</div>
    <p class="muted" style="font-size:13px;margin-top:16px">Every skill you create is checked, tested on your example request when you give one, and waits in Proposals for your approval like any other.</p>`;
    return;
  }
  const field = (f) => {
    const v = createState.answers[f.key];
    const val = Array.isArray(v) ? v.join('\n') : v || '';
    const input = f.kind === 'text'
      ? `<input name="${f.key}" value="${esc(val)}" placeholder="${esc(f.example || '')}">`
      : `<textarea name="${f.key}" rows="${f.kind === 'list' ? 4 : 3}" placeholder="${esc(f.example || (f.kind === 'list' ? 'One per line' : ''))}">${esc(val)}</textarea>`;
    return `<label class="fld"><span>${esc(f.label)}${f.required ? '' : ' <i class="muted">optional</i>'}</span>${f.help ? `<small class="muted">${esc(f.help)}</small>` : ''}${input}</label>`;
  };
  app.innerHTML = `
  <div class="title-row"><div><h1>${esc(g.title)}</h1><p class="finding muted">${esc(g.summary)} <a href="#/create">Choose another kind</a></p></div></div>
  <div class="create">
    <div>
      <div class="tabs" role="tablist">
        <button type="button" data-mode="document" class="${createState.mode === 'document' ? 'on' : ''}">From a document</button>
        <button type="button" data-mode="form" class="${createState.mode === 'form' ? 'on' : ''}">Answer questions</button>
      </div>
      ${createState.mode === 'document' ? `
        <label class="fld"><span>Paste the document</span><small class="muted">Sent once to Claude through your own login to fill the fields. Nothing else is sent.</small>
        <textarea id="doc" rows="16" placeholder="Paste an SOP, a policy, a wiki page, a playbook…">${esc(createState.document)}</textarea></label>
        <button class="btn primary" type="button" id="fill" ${createState.busy ? 'disabled' : ''}>${createState.busy ? 'Reading…' : 'Fill from document'}</button>
        <p class="muted" style="font-size:13px">Then check the answers under "Answer questions" before you create it.</p>`
      : `<form id="gform">${g.fields.map(field).join('')}</form>`}
    </div>
    <div class="preview-pane">
      <div class="section-head"><h2>Preview</h2><span class="meta" id="pstatus"></span></div>
      <div class="diff" id="pview"></div>
      <div class="decide" style="position:static;margin:16px 0 0;padding:0;border:0">
        <span class="decided" id="pnote"></span>
        <button class="btn go" type="button" id="create">Create and test</button>
      </div>
    </div>
  </div>`;
  const update = () => {
    const built = genMod.generate(g.id, createState.answers);
    createState.built = built;
    const md = built.files['SKILL.md'];
    document.getElementById('pview').innerHTML = md.split('\n').map((t) => `<div data-op="">${esc(t) || '&nbsp;'}</div>`).join('');
    const tests = built.files['evals/evals.json'] ? JSON.parse(built.files['evals/evals.json']).cases[0].checks.length : 0;
    document.getElementById('pstatus').textContent = `${md.split('\n').length} lines · ${tests ? `${tests} test check${tests === 1 ? '' : 's'}` : 'no test yet'}`;
    document.getElementById('pnote').textContent = built.missing.length ? `Still needed: ${built.missing.join(', ')}` : tests ? 'Ready. It will be tested with and without, then wait for your approval.' : 'Ready. Add an example request and checks to have it tested.';
    document.getElementById('create').disabled = !!built.missing.length || createState.busy;
  };
  app.querySelectorAll('[data-mode]').forEach((b) => b.addEventListener('click', () => { createState.mode = b.dataset.mode; viewCreate(new URLSearchParams(`g=${g.id}`)); }));
  document.getElementById('gform')?.addEventListener('input', (e) => {
    const f = g.fields.find((x) => x.key === e.target.name);
    if (f) createState.answers[f.key] = f.kind === 'list' ? e.target.value.split('\n') : e.target.value;
    update();
  });
  document.getElementById('doc')?.addEventListener('input', (e) => { createState.document = e.target.value; });
  document.getElementById('fill')?.addEventListener('click', async () => {
    if (!createState.document.trim()) return toast('Paste a document first.');
    createState.busy = true; viewCreate(new URLSearchParams(`g=${g.id}`));
    try {
      const r = await api('/api/generate', { generator: g.id, document: createState.document });
      createState.answers = r.answers;
      createState.mode = 'form';
      toast('Filled from your document. Check the answers, then create.');
    } catch (e) { toast(e.message); }
    createState.busy = false;
    viewCreate(new URLSearchParams(`g=${g.id}`));
  });
  document.getElementById('create').addEventListener('click', async () => {
    try {
      const p = await api('/api/create', { generator: g.id, answers: createState.answers });
      Object.assign(createState, { answers: {}, document: '', built: null, gen: null, mode: 'document' });
      await refresh();
      toast(p.eval === null ? 'Created. Testing it now; it is waiting in Proposals.' : 'Created.');
      location.hash = `#/proposals?id=${p.id}`;
    } catch (e) { toast(e.message); }
  });
  update();
}

// ---- shell -------------------------------------------------------------------------

function demoBar() {
  if (!STATIC || document.querySelector('.demo-bar')) return;
  app.insertAdjacentHTML('afterbegin', '<div class="demo-bar">Read-only demo of a fictional team. To approve, edit and undo, run <code>npx skillyard studio --demo</code>; to use your own logs, <code>npx skillyard studio</code>.</div>');
}

function setCrumb(t) {
  document.getElementById('crumb').innerHTML = `Studio / <b>${esc(t)}</b>`;
  document.title = `${t} · Skillyard Studio`;
}

async function route() {
  const [p, qs = ''] = (location.hash.slice(1) || '/').split('?');
  const params = new URLSearchParams(qs);
  document.getElementById('side').classList.remove('open');
  await refresh().catch(() => {});
  const name = p.replace(/^\//, '') || 'overview';
  const wantProject = ['overview', 'corrections'].includes(name) ? params.get('project') : null;
  if (wantProject !== projectFilter) { projectFilter = wantProject; await refresh().catch(() => {}); }
  document.querySelectorAll('[data-nav]').forEach((a) => a.classList.toggle('on', a.dataset.nav === name));
  try {
    if (!S.consent.readLogs.granted && name !== 'privacy') return viewWelcome();
    if (name === 'overview') viewOverview();
    else if (name === 'proposals') viewProposals(params);
    else if (name === 'themes') viewThemes();
    else if (name === 'projects') viewProjects();
    else if (name === 'create') await viewCreate(params);
    else if (name === 'corrections') viewCorrections(params);
    else if (name === 'skills') await viewSkills();
    else if (name === 'privacy') await viewPrivacy();
    else viewOverview();
    demoBar();
  } catch (e) {
    app.innerHTML = `<div class="empty"><h3>Something went wrong</h3>${esc(e.message)}</div>`;
  }
}

document.getElementById('menu').addEventListener('click', () => document.getElementById('side').classList.toggle('open'));
window.addEventListener('hashchange', route);
refresh().then(route).catch((e) => { app.innerHTML = `<div class="empty"><h3>Studio's server is not answering</h3>${esc(e.message)}</div>`; });
