// Test harness: a real git origin + daemon checkout, the in-memory Linear mock, a fake GitHub, and
// the fake opencode. Each test gets a fresh world.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadConfig } from '../lib/config.mjs';
import { Engine } from '../lib/engine.mjs';
import { linearClients } from '../lib/daemon.mjs';
import { Store } from '../lib/store.mjs';
import { loadTransitions } from '../lib/transitions.mjs';
import { createLinearMock } from './linear-mock.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const DAEMON_KEY = 'lin_api_DAEMONfullkey0000000000';
export const AGENT_KEY = 'lin_api_AGENTcontentkey000000000';
export const HUMAN_KEY = 'lin_api_HUMANkey000000000000000';
export const BOT = 'user-bot'; // the daemon's app user (OAuth app "AIDLC Daemon", actor=app)
export const AGENT = 'user-agent'; // the agent's app user (OAuth app "AIDLC Agent")
export const HUMAN = 'user-melissa';
export const APPS = {
  daemon: { clientId: 'client-daemon', secret: 'secret-daemon-0000000000' },
  agent: { clientId: 'client-agent', secret: 'secret-agent-00000000000' },
};

const git = (cwd, ...a) => execFileSync('git', a, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@example.invalid', GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@example.invalid' } }).trim();

export class FakeGitHub {
  constructor(world) {
    this.world = world;
    this.prs = [];
    this.checkRuns = {};
    this.files = {};
    this.findings = {};
    this.calls = [];
  }
  async findPr(branch) {
    this.calls.push(['findPr', branch]);
    const p = this.prs.filter((x) => x.branch === branch).sort((a, b) => b.number - a.number)[0];
    return p ? { ...p } : null;
  }
  async changedFiles(n) {
    return this.files[n] || [];
  }
  async reviewFindings(n) {
    return this.findings[n] || [];
  }
  async checks(sha) {
    return this.checkRuns[sha] || [];
  }
  /** Open a PR for whatever the agent pushed to `branch`. */
  openPr(branch, { draft = false } = {}) {
    const { origin } = this.world;
    const headSha = git(origin, 'rev-parse', `refs/heads/${branch}`);
    const baseSha = git(origin, 'rev-parse', 'refs/heads/main');
    const pr = { number: 100 + this.prs.length + 1, branch, state: 'OPEN', isDraft: draft, headSha, baseSha, baseRef: 'main', mergeSha: null, mergedBy: null, title: branch, url: `https://github.com/acme/app/pull/${101 + this.prs.length}` };
    this.prs.push(pr);
    return pr;
  }
  refresh(pr) {
    pr.headSha = git(this.world.origin, 'rev-parse', `refs/heads/${pr.branch}`);
  }
  /** The human merges in GitHub: a real --no-ff merge pushed to origin/main. */
  merge(pr, by = 'melissa') {
    const h = this.world.human;
    git(h, 'fetch', '-q', 'origin');
    git(h, 'checkout', '-q', 'main');
    git(h, 'reset', '-q', '--hard', 'origin/main');
    git(h, 'merge', '-q', '--no-ff', '-m', `Merge ${pr.branch}`, `origin/${pr.branch}`);
    git(h, 'push', '-q', 'origin', 'main');
    pr.state = 'MERGED';
    pr.mergeSha = git(h, 'rev-parse', 'HEAD');
    pr.mergedBy = by;
    return pr.mergeSha;
  }
  green(sha, names = ['test']) {
    this.checkRuns[sha] = names.map((name) => ({ name, status: 'completed', conclusion: 'success' }));
  }
  red(sha, name = 'test') {
    this.checkRuns[sha] = [{ name, status: 'completed', conclusion: 'failure' }];
  }
}

export async function world(overrides = {}, { script = {}, legacyKeys = false } = {}) {
  const tmp = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'aidlc-daemon-test-')));
  const w = { tmp, origin: path.join(tmp, 'origin.git'), human: path.join(tmp, 'human'), repo: path.join(tmp, 'repo'), configDir: path.join(tmp, 'config'), ocDir: path.join(tmp, 'oc') };
  let offset = 0;
  w.now = () => Date.now() + offset;
  w.advance = (ms) => {
    offset += ms;
  };

  git(tmp, 'init', '-q', '--bare', '-b', 'main', w.origin);
  git(tmp, 'clone', '-q', w.origin, w.human);
  fs.mkdirSync(path.join(w.human, '.github', 'workflows'), { recursive: true });
  fs.writeFileSync(path.join(w.human, '.github', 'workflows', 'ci.yml'), 'on: [pull_request]\n');
  fs.writeFileSync(path.join(w.human, 'check.sh'), '#!/bin/sh\ntest ! -f FAIL\n');
  fs.chmodSync(path.join(w.human, 'check.sh'), 0o755);
  fs.writeFileSync(path.join(w.human, 'README.md'), '# app\n');
  git(w.human, 'add', '-A');
  git(w.human, 'commit', '-qm', 'init');
  git(w.human, 'push', '-q', 'origin', 'HEAD:main');
  git(tmp, 'clone', '-q', w.origin, w.repo);

  w.mock = await createLinearMock({ now: w.now }).start();
  w.mock.addUser(HUMAN, 'Melissa', HUMAN_KEY);
  w.mock.addUser('user-other', 'Other', null);
  if (legacyKeys) {
    // P1-style: one bot MEMBER seat with two personal API keys. Linear refuses a member as delegate.
    w.mock.addUser(BOT, 'AIDLC Bot', DAEMON_KEY);
    w.mock.addUser(BOT, 'AIDLC Bot', AGENT_KEY);
  } else {
    w.mock.addApp({ clientId: APPS.daemon.clientId, secret: APPS.daemon.secret, userId: BOT, name: 'AIDLC Daemon' });
    w.mock.addApp({ clientId: APPS.agent.clientId, secret: APPS.agent.secret, userId: AGENT, name: 'AIDLC Agent' });
    // A stolen daemon credential in tests = a personal-style key resolving to the daemon app user.
    w.mock.addUser(BOT, 'AIDLC Daemon', DAEMON_KEY, { app: true });
  }
  w.mock.addLabel('needs-a-human');
  w.mock.addLabel('aidlc-flag');

  fs.mkdirSync(w.configDir, { recursive: true });
  fs.mkdirSync(w.ocDir, { recursive: true });
  fs.writeFileSync(path.join(w.ocDir, 'script.json'), JSON.stringify(script));
  const fakeOc = path.join(HERE, 'fake-opencode.mjs');
  fs.chmodSync(fakeOc, 0o755);
  const cfgObj = {
    linear: { apiUrl: w.mock.url, oauthUrl: `${w.mock.server.url}/oauth`, team: 'ENG' },
    repo: { path: w.repo, nwo: 'acme/app', base: 'main' },
    owner: { mention: '@melissa', leadUserId: HUMAN },
    labels: { needsHuman: 'needs-a-human', flag: 'aidlc-flag' },
    lanes: { dir: path.join(tmp, 'lanes') },
    runner: { command: fakeOc, passEnv: ['FAKE_OC_DIR', 'FAKE_LINEAR_URL'], retries: 1, backoff: '1s', killGrace: '1s' },
    caps: { plan: '20s', design: '20s', build: '20s', review: '20s', ship: '20s', learn: '20s' },
    ci: { mode: 'actions-cloud' },
    github: { botLogin: 'aidlc-bot' },
  };
  const deep = (base, over) => {
    for (const [k, v] of Object.entries(over)) base[k] = v && typeof v === 'object' && !Array.isArray(v) && base[k] && typeof base[k] === 'object' ? deep({ ...base[k] }, v) : v;
    return base;
  };
  deep(cfgObj, overrides);
  fs.writeFileSync(path.join(w.configDir, 'config.jsonc'), '// test config\n' + JSON.stringify(cfgObj, null, 2));
  fs.copyFileSync(path.join(HERE, '..', 'transitions.json.example'), path.join(w.configDir, 'transitions.json'));

  process.env.FAKE_OC_DIR = w.ocDir;
  process.env.FAKE_LINEAR_URL = w.mock.url;
  w.cfg = loadConfig(w.configDir);
  w.secrets = legacyKeys
    ? {
        daemon: { AIDLC_LINEAR_DAEMON_KEY: DAEMON_KEY, AIDLC_GH_READ_TOKEN: 'ghp_DAEMONreadonly000000', AIDLC_KICK_TOKEN: '' },
        agent: { AIDLC_LINEAR_AGENT_KEY: AGENT_KEY, AIDLC_LLM_BASE_URL: 'http://127.0.0.1:1/v1', GH_TOKEN: 'ghp_AGENTpushtoken00000' },
      }
    : {
        daemon: {
          AIDLC_LINEAR_DAEMON_CLIENT_ID: APPS.daemon.clientId,
          AIDLC_LINEAR_DAEMON_CLIENT_SECRET: APPS.daemon.secret,
          AIDLC_LINEAR_AGENT_CLIENT_ID: APPS.agent.clientId,
          AIDLC_LINEAR_AGENT_CLIENT_SECRET: APPS.agent.secret,
          AIDLC_GH_READ_TOKEN: 'ghp_DAEMONreadonly000000',
          AIDLC_KICK_TOKEN: '',
        },
        agent: { AIDLC_LLM_BASE_URL: 'http://127.0.0.1:1/v1', GH_TOKEN: 'ghp_AGENTpushtoken00000' },
      };
  w.gh = new FakeGitHub(w);
  w.store = new Store(w.configDir, { now: w.now });
  w.store.save(); // the daemon is installed before any gate in these tests
  w.logs = [];
  const { linear, agentAuth } = linearClients(w.cfg, w.secrets);
  w.engine = await new Engine({
    cfg: w.cfg,
    transitions: loadTransitions(path.join(w.configDir, 'transitions.json')),
    linear,
    agentAuth,
    github: w.gh,
    store: w.store,
    secrets: w.secrets,
    now: w.now,
    log: (m) => w.logs.push(m),
  }).init();

  w.tick = async ({ full = true } = {}) => {
    await w.engine.tick({ full });
  };
  /** Tick, wait for runs, tick again — until nothing is running. */
  w.settle = async (max = 8) => {
    for (let i = 0; i < max; i++) {
      await w.engine.tick({ full: true });
      if (!w.engine.runner.live.size) {
        const pending = Object.values(w.store.data.issues).some((r) => r.exits.length);
        if (!pending) return;
        continue;
      }
      await w.engine.runner.idle();
    }
  };
  w.calls = () =>
    fs.existsSync(path.join(w.ocDir, 'calls.jsonl'))
      ? fs.readFileSync(path.join(w.ocDir, 'calls.jsonl'), 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l))
      : [];
  w.script = (s) => fs.writeFileSync(path.join(w.ocDir, 'script.json'), JSON.stringify(s));
  w.events = () => w.store.readEvents({ limit: 1000 });
  w.originHas = (ref) => {
    try {
      git(w.origin, 'rev-parse', '--verify', '--quiet', ref);
      return true;
    } catch {
      return false;
    }
  };
  w.close = async () => {
    await w.engine.runner.idle();
    await w.mock.stop();
    fs.rmSync(tmp, { recursive: true, force: true });
  };
  /** A Feature the human has already taken through Plan (so we start at the gate under test). */
  w.feature = (title = 'CSV export', state = 'Triage') => w.mock.createIssue({ title, state, creatorId: HUMAN });
  return w;
}

export const TECH_SPEC = (slices) => `# Tech Spec — CSV export

## Slice plan

\`\`\`aidlc-slices
${JSON.stringify({ version: 1, slices }, null, 2)}
\`\`\`
`;

export const TWO_SLICES = [
  { key: 'export-api', title: 'CSV export endpoint', section: '3.1', acceptance: ['GET /export returns text/csv'], blockedBy: [] },
  { key: 'export-ui', title: 'Export button', section: '3.2', acceptance: ['Button downloads CSV'], blockedBy: ['export-api'] },
];
