// Daemon configuration: ~/.config/aidlc/<owner>/<repo>/config.jsonc (operational, never spec content).
// The config lives OUTSIDE the consumer repo on purpose: an agent's PR must not be able to change
// how the daemon verifies it (invariant §2.7, one level further down).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { expandHome, parseDuration, readJsonc } from './util.mjs';

export const PHASES = ['plan', 'design', 'build', 'review', 'ship', 'learn'];
export const STATE_KEYS = ['triage', 'plan', 'design', 'build', 'review', 'staging', 'ship', 'done', 'canceled', 'backlog'];

const DEFAULTS = {
  linear: {
    apiUrl: 'https://api.linear.app/graphql',
    oauthUrl: 'https://api.linear.app/oauth',
    team: '',
    // Client-credentials scopes. app:assignable lets the daemon app be the delegate (the claim).
    daemonScopes: 'read,write,issues:create,comments:create,app:assignable',
    // Documents need write; Linear has no narrower scope for them, so the agent's token cannot be
    // content-only (tier 1). The actor check + revert (tiers 2 and 3) is what stops agent moves.
    agentScopes: 'read,write',
  },
  repo: { path: '', nwo: '', base: 'main', remote: 'origin' },
  states: {
    triage: 'Triage',
    plan: 'Plan',
    design: 'Design',
    build: 'Build+Test',
    review: 'Review',
    staging: 'In Staging',
    ship: 'Ship',
    done: 'Done',
    canceled: 'Canceled',
    backlog: '', // empty = the team's first backlog-type state (same rule as aidlc-slices.sh)
  },
  labels: { needsHuman: 'needs-a-human', flag: '' },
  owner: { mention: '', leadUserId: '' },
  poll: { eligible: '10m', parked: '30s', overlap: '60s' },
  kick: { bind: '', port: 8787 },
  runner: {
    command: 'opencode',
    args: ['run', '--standalone'],
    agent: 'aidlc-runner',
    maxConcurrent: 1,
    runAs: '',
    passEnv: [],
    retries: 2,
    backoff: '5m',
    killGrace: '30s',
  },
  models: {
    plan: 'aidlc-strong',
    design: 'aidlc-strong',
    build: 'aidlc-workhorse',
    review: 'aidlc-strong',
    ship: 'aidlc-strong',
    learn: 'aidlc-strong',
  },
  modelProvider: 'local',
  caps: { plan: '45m', design: '60m', build: '90m', review: '60m', ship: '60m', learn: '30m' },
  lanes: { dir: '', portStride: 10, evidenceDir: '.aidlc/evidence', maxEvidenceFiles: 10, maxEvidenceBytes: 10485760 },
  surface: { type: 'cli', simulator: { deviceType: '', runtime: '' } },
  ci: {
    mode: 'actions-cloud',
    requiredChecks: [],
    command: '',
    timeout: '30m',
    pendingTimeout: '60m',
    useBaseDefinitions: true,
    definitionPaths: [
      '.github/workflows/**',
      '.github/actions/**',
      '.pre-commit-config.yaml',
      '.husky/**',
      'lefthook.yml',
      'lefthook.yaml',
      '.githooks/**',
    ],
  },
  validation: { sliceCommand: '', timeout: '15m' },
  gates: { fence: true, humans: [] },
  breaker: { bounces: 5 },
  learn: { auto: true, threshold: 0.9 },
  review: { concurrency: 1 },
  park: { timeout: '' },
  secrets: { daemonEnvFile: '~/.config/aidlc/daemon.env', agentEnvFile: '~/.config/aidlc/agent.env' },
};

function merge(base, over) {
  if (Array.isArray(base) || typeof base !== 'object' || base === null) return over === undefined ? base : over;
  const out = { ...base };
  for (const [k, v] of Object.entries(over || {})) out[k] = k in base ? merge(base[k], v) : v;
  return out;
}

/** Resolve the config dir: explicit → $AIDLC_CONFIG_DIR → the single repo under ~/.config/aidlc. */
export function resolveConfigDir(explicit) {
  const dir = explicit || process.env.AIDLC_CONFIG_DIR;
  if (dir) return path.resolve(expandHome(dir));
  const root = path.join(os.homedir(), '.config', 'aidlc');
  const found = [];
  if (fs.existsSync(root)) {
    for (const owner of fs.readdirSync(root)) {
      const od = path.join(root, owner);
      if (!fs.statSync(od).isDirectory()) continue;
      for (const repo of fs.readdirSync(od)) {
        if (fs.existsSync(path.join(od, repo, 'config.jsonc'))) found.push(path.join(od, repo));
      }
    }
  }
  if (found.length === 1) return found[0];
  throw new Error(
    found.length === 0
      ? 'no daemon config: create ~/.config/aidlc/<owner>/<repo>/config.jsonc (see config.jsonc.example) or pass --config-dir'
      : `several daemon configs (${found.join(', ')}): pass --config-dir or set AIDLC_CONFIG_DIR`,
  );
}

export function loadConfig(configDir, overrides = {}) {
  const file = path.join(configDir, 'config.jsonc');
  if (!fs.existsSync(file)) throw new Error(`missing ${file} (copy config.jsonc.example)`);
  const cfg = merge(merge(DEFAULTS, readJsonc(file)), overrides);
  cfg.configDir = configDir;
  cfg.repo.path = path.resolve(expandHome(cfg.repo.path || '.'));
  cfg.lanes.dir = path.resolve(expandHome(cfg.lanes.dir || path.join(path.dirname(cfg.repo.path), 'aidlc-lanes', path.basename(cfg.repo.path))));
  cfg.secrets.daemonEnvFile = expandHome(cfg.secrets.daemonEnvFile);
  cfg.secrets.agentEnvFile = expandHome(cfg.secrets.agentEnvFile);
  cfg.ms = {
    eligible: parseDuration(cfg.poll.eligible),
    parked: parseDuration(cfg.poll.parked),
    overlap: parseDuration(cfg.poll.overlap),
    backoff: parseDuration(cfg.runner.backoff),
    killGrace: parseDuration(cfg.runner.killGrace),
    ciTimeout: parseDuration(cfg.ci.timeout),
    ciPending: parseDuration(cfg.ci.pendingTimeout),
    validation: parseDuration(cfg.validation.timeout),
    park: parseDuration(cfg.park.timeout, 0),
    caps: Object.fromEntries(PHASES.map((p) => [p, parseDuration(cfg.caps[p], 60 * 60e3)])),
  };
  return cfg;
}

/** Problems that make the daemon unsafe or unable to run. Empty list = OK. */
export function validateConfig(cfg) {
  const errs = [];
  if (!cfg.linear.team) errs.push('linear.team is required (the team key, e.g. ENG)');
  if (!/^[^/\s]+\/[^/\s]+$/.test(cfg.repo.nwo)) errs.push('repo.nwo must be owner/name');
  if (!fs.existsSync(path.join(cfg.repo.path, '.git'))) errs.push(`repo.path ${cfg.repo.path} is not a git checkout`);
  if (!['actions-cloud', 'actions-self-hosted', 'hooks-only'].includes(cfg.ci.mode)) errs.push(`ci.mode ${cfg.ci.mode} is not one of actions-cloud, actions-self-hosted, hooks-only`);
  if (cfg.ci.mode !== 'actions-cloud' && !cfg.ci.command) errs.push(`ci.mode ${cfg.ci.mode} needs ci.command (the daemon re-runs the suite itself)`);
  if (!['web', 'macos-app', 'cli'].includes(cfg.surface.type)) errs.push('surface.type must be web, macos-app or cli');
  for (const k of STATE_KEYS) if (k !== 'backlog' && !cfg.states[k]) errs.push(`states.${k} is empty`);
  for (const p of PHASES) if (!cfg.models[p]) errs.push(`models.${p} is empty`);
  if (cfg.runner.maxConcurrent < 1) errs.push('runner.maxConcurrent must be ≥ 1');
  if (cfg.breaker.bounces < 1) errs.push('breaker.bounces must be ≥ 1');
  return errs;
}
