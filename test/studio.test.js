import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'skillyard-studio-test-'));
process.env.SKILLYARD_STUDIO_DIR = tmp;
process.env.SKILLYARD_STUDIO_DEMO = '1';
const capture = await import('../src/studio/capture.js');
const engine = await import('../src/studio/engine.js');
const { seedDemo } = await import('../src/studio/demo.js');
const { createStudioServer } = await import('../src/studio/server.js');

test('redaction removes secrets, emails, numbers and the home path', () => {
  const home = os.homedir();
  const out = capture.redact(`key sk-ant-abcdefghijklmnopqrstuvwx123 mail a.b@corp.com call +1 415 555 0100 at ${home}/code token=abc123 ghp_${'a'.repeat(36)}`);
  assert.ok(!out.includes('sk-ant-') && !out.includes('a.b@corp.com') && !out.includes('555 0100') && !out.includes(home) && !out.includes('ghp_'));
  assert.match(out, /~\/code/);
});

test('corrections are classified like pushback', () => {
  assert.equal(capture.classify("I didn't ask you to refactor that"), 'did-too-much');
  assert.equal(capture.classify('we use pnpm, I already said this'), 'ignored-instruction');
  assert.equal(capture.classify("don't deploy, just build"), 'risky-action');
  assert.equal(capture.classify('thanks, looks great'), null);
});

test('scanSession finds a correction in a Claude Code transcript and ignores tool results', async () => {
  const f = path.join(tmp, 'session.jsonl');
  const rec = (o) => JSON.stringify(o);
  fs.writeFileSync(f, [
    rec({ type: 'user', timestamp: '2026-10-01T10:00:00Z', message: { content: 'add a created_at column' } }),
    rec({ type: 'assistant', message: { content: [{ type: 'text', text: 'Added the column and an admin page.' }, { type: 'tool_use', name: 'Skill', input: { skill: 'db-migrations' } }] } }),
    rec({ type: 'user', message: { content: [{ type: 'tool_result', content: 'error: failed' }] } }),
    rec({ type: 'user', timestamp: '2026-10-01T10:05:00Z', message: { content: "why did you add an admin page? I didn't ask for it. mail me at x@y.com" } }),
  ].join('\n'));
  const r = await capture.scanSession(f, 'claude');
  assert.equal(r.prompts.length, 2);
  assert.equal(r.corrections.length, 1);
  const c = r.corrections[0];
  assert.equal(c.type, 'did-too-much');
  assert.equal(c.asked, 'add a created_at column');
  assert.deepEqual(c.skills, ['db-migrations']);
  assert.ok(!c.said.includes('x@y.com'));
});

test('line diff marks additions and removals', () => {
  const d = engine.diffLines('a\nb\nc', 'a\nB\nc\nd');
  assert.deepEqual(d.map((x) => x.op + x.text), [' a', '-b', '+B', ' c', '+d']);
});

test('demo: stats, consent log, and approvals stay in the sandbox', async () => {
  seedDemo({ reset: true });
  const s = engine.stats();
  assert.ok(s.demo);
  assert.ok(s.totals.corrections > 50 && s.totals.prompts > 1000);
  assert.ok(s.series.every((w) => w.prompts >= 20));
  // a hand-made proposal goes through approve -> undo without touching the real home folder
  const st = engine.loadState();
  const draftDir = fs.mkdtempSync(path.join(os.tmpdir(), 'skillyard-draft-'));
  const md = '---\nname: pnpm-only\ndescription: Uses pnpm workspace commands in the Fernway monorepo. Use when installing packages, adding scripts or running tests.\nlicense: MIT\n---\n\n# pnpm only\n\nAlways use pnpm --filter <pkg>. Never npm. Never commit package-lock.json.\n';
  fs.writeFileSync(path.join(draftDir, 'SKILL.md'), md);
  st.proposals.unshift({ id: 'abc123', title: 't', skill: 'pnpm-only', kind: 'new', status: 'pending', after: md, draftDir, checks: { blocked: false }, evidence: [] });
  engine.saveState(st);
  assert.throws(() => engine.decide('abc123', 'approve', { agents: [] }), /choose at least one agent/);
  const p = engine.decide('abc123', 'approve', { agents: ['claude'] });
  assert.equal(p.status, 'approved');
  assert.ok(p.installed[0].dir.startsWith(tmp), 'demo installs go to the sandbox');
  assert.ok(fs.existsSync(path.join(p.installed[0].dir, 'SKILL.md')));
  engine.decide('abc123', 'undo');
  assert.ok(!fs.existsSync(p.installed[0].dir));
  assert.ok(engine.loadState().log.some((l) => l.action === 'Undid an approval'));
});

test('studio server refuses foreign hosts and writes without its header', async () => {
  const server = createStudioServer({ port: 0 });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const port = server.address().port;
  // port 0 means the allow-list was built for :0; rebuild with the real port
  server.close();
  const s2 = createStudioServer({ port });
  await new Promise((r) => s2.listen(port, '127.0.0.1', r));
  const base = `http://127.0.0.1:${port}`;
  assert.equal((await fetch(`${base}/api/state`)).status, 200);
  assert.equal((await fetch(`${base}/api/consent`, { method: 'POST', body: '{}' })).status, 403);
  const r = await fetch(`${base}/api/consent`, { method: 'POST', headers: { 'X-Skillyard-Studio': '1' }, body: JSON.stringify({ autoReview: { schedule: 'daily' } }) });
  assert.equal(r.status, 200);
  s2.close();
});

test('agent account failures are errors, never graded answers', async () => {
  const { agentFailure } = await import('../src/studio/llm.js');
  assert.match(agentFailure(1, "Claude Code can't use your Claude subscription, usually because a payment is past due"), /could not run/);
  assert.match(agentFailure(1, 'Not logged in · Please run /login'), /could not run/);
  assert.match(agentFailure(2, '', 'boom'), /exited with code 2/);
  assert.equal(agentFailure(0, 'Here is the plan: pnpm --filter web test'), null);
});
