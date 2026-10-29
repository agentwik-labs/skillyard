// Model Context Protocol (JSON-RPC 2.0) handler. Transport-agnostic: the HTTP server (Streamable HTTP)
// and the stdio command both feed messages through handleMessage().
//
// `registry` is any object with: search(opts), get(scope, name, version), readFile(scope, name, version, path).
// LocalRegistry (server side) and RemoteRegistry (CLI side) both implement it.
import { parseSkillRef } from './skill.js';

export const PROTOCOL_VERSIONS = ['2025-06-18', '2025-03-26', '2024-11-05'];
const SERVER_INFO = { name: 'skillyard', title: 'Skillyard skill registry', version: '0.1.0' };
const INSTRUCTIONS = [
  'Skillyard holds reusable skills: tested instructions for specific kinds of work, including your organization\'s private',
  'playbooks (deploy runbooks, code standards, compliance rules, brand voice).',
  'Before starting a non-trivial task, call search_skills with a few keywords. If a skill matches, call get_skill and',
  'follow its instructions; use read_skill_file for any references/ templates/ or scripts/ it mentions.',
  'Company skills (@<org>/...) override general community skills when they conflict.',
].join(' ');

const TOOLS = [
  {
    name: 'search_skills',
    title: 'Search skills',
    description: 'Search the skill registry by keywords. Returns matching skills (id, title, summary, category). Use before starting a task to find a relevant playbook.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Keywords, e.g. "deploy rollback" or "code review"' },
        scope: { type: 'string', description: 'Limit to one org, e.g. "acme" (optional)' },
        category: { type: 'string', description: 'Limit to a category, e.g. "security" (optional)' },
        limit: { type: 'number', description: 'Max results (default 10)' },
      },
    },
    annotations: { readOnlyHint: true },
  },
  {
    name: 'get_skill',
    title: 'Get skill instructions',
    description: 'Fetch a skill\'s full SKILL.md instructions and its file list. Pass an id like "@acme/deploy-runbook" or a bare community name like "code-review".',
    inputSchema: {
      type: 'object',
      properties: {
        skill: { type: 'string', description: 'Skill id, optionally with a version: "@acme/deploy-runbook@1.0.0"' },
      },
      required: ['skill'],
    },
    annotations: { readOnlyHint: true },
  },
  {
    name: 'read_skill_file',
    title: 'Read a skill file',
    description: 'Read a supporting file (references/, templates/, scripts/) from a skill.',
    inputSchema: {
      type: 'object',
      properties: {
        skill: { type: 'string', description: 'Skill id, e.g. "@acme/incident-response"' },
        path: { type: 'string', description: 'Relative path inside the skill, e.g. "templates/status-update.md"' },
      },
      required: ['skill', 'path'],
    },
    annotations: { readOnlyHint: true },
  },
];

export function createMcpHandler(registry) {
  const handlers = {
    initialize: (params = {}) => ({
      protocolVersion: PROTOCOL_VERSIONS.includes(params.protocolVersion) ? params.protocolVersion : PROTOCOL_VERSIONS[0],
      capabilities: { tools: { listChanged: false }, prompts: { listChanged: false }, resources: { listChanged: false } },
      serverInfo: SERVER_INFO,
      instructions: INSTRUCTIONS,
    }),
    ping: () => ({}),
    'tools/list': () => ({ tools: TOOLS }),
    'tools/call': (params = {}) => callTool(registry, params.name, params.arguments || {}),
    'prompts/list': async () => {
      const skills = await registry.search({ limit: 500 });
      return {
        prompts: skills.map((s) => ({
          name: promptName(s.id),
          title: `${s.title} (${s.id})`,
          description: s.summary,
        })),
      };
    },
    'prompts/get': async (params = {}) => {
      const ref = fromPromptName(params.name);
      const info = await registry.get(ref.scope, ref.name, 'latest');
      const task = params.arguments?.task ? `\n\nTask: ${params.arguments.task}` : '';
      return {
        description: info.summary,
        messages: [{ role: 'user', content: { type: 'text', text: `${skillText(info)}${task}` } }],
      };
    },
    'resources/list': async () => {
      const skills = await registry.search({ limit: 500 });
      return {
        resources: skills.map((s) => ({
          uri: `skill://${s.id}/SKILL.md`,
          name: s.id,
          title: s.title,
          description: s.summary,
          mimeType: 'text/markdown',
        })),
      };
    },
    'resources/templates/list': () => ({
      resourceTemplates: [{ uriTemplate: 'skill://@{scope}/{name}/{path}', name: 'skill-file', title: 'A file inside a skill', mimeType: 'text/plain' }],
    }),
    'resources/read': async (params = {}) => {
      const m = /^skill:\/\/@([a-z0-9-]+)\/([a-z0-9-]+)\/(.+)$/.exec(params.uri || '');
      if (!m) throw rpcError(-32602, 'unknown resource uri');
      const text = await registry.readFile(m[1], m[2], 'latest', m[3]);
      return { contents: [{ uri: params.uri, mimeType: m[3].endsWith('.md') ? 'text/markdown' : 'text/plain', text }] };
    },
  };

  /** Handle one parsed JSON-RPC message or batch. Returns the response (or null for notifications). */
  return async function handleMessage(msg) {
    if (Array.isArray(msg)) {
      const out = (await Promise.all(msg.map(handleOne))).filter(Boolean);
      return out.length ? out : null;
    }
    return handleOne(msg);
  };

  async function handleOne(msg) {
    if (!msg || msg.jsonrpc !== '2.0' || typeof msg.method !== 'string') {
      if (msg && ('result' in msg || 'error' in msg)) return null; // a response from the client; nothing to do
      return { jsonrpc: '2.0', id: msg?.id ?? null, error: { code: -32600, message: 'invalid request' } };
    }
    const isNotification = !('id' in msg);
    const fn = handlers[msg.method];
    if (isNotification) return null;
    if (!fn) return { jsonrpc: '2.0', id: msg.id, error: { code: -32601, message: `method not found: ${msg.method}` } };
    try {
      return { jsonrpc: '2.0', id: msg.id, result: await fn(msg.params) };
    } catch (e) {
      if (e.rpc) return { jsonrpc: '2.0', id: msg.id, error: e.rpc };
      return { jsonrpc: '2.0', id: msg.id, error: { code: -32603, message: e.message } };
    }
  }
}

async function callTool(registry, name, args) {
  try {
    if (name === 'search_skills') {
      const results = await registry.search({ q: args.query || '', scope: args.scope, category: args.category, limit: Math.min(Number(args.limit) || 10, 50) });
      if (!results.length) return text(`No skills match "${args.query || ''}".`);
      const lines = results.map((s) => `- ${s.id} — ${s.title} [${s.category}${s.visibility === 'private' ? ', private' : ''}]: ${s.summary}`);
      return {
        content: [{ type: 'text', text: `${results.length} skill(s):\n${lines.join('\n')}\n\nCall get_skill with an id to load its instructions.` }],
        structuredContent: { results: results.map(({ score, ...s }) => s) },
      };
    }
    if (name === 'get_skill') {
      const ref = parseSkillRef(args.skill);
      if (!ref) return text(`Invalid skill id "${args.skill}". Use "@org/name" or a bare community name.`, true);
      const info = await registry.get(ref.scope, ref.name, ref.version);
      return text(skillText(info));
    }
    if (name === 'read_skill_file') {
      const ref = parseSkillRef(args.skill);
      if (!ref) return text(`Invalid skill id "${args.skill}".`, true);
      return text(await registry.readFile(ref.scope, ref.name, ref.version, args.path));
    }
    throw rpcError(-32602, `unknown tool: ${name}`);
  } catch (e) {
    if (e.rpc) throw e;
    return text(`Error: ${e.message}`, true);
  }
}

function skillText(info) {
  const others = info.files.filter((f) => f !== 'SKILL.md' && f !== 'skill.json');
  const header = [
    `# Skill ${info.id}@${info.version}`,
    `Supporting files${others.length ? ` (read with read_skill_file): ${others.join(', ')}` : ': none'}`,
    'Scripts are not executed by the registry. To run one, install the skill locally: npx skillyard install ' + info.id,
    '',
    '---',
    '',
  ].join('\n');
  return header + info.skillMd;
}

const text = (t, isError = false) => ({ content: [{ type: 'text', text: t }], isError });
const promptName = (id) => id.slice(1).replace('/', '.');
function fromPromptName(n) {
  const m = /^([a-z0-9-]+)\.([a-z0-9-]+)$/.exec(n || '');
  if (!m) throw rpcError(-32602, `unknown prompt: ${n}`);
  return { scope: m[1], name: m[2] };
}
function rpcError(code, message) {
  const e = new Error(message);
  e.rpc = { code, message };
  return e;
}
