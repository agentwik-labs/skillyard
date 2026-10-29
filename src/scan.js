// Heuristic security scan for skill bundles. Skills are instructions plus code that an agent will follow
// and run with the user's permissions, so a registry should look before it serves them.
// Critical findings block a publish; warnings are stored and shown next to the skill.

const SCRIPT_RE = /\.(py|sh|bash|zsh|js|mjs|cjs|ts|rb|pl|ps1)$/;
const TEXT_RE = /\.(md|txt|json|ya?ml|toml|py|sh|bash|zsh|js|mjs|cjs|ts|rb|pl|ps1|html|csv|sql)$/;

// [id, severity, where ('all' | 'script' | 'doc'), regex, message]
const RULES = [
  ['private-key', 'critical', 'all', /-----BEGIN (?:RSA |EC |OPENSSH |DSA |PGP )?PRIVATE KEY-----/, 'embedded private key'],
  ['aws-key', 'critical', 'all', /\b(?:AKIA|ASIA)(?![A-Z0-9]*EXAMPLE)[A-Z0-9]{16}\b/, 'AWS access key id'],
  ['github-token', 'critical', 'all', /\b(?:ghp|gho|ghs|ghu|github_pat)_[A-Za-z0-9_]{30,}\b/, 'GitHub token'],
  ['slack-token', 'critical', 'all', /\bxox[abpr]-[A-Za-z0-9-]{20,}\b/, 'Slack token'],
  ['ai-key', 'critical', 'all', /\bsk-(?:ant-)?[A-Za-z0-9_-]{32,}\b/, 'AI provider API key'],
  ['prompt-override', 'critical', 'doc', /\b(?:ignore|disregard|forget)\s+(?:all\s+|any\s+)?(?:previous|prior|earlier|above|system)\s+(?:instructions|prompts?|rules)\b/i, 'tries to override the agent\'s instructions'],
  ['conceal-from-user', 'critical', 'doc', /\b(?:do\s+not|don't|never)\s+(?:tell|inform|let)\s+the\s+user\s+(?:that\s+you|about\s+(?:this|these|the|any)\s+(?:action|change|command|step|file|request)s?|know)\b|\b(?:do\s+not|don't|never)\s+(?:tell|inform)\s+the\s+user\s*(?:[.!,;]|$)|\bwithout\s+(?:telling|informing|notifying)\s+the\s+user\b|\b(?:hide|conceal|keep)\s+(?:this|it|these\s+\w+)\s+(?:secret\s+)?from\s+the\s+user\b/i, 'asks the agent to hide actions from the user'],
  ['hidden-unicode', 'critical', 'all', /[\u202A-\u202E\u2066-\u2069]|[\u{E0000}-\u{E007F}]/u, 'bidi-control or Unicode tag characters (can hide instructions)'],
  ['zero-width', 'warning', 'all', /[\u200B\u200C\u2060-\u2064]|(?<!^)\uFEFF/u, 'zero-width characters'],
  ['pipe-to-shell', 'critical', 'script', /\b(?:curl|wget)\b[^\n|]*\|\s*(?:sudo\s+)?(?:ba|z)?sh\b/, 'downloads and runs remote code'],
  ['credential-read', 'critical', 'script', /(?:~|\$HOME|expanduser\([^)]*\)|homedir\(\))[^\n]{0,40}(?:\.ssh\/|\.aws\/credentials|\.netrc|\.docker\/config\.json|\.kube\/config|\.config\/gh\/hosts)/, 'reads credential files'],
  ['encoded-exec', 'critical', 'script', /\b(?:eval|exec)\s*\(\s*(?:base64|atob|bytes\.fromhex|codecs\.decode|zlib\.decompress|Buffer\.from)/, 'executes encoded or compressed code'],
  ['env-exfil', 'critical', 'script', /(?:requests\.(?:post|put)|urlopen|fetch|curl\s[^\n]*-d)[^\n]*(?:os\.environ|process\.env|\$\{?[A-Z_]*(?:TOKEN|KEY|SECRET)\b)/, 'sends environment secrets over the network'],
  ['destructive-rm', 'warning', 'script', /\brm\s+-[a-z]*r[a-z]*f?\s+(?:\/(?:\s|$)|~\/?(?:\s|$)|\$HOME\/?(?:\s|$)|\*)/, 'recursive delete of a broad path'],
  ['shell-true', 'warning', 'script', /subprocess\.[a-z_]+\([^)]*shell\s*=\s*True/, 'subprocess with shell=True'],
  ['network-call', 'warning', 'script', /\b(?:requests\.(?:get|post|put|delete)|urllib\.request|http\.client|fetch\(|axios|curl\s|wget\s|socket\.socket)/, 'makes network calls'],
  ['sudo', 'warning', 'script', /(?:^|\s)sudo\s/m, 'uses sudo'],
  ['chmod-777', 'warning', 'all', /chmod\s+(?:-R\s+)?777\b/, 'world-writable permissions'],
  ['auto-approve', 'warning', 'doc', /--dangerously-skip-permissions|--yolo\b|--dangerously-bypass-approvals/, 'tells the agent to bypass permission prompts'],
];

/**
 * Scan files ({relPath: Buffer}). Returns { critical, warning, findings: [{rule, severity, file, line, message}] }.
 * Documentation that quotes a dangerous pattern inside a fenced code block is reported as a warning, not critical,
 * so a skill can teach "never do X" with an example.
 */
export function scanFiles(files) {
  const findings = [];
  for (const [file, buf] of Object.entries(files)) {
    if (!TEXT_RE.test(file) && file !== 'SKILL.md') continue;
    const isScript = SCRIPT_RE.test(file);
    const text = buf.toString('utf8');
    const lines = text.split('\n');
    const fenced = fencedLines(lines, isScript);
    const seen = new Set();
    for (const [rule, severity, where, re, message] of RULES) {
      if (where === 'script' && !isScript) continue;
      if (where === 'doc' && isScript) continue;
      for (let i = 0; i < lines.length; i++) {
        if (!re.test(lines[i])) continue;
        const key = `${rule}:${i}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const quotedHere = severity === 'critical' && fenced.has(i) && !['hidden-unicode', 'private-key'].includes(rule) && !isSecretRule(rule);
        const benign = severity === 'critical' && !quotedHere && looksBenign(rule, lines[i], file);
        const sev = quotedHere || benign ? 'warning' : severity;
        const why = quotedHere ? (isScript ? 'in a comment, docstring or pattern' : 'inside an example block') : benign ? 'reads as a warning or local call, review' : '';
        findings.push({ rule, severity: sev, file, line: i + 1, message: why ? `${message} (${why})` : message });
        if (findings.filter((f) => f.rule === rule && f.file === file).length >= (severity === 'critical' ? 3 : 1)) break;
      }
    }
  }
  findings.sort((a, b) => (a.severity === b.severity ? a.file.localeCompare(b.file) || a.line - b.line : a.severity === 'critical' ? -1 : 1));
  return {
    critical: findings.filter((f) => f.severity === 'critical').length,
    warning: findings.filter((f) => f.severity === 'warning').length,
    findings,
  };
}

// Real-world skills quote attacks to warn the agent about them ("if a page says 'ignore previous instructions',
// flag it"), and local helper servers pass their own session token around. Those read as examples, not attacks.
const DEFENSIVE_RE = /\b(?:if|when)\s+(?:a|an|the|any)?\s*[\w-]*\s*(?:says|contains|tries|asks)|never\s+follow|not\s+(?:an?\s+)?instructions?|injection|data,?\s+not|treat\s+.{0,30}as\s+data|绝不|flag\s+it/i;
function looksBenign(rule, line, file) {
  if (rule === 'prompt-override') {
    const m = /\b(?:ignore|disregard|forget)\s+(?:all\s+|any\s+)?(?:previous|prior|earlier|above|system)/i.exec(line);
    const before = m ? line.slice(0, m.index) : '';
    const quoted = ((before.match(/["“'「]/g) || []).length % 2) === 1;
    return quoted || DEFENSIVE_RE.test(line) || file.endsWith('.json');
  }
  if (rule === 'conceal-from-user') return DEFENSIVE_RE.test(line);
  if (rule === 'env-exfil') return /\b(?:localhost|127\.0\.0\.1)\b/.test(line) || (!/\.(?:sh|bash|zsh)$/.test(file) && !/os\.environ|process\.env/.test(line));
  return false;
}

const isSecretRule = (r) => ['aws-key', 'github-token', 'slack-token', 'ai-key'].includes(r);

// Lines that quote rather than run: fenced blocks in docs; comments, docstrings and regex patterns in scripts
// (a linter that detects `curl | sh` has to mention it).
function fencedLines(lines, isScript) {
  const set = new Set();
  if (isScript) {
    let doc = false;
    lines.forEach((l, i) => {
      const quotes = (l.match(/"""|'''/g) || []).length;
      if (doc || quotes) set.add(i);
      if (quotes % 2 === 1) doc = !doc;
      if (/^\s*(#|\/\/|\*|\/\*)/.test(l) || /\bre\.(?:search|match|compile|findall|sub|fullmatch)\(|new RegExp\(|^\s*\(?\s*r?["'][^"']*["'],?\s*$/.test(l)) set.add(i);
    });
    return set;
  }
  let inside = false;
  lines.forEach((l, i) => {
    if (/^\s*(```|~~~)/.test(l)) { inside = !inside; return; }
    if (inside) set.add(i);
  });
  return set;
}
