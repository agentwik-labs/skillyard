// Capture: read agent session logs on this machine, find the moments a person corrected the agent, and redact them.
// Nothing here leaves the machine. Detection rules are ported from github.com/agentwik-labs/pushback.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import readline from 'node:readline';
import crypto from 'node:crypto';

export const TYPES = [
  ['interrupted', 'Stopped mid-action', [/^\[request interrupted by user/]],
  ['did-too-much', 'Did more than asked', [/\bwhy (would|did) you (make|add|create|build|publish|write)/, /\bi (didn'?t|did not|never) ask/, /\bnot what i asked/, /\bjust (wanted|asked|needed)\b/, /\bonly (wanted|asked)\b/, /\btoo much\b/, /\bscope\b/, /\bwe just want/]],
  ['ignored-instruction', 'Ignored an instruction', [/\bi (already )?(said|told you|asked you)\b/, /\bas i said\b/, /\bagain[,.!?]/, /\bi mentioned\b/, /\bread (my|the) (message|instructions)/, /\bfollow (the|my) instructions/]],
  ['risky-action', 'Risky action', [/\b(don'?t|do not|never) (delete|remove|push|deploy|force|overwrite|drop|send|post|publish|commit)/, /\bwhy did you (delete|remove|push|deploy|overwrite|drop|send|post|publish|commit)/, /\brevert\b/, /\bundo\b/, /\broll ?back\b/]],
  ['wrong-or-broken', 'Wrong or broken', [/\b(that'?s|this is|it'?s) (wrong|incorrect|broken|not right)/, /\b(doesn'?t|does not|didn'?t|isn'?t) work/, /\bstill (broken|failing|not|doesn'?t)/, /\bnot working\b/, /\berror\b/, /\bbug\b/, /\bfailed\b/, /\bnothing (happens|changed)/, /\bsame (issue|problem|error)/]],
  ['made-it-up', 'Claimed without checking', [/\b(you|that) (made|make) (that|it|this) up/, /\bthat'?s not true\b/, /\bhallucinat/, /\bthat (file|function|endpoint|flag|page) doesn'?t exist/, /\bdid you (actually|even) (check|test|run|look)/, /\bare you sure\b/, /\bprove it\b/]],
  ['style', 'Wrong form or tone', [/\btoo (long|verbose|wordy|technical|complex|complicated|formal)/, /\b(simpler|shorter|plain english|less jargon)\b/, /\bstop (explaining|narrating)/, /\btl;?dr\b/, /\bjust (show|give) me\b/]],
  ['stop-or-redirect', 'Redirected', [/^(no|nope|nah|stop|wait|hold on|hang on)\b/, /\b(don'?t|do not) do that\b/, /\binstead\b/, /\bthat'?s not (it|what)\b/, /\bwrong (file|place|approach|repo|branch|account)/]],
];
export const TYPE_LABELS = Object.fromEntries(TYPES.map(([k, l]) => [k, l]));
const NOISE = ['<system-reminder', '<command-', '<local-command', 'caveat:', '<task-notification', '<bash-', '[image', '<pasted_content'];

export function classify(text) {
  const low = text.toLowerCase();
  for (const [key, , pats] of TYPES) if (pats.some((p) => p.test(low))) return key;
  return null;
}

// ---- redaction ---------------------------------------------------------------

const HOME = os.homedir();
const REDACTIONS = [
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g, '[private key]'],
  [/\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/g, '[aws key]'],
  [/\b(?:ghp|gho|ghs|ghu|github_pat)_[A-Za-z0-9_]{20,}\b/g, '[github token]'],
  [/\bxox[abpr]-[A-Za-z0-9-]{10,}\b/g, '[slack token]'],
  [/\bsk-(?:ant-|proj-)?[A-Za-z0-9_-]{20,}\b/g, '[api key]'],
  [/\b(?:sy|sb)_[A-Za-z0-9_-]{20,}\b/g, '[token]'],
  [/\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g, '[jwt]'],
  [/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, '[email]'],
  [/\b(?:\+?\d[\d -]{8,}\d)\b/g, '[number]'],
  [/([?&](?:token|key|secret|sig|signature|password|auth)=)[^&\s]+/gi, '$1[redacted]'],
  [/\b(password|passwd|secret|token|api[_-]?key)\s*[:=]\s*\S+/gi, '$1=[redacted]'],
];
export function redact(text) {
  let t = String(text || '').split(HOME).join('~');
  for (const [re, rep] of REDACTIONS) t = t.replace(re, rep);
  return t;
}

// ---- readers -------------------------------------------------------------------

function claudeHumanText(rec) {
  if (rec.type !== 'user' || rec.isMeta || rec.isSidechain || rec.toolUseResult != null || rec.promptSource === 'sdk') return null;
  let content = rec.message?.content;
  if (Array.isArray(content)) {
    if (content.some((c) => c?.type === 'tool_result')) return null;
    content = content.filter((c) => c?.type === 'text').map((c) => c.text || '').join('\n');
  }
  if (typeof content !== 'string' || !content.trim()) return null;
  const text = content.trim();
  const low = text.toLowerCase();
  if (NOISE.some((n) => low.startsWith(n))) return null;
  return text;
}

function claudeAgentTurn(rec) {
  const content = rec.message?.content || [];
  if (typeof content === 'string') return { text: content, tools: [], skills: [] };
  const text = content.filter((c) => c?.type === 'text').map((c) => c.text || '').join(' ');
  const uses = content.filter((c) => c?.type === 'tool_use');
  return {
    text,
    tools: uses.map((u) => u.name || '?'),
    skills: uses.filter((u) => u.name === 'Skill' && u.input?.skill).map((u) => String(u.input.skill)),
  };
}

function codexEvent(rec) {
  // Codex CLI rollout files: {type: "response_item", payload: {type: "message", role, content: [{type, text}]}}
  const p = rec.type === 'response_item' ? rec.payload : rec.payload?.type === 'message' ? rec.payload : null;
  if (!p || p.type !== 'message') return null;
  const text = (p.content || []).map((c) => c.text || '').join('\n').trim();
  if (!text) return null;
  if (p.role === 'user') {
    const low = text.toLowerCase();
    if (low.startsWith('<environment_context') || low.startsWith('<user_instructions') || NOISE.some((n) => low.startsWith(n))) return null;
    return { role: 'user', text };
  }
  if (p.role === 'assistant') return { role: 'assistant', text, tools: [], skills: [] };
  return null;
}

async function* lines(file) {
  const rl = readline.createInterface({ input: fs.createReadStream(file, { encoding: 'utf8' }), crlfDelay: Infinity });
  for await (const line of rl) {
    if (!line) continue;
    try { yield JSON.parse(line); } catch { /* partial line */ }
  }
}

/** Scan one session file. Returns { prompts: [{time}], corrections: [...] } with everything redacted. */
export async function scanSession(file, source) {
  let project = source === 'claude' ? projectName(path.basename(path.dirname(file))) : 'codex';
  let cwd = null;
  let branch = null;
  const prompts = [];
  const corrections = [];
  let lastAsk = null;
  let agentText = '';
  let tools = [];
  let skills = new Set();
  let sinceAsk = 0;
  for await (const rec of lines(file)) {
    if (!cwd && (rec.cwd || rec.payload?.cwd)) {
      cwd = rec.cwd || rec.payload.cwd;
      branch = rec.gitBranch || rec.payload?.git?.branch || null;
      project = repoOf(cwd) || project;
      for (const c of corrections) c.project = project;
    }
    let human = null;
    if (source === 'claude') {
      if (rec.type === 'assistant' && !rec.isSidechain) {
        const t = claudeAgentTurn(rec);
        if (t.text.trim()) agentText = t.text.trim();
        tools.push(...t.tools);
        t.skills.forEach((s) => skills.add(s));
        sinceAsk++;
        continue;
      }
      human = claudeHumanText(rec);
    } else {
      const e = codexEvent(rec);
      if (!e) continue;
      if (e.role === 'assistant') { agentText = e.text; sinceAsk++; continue; }
      human = e.text;
    }
    if (!human) continue;
    const time = rec.timestamp || rec.payload?.timestamp || null;
    prompts.push(time);
    const kind = sinceAsk ? classify(human) : null;
    if (kind && human.length < 2000) {
      const said = redact(human).slice(0, 600);
      corrections.push({
        id: crypto.createHash('sha1').update(`${file}:${time}:${said}`).digest('hex').slice(0, 10),
        source, project, branch, session: path.basename(file, '.jsonl').slice(0, 8), time, type: kind,
        said,
        asked: redact(lastAsk || '').slice(0, 500),
        agent: redact(agentText).slice(-400),
        tools: [...new Set(tools)].sort(),
        skills: [...skills],
      });
    }
    if (!kind) lastAsk = human;
    agentText = '';
    tools = [];
    sinceAsk = 0;
  }
  return { prompts, corrections, project, branch, cwd: cwd ? redact(cwd) : null };
}

// Resolve a session's working folder to its git repository name. Worktrees point back to their main repository
// (.git is a file: "gitdir: <main>/.git/worktrees/<name>"), so all branches of one repo count as one project.
const repoMemo = new Map();
export function repoOf(cwd) {
  if (!cwd) return null;
  if (repoMemo.has(cwd)) return repoMemo.get(cwd);
  // Worktree managers keep <root>/worktrees/<repo>/<branch>; this still works after the worktree is deleted.
  const wt = /[/\\]worktrees[/\\]([^/\\]+)[/\\][^/\\]+/.exec(cwd);
  if (wt) { repoMemo.set(cwd, wt[1]); return wt[1]; }
  let dir = cwd;
  let name = null;
  for (let i = 0; i < 12 && dir && dir !== path.dirname(dir); i++, dir = path.dirname(dir)) {
    const git = path.join(dir, '.git');
    let st;
    try { st = fs.statSync(git); } catch { continue; }
    if (st.isDirectory()) { name = path.basename(dir); break; }
    try {
      const m = /gitdir:\s*(.+)/.exec(fs.readFileSync(git, 'utf8'));
      const main = m && m[1].trim().split(`${path.sep}.git${path.sep}`)[0];
      name = main ? path.basename(main) : path.basename(dir);
    } catch { name = path.basename(dir); }
    break;
  }
  // No repo (a scratch folder): use the folder's own name.
  if (!name) name = path.basename(cwd) || null;
  repoMemo.set(cwd, name);
  return name;
}

export function projectName(dir) {
  // ~/.claude/projects folder names encode the cwd: -Users-name-Desktop-app -> app
  const parts = dir.split('-').filter(Boolean);
  const home = HOME.split(path.sep).filter(Boolean);
  let i = 0;
  while (i < home.length && parts[i] === home[i]) i++;
  const rest = parts.slice(i).filter((p) => !['Desktop', 'Documents', 'code', 'src', 'Projects', 'projects', 'superset', 'worktrees'].includes(p));
  return rest.slice(-2).join('-') || dir;
}

const CACHE_VERSION = 2;

export const SOURCES = {
  claude: { label: 'Claude Code', root: () => path.join(HOME, '.claude', 'projects') },
  codex: { label: 'OpenAI Codex', root: () => path.join(HOME, '.codex', 'sessions') },
};

export function listSessionFiles(source) {
  const root = SOURCES[source].root();
  const out = [];
  const walk = (d, depth) => {
    let ents;
    try { ents = fs.readdirSync(d, { withFileTypes: true }); } catch { return; }
    for (const e of ents) {
      const p = path.join(d, e.name);
      // Skip subagents and Skillyard's own eval/model runs, which would otherwise read as conversations.
      if (e.isDirectory() && depth < 5 && e.name !== 'subagents' && !/skillyard-(?:eval|llm|draft)/.test(e.name)) walk(p, depth + 1);
      else if (e.isFile() && e.name.endsWith('.jsonl')) out.push(p);
    }
  };
  walk(root, 0);
  return out;
}

/** Incremental capture across sources. cache: { [file]: {mtime, size, prompts, corrections} } */
export async function captureAll(sources, cache = {}, onProgress = () => {}) {
  const files = sources.flatMap((s) => listSessionFiles(s).map((f) => [s, f]));
  const next = {};
  let done = 0;
  for (const [source, file] of files) {
    let st;
    try { st = fs.statSync(file); } catch { continue; }
    const hit = cache[file];
    if (hit && hit.v === CACHE_VERSION && hit.mtime === st.mtimeMs && hit.size === st.size) next[file] = hit;
    else {
      const r = await scanSession(file, source);
      next[file] = { v: CACHE_VERSION, mtime: st.mtimeMs, size: st.size, source, project: r.project, branch: r.branch, cwd: r.cwd, prompts: r.prompts, corrections: r.corrections };
    }
    if (++done % 25 === 0) onProgress(done, files.length);
  }
  onProgress(files.length, files.length);
  return next;
}
