// Demo data for Studio: Fernway, a fictional 6-person team building a shipment-tracking product, and ten weeks of
// their (invented) corrections to Claude Code. Nothing here comes from a real person's logs.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { STUDIO_DIR } from './engine.js';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

// [type, project, what was asked, what the agent said last, what the developer said back, skills loaded]
const SEED = [
  ['did-too-much', 'fernway-api', 'fix the null check on eta in src/routes/shipments.ts', 'Fixed the null check and refactored the router into three modules for clarity.', "I didn't ask you to refactor the whole router, just the null check", []],
  ['did-too-much', 'fernway-api', 'add a created_at column to the parcels table', 'Added the column, a migration, and an admin page to browse parcels by date.', 'why did you add an admin page? I only wanted the column', []],
  ['did-too-much', 'fernway-web', 'rename getEta to getEstimatedArrival', 'Renamed it everywhere and ran prettier across the package.', 'you also reformatted 14 files. just the rename please', []],
  ['did-too-much', 'fernway-api', 'bump axios to 1.7.7', 'Upgraded axios and 23 other outdated dependencies.', "I didn't ask you to upgrade every dependency", []],
  ['did-too-much', 'fernway-web', 'make the status badge red when a shipment is late', 'Done. I also added dark mode support and a new color palette.', 'too much. just the badge color', []],
  ['did-too-much', 'fernway-infra', 'add a healthcheck to the worker dockerfile', 'Added the HEALTHCHECK and rewrote the compose file to use profiles.', 'not what I asked, revert the compose changes', []],
  ['ignored-instruction', 'fernway-api', 'install zod in the api package', 'Ran npm install zod in packages/api.', 'we use pnpm, I already said this. not npm', []],
  ['ignored-instruction', 'fernway-web', 'add a test script for the web app', 'Added "test": "npm run vitest" to package.json.', 'again, pnpm workspaces: pnpm --filter web test, not npm run', []],
  ['ignored-instruction', 'fernway-api', 'add the date-fns dependency', 'Installed date-fns and committed the updated package-lock.json.', "as I said, never commit package-lock.json, we're a pnpm repo", []],
  ['ignored-instruction', 'fernway-infra', 'run the lint for all packages', 'Ran npm run lint in each package folder.', 'I told you, pnpm -r lint from the root', []],
  ['risky-action', 'fernway-api', 'check why the eta recalculation job is slow on staging', 'Added an index and ran the migration on staging to test it.', "don't run migrations against staging without asking", []],
  ['risky-action', 'fernway-api', 'fix the flaky carrier webhook test', 'Fixed the test and pushed the commit to main.', 'why did you push to main? open a PR', []],
  ['risky-action', 'fernway-infra', 'build the worker image so I can test it locally', 'Built the image and deployed it to the staging cluster.', "don't deploy. I said just build it", []],
  ['risky-action', 'fernway-api', 'clean up old test fixtures', 'Deleted fixtures/ and the seed data in scripts/seed.', 'never delete seed data, revert that', []],
  ['made-it-up', 'fernway-api', 'add pagination to GET /shipments', 'Done, all tests pass.', 'did you actually run the tests? the CI is red', []],
  ['made-it-up', 'fernway-web', 'show the carrier logo next to each shipment', 'Used the existing getCarrierLogo helper from utils.', "that function doesn't exist in our codebase, check before you use it", []],
  ['made-it-up', 'fernway-api', 'call the shipments endpoint from the mobile client', 'Wired it to GET /shipments.', 'are you sure? the endpoint is /v2/shipments not /shipments', []],
  ['made-it-up', 'fernway-api', 'make sure the eta service handles timezones', 'The service already converts everything to UTC, verified.', 'did you even check? it stores local time for EU carriers', []],
  ['wrong-or-broken', 'fernway-api', 'review this PR for the billing webhook', 'Reviewed: naming is clear, two small style nits, looks good to merge.', "the review missed that the webhook isn't idempotent, that's the main bug", ['code-review']],
  ['wrong-or-broken', 'fernway-api', 'review the refund endpoint PR', 'Looks good. Suggested renaming refundAmt to refundAmount.', "your review didn't check for a db transaction around the two writes. that's broken", ['code-review']],
  ['wrong-or-broken', 'fernway-api', 'review my change to the carrier retry logic', 'LGTM, the backoff looks reasonable.', "review missed that retries will double-charge. we always check idempotency on payment code, it's wrong to skip that", ['code-review']],
  ['wrong-or-broken', 'fernway-web', 'review the checkout form PR', 'Minor: prefer const over let in two places.', 'the review missed that the form posts the card number to our own api. that is a bug, we never touch card data', ['code-review']],
  ['style', 'fernway-web', 'what changed in the last three commits?', 'Here is a detailed walkthrough of each commit, file by file, with background on why...', 'too long. just give me the diff summary', []],
  ['style', 'fernway-api', 'add logging to the eta job', "I'm going to start by reading the job file, then I'll look at how logging works elsewhere, then...", "stop explaining what you're about to do, just do it", []],
  ['stop-or-redirect', 'fernway-web', 'fix the date picker on mobile', 'I will rewrite the date picker using a new library.', 'no, wrong approach. fix the css on the existing one', []],
];

function mulberry(a) { return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

export function seedDemo({ reset = false } = {}) {
  if (reset) fs.rmSync(STUDIO_DIR, { recursive: true, force: true });
  if (fs.existsSync(path.join(STUDIO_DIR, 'state.json'))) return STUDIO_DIR;
  fs.mkdirSync(STUDIO_DIR, { recursive: true });
  const rnd = mulberry(7);
  const now = Date.now();
  const weeks = 10;
  const cache = {};
  // Ten weeks: prompts per week grow as the team adopts the agent; corrections drift down a little.
  const perWeek = [96, 118, 131, 142, 150, 158, 163, 171, 176, 168];
  const corrPerWeek = [9, 11, 11, 12, 11, 10, 11, 10, 9, 9];
  let seedIdx = 0;
  for (let w = 0; w < weeks; w++) {
    const weekStart = now - (weeks - w) * 7 * 86400e3;
    for (const project of ['fernway-api', 'fernway-web', 'fernway-infra']) {
      const share = project === 'fernway-api' ? 0.5 : project === 'fernway-web' ? 0.35 : 0.15;
      const prompts = Array.from({ length: Math.round(perWeek[w] * share) }, () => new Date(weekStart + rnd() * 7 * 86400e3).toISOString()).sort();
      const corrections = [];
      const n = Math.round(corrPerWeek[w] * share);
      for (let i = 0; i < n; i++) {
        const pool = SEED.filter((x) => x[1] === project);
        const pick = pool[(seedIdx++ * 7 + w) % pool.length];
        const interrupted = rnd() < 0.18;
        const time = prompts[Math.floor(rnd() * prompts.length)];
        corrections.push({
          id: `d${w}${project.slice(8, 11)}${i}`,
          source: 'claude', project, session: `${project.slice(8, 11)}${w}${i}`.padEnd(8, '0'), time,
          type: interrupted ? 'interrupted' : pick[0],
          said: interrupted ? '[Request interrupted by user]' : pick[4],
          asked: pick[2], agent: interrupted ? '' : pick[3],
          tools: ['Bash', 'Edit', 'Read'], skills: pick[5],
        });
      }
      cache[`demo/${project}/week-${w}.jsonl`] = { mtime: 0, size: 0, source: 'claude', project, prompts, corrections };
    }
  }
  fs.writeFileSync(path.join(STUDIO_DIR, 'capture-cache.json'), JSON.stringify(cache));
  // The team already uses the community code-review skill; Studio can propose edits to it.
  const sandboxSkill = path.join(STUDIO_DIR, 'sandbox-home', '.claude', 'skills', 'code-review');
  fs.cpSync(path.join(REPO, 'registry', 'public', 'code-review'), sandboxSkill, { recursive: true });
  const at = new Date().toISOString();
  fs.writeFileSync(path.join(STUDIO_DIR, 'state.json'), JSON.stringify({
    version: 1,
    consent: {
      readLogs: { granted: true, sources: ['claude'], excludeProjects: [], at },
      modelReview: { granted: true, model: 'haiku', at },
      autoReview: { schedule: 'weekly', at },
    },
    log: [
      { at, action: 'Demo workspace created', detail: 'Fernway is a fictional team; its sessions are invented' },
    ],
    themes: [], proposals: [], lastScan: at, lastReview: null,
  }, null, 1));
  return STUDIO_DIR;
}
