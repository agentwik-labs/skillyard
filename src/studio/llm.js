// Model calls for Studio go through the user's own agent CLI (claude -p), from an empty temp folder with no tools
// at all (--tools ""), no MCP servers and default permissions, so the model can only read what we send and answer in text.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { LOCKDOWN } from '../eval.js';

export const LLM_TMP_PREFIX = 'skillyard-llm-';

// The agent CLI reports account problems as ordinary output with a non-zero exit. Those are failures to run, never
// answers to grade: scoring them would turn a billing hiccup into "this skill made things worse".
const FAILURE_RE = /can't use your Claude subscription|payment is past due|Not logged in|Please run \/login|Credit balance is too low|rate limit|usage limit|overloaded_error|API Error: \d{3}|Invalid API key/i;
export function agentFailure(code, out = '', err = '') {
  const text = `${out}\n${err}`;
  const m = FAILURE_RE.exec(text);
  if (m) return `the agent could not run: ${text.slice(Math.max(0, m.index - 40), m.index + 120).trim().replace(/\s+/g, ' ')}`;
  if (code !== 0) return `the agent exited with code ${code}${err.trim() ? `: ${err.trim().slice(0, 200)}` : ''}`;
  return null;
}

export function ask(prompt, { model = 'haiku', timeoutMs = 180000 } = {}) {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), LLM_TMP_PREFIX));
  return new Promise((resolve, reject) => {
    const child = spawn('claude', ['-p', prompt, '--output-format', 'text', '--model', model, ...LOCKDOWN, '--tools', ''], {
      cwd, stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, CLAUDE_CODE_ENTRYPOINT: 'skillyard-studio' },
    });
    let out = '';
    let err = '';
    const timer = setTimeout(() => child.kill('SIGTERM'), timeoutMs);
    child.stdout.on('data', (d) => { out += d; });
    child.stderr.on('data', (d) => { err += d; });
    child.on('error', (e) => { clearTimeout(timer); reject(new Error(`could not run claude: ${e.message}`)); });
    child.on('close', (code) => {
      clearTimeout(timer);
      fs.rmSync(cwd, { recursive: true, force: true });
      const failure = agentFailure(code, out, err);
      if (failure) reject(Object.assign(new Error(failure), { agentFailure: true }));
      else resolve(out.trim());
    });
  });
}

/** Ask for JSON; tolerate prose or code fences around it. */
export async function askJson(prompt, opts) {
  const text = await ask(`${prompt}\n\nRespond with JSON only. No prose, no code fences.`, opts);
  const start = text.search(/[[{]/);
  const end = Math.max(text.lastIndexOf('}'), text.lastIndexOf(']'));
  if (start < 0 || end < start) throw new Error(`model did not return JSON: ${text.slice(0, 200)}`);
  return JSON.parse(text.slice(start, end + 1));
}

/** LLM-as-judge for one criterion. Returns true/false. */
export async function judge(output, criterion, opts) {
  const verdict = await ask([
    'You grade an AI assistant\'s answer against one criterion. Be strict and literal.',
    `Criterion: ${criterion}`,
    'Answer:',
    '<<<',
    output.slice(0, 6000),
    '>>>',
    'Reply with exactly PASS or FAIL.',
  ].join('\n'), opts);
  return /\bPASS\b/.test(verdict) && !/\bFAIL\b/.test(verdict);
}
