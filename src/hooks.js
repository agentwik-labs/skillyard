// Wire skills into a team's normal workflow: git hooks that re-sync after pulls and branch switches, and a
// Claude Code SessionStart hook. Every change is a marked block that `hooks remove` takes out again.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const START = '# >>> skillyard (managed: skillyard hooks remove) >>>';
const END = '# <<< skillyard <<<';
const GIT_HOOKS = ['post-merge', 'post-checkout'];
const SYNC = 'npx --yes skillyard sync --quiet >/dev/null 2>&1 || true';

function gitHooksDir(cwd) {
  const r = spawnSync('git', ['rev-parse', '--git-path', 'hooks'], { cwd, encoding: 'utf8' });
  if (r.status !== 0) throw new Error('not inside a git repository');
  const custom = spawnSync('git', ['config', '--get', 'core.hooksPath'], { cwd, encoding: 'utf8' }).stdout.trim();
  return path.resolve(cwd, custom || r.stdout.trim());
}

function upsertBlock(file, block, { shebang = '#!/bin/sh' } = {}) {
  let cur = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : `${shebang}\n`;
  const re = new RegExp(`\\n?${START.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[\\s\\S]*?${END.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\n?`);
  cur = cur.replace(re, '\n');
  if (block) cur = `${cur.replace(/\n*$/, '\n')}${START}\n${block}\n${END}\n`;
  fs.writeFileSync(file, cur);
  fs.chmodSync(file, 0o755);
}

export function installHooks({ cwd = process.cwd(), git = true, claude = false } = {}) {
  const done = [];
  if (git) {
    const dir = gitHooksDir(cwd);
    fs.mkdirSync(dir, { recursive: true });
    for (const h of GIT_HOOKS) {
      // post-checkout gets a flag: 1 for a branch checkout, 0 for a file checkout; only sync on branches.
      const body = h === 'post-checkout' ? `[ "$3" = "1" ] && [ -f skills.json ] && ${SYNC}` : `[ -f skills.json ] && ${SYNC}`;
      upsertBlock(path.join(dir, h), body);
      done.push(path.relative(cwd, path.join(dir, h)));
    }
  }
  if (claude) {
    const file = path.join(cwd, '.claude', 'settings.json');
    const cur = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {};
    cur.hooks ||= {};
    const list = (cur.hooks.SessionStart ||= []);
    const cmd = 'npx --yes skillyard sync --quiet';
    if (!list.some((g) => (g.hooks || []).some((x) => x.command === cmd))) list.push({ hooks: [{ type: 'command', command: cmd, timeout: 60 }] });
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, `${JSON.stringify(cur, null, 2)}\n`);
    done.push(path.relative(cwd, file));
  }
  return done;
}

export function removeHooks({ cwd = process.cwd() } = {}) {
  const done = [];
  try {
    const dir = gitHooksDir(cwd);
    for (const h of GIT_HOOKS) {
      const f = path.join(dir, h);
      if (fs.existsSync(f) && fs.readFileSync(f, 'utf8').includes(START)) { upsertBlock(f, null); done.push(path.relative(cwd, f)); }
    }
  } catch { /* not a git repo */ }
  const file = path.join(cwd, '.claude', 'settings.json');
  if (fs.existsSync(file)) {
    const cur = JSON.parse(fs.readFileSync(file, 'utf8'));
    const before = JSON.stringify(cur);
    if (cur.hooks?.SessionStart) {
      cur.hooks.SessionStart = cur.hooks.SessionStart.map((g) => ({ ...g, hooks: (g.hooks || []).filter((x) => !String(x.command).includes('skillyard sync')) })).filter((g) => g.hooks.length);
      if (!cur.hooks.SessionStart.length) delete cur.hooks.SessionStart;
      if (!Object.keys(cur.hooks).length) delete cur.hooks;
    }
    if (JSON.stringify(cur) !== before) { fs.writeFileSync(file, `${JSON.stringify(cur, null, 2)}\n`); done.push(path.relative(cwd, file)); }
  }
  return done;
}
