// Two principals, two sets of secrets (plan §3). The daemon's full Linear key and its read-only
// GitHub token are loaded into this process's memory only. Agent processes get an env built from
// an allowlist — they never inherit this process's environment.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import { parseEnvFile } from './util.mjs';

// Recommended: two Linear OAuth apps (actor=app) with client credentials — "AIDLC Daemon" (the delegate,
// the only state-moving identity) and "AIDLC Agent" (a separate app user; the daemon mints one token per
// run and revokes it when the run ends). AIDLC_LINEAR_DAEMON_KEY / agent.env AIDLC_LINEAR_AGENT_KEY are the
// static alternative (a member seat cannot be a delegate, so the claim fails closed with those).
export const DAEMON_SECRET_NAMES = [
  'AIDLC_LINEAR_DAEMON_KEY',
  'AIDLC_LINEAR_DAEMON_CLIENT_ID',
  'AIDLC_LINEAR_DAEMON_CLIENT_SECRET',
  'AIDLC_LINEAR_AGENT_CLIENT_ID',
  'AIDLC_LINEAR_AGENT_CLIENT_SECRET',
  'AIDLC_GH_READ_TOKEN',
  'AIDLC_KICK_TOKEN',
];

/** Names the agent may never receive, whatever the agent env file or passEnv says. */
const FORBIDDEN_AGENT_NAMES = new Set([...DAEMON_SECRET_NAMES, 'AIDLC_LINEAR_DAEMON_KEY_CMD', 'AIDLC_GH_READ_TOKEN_CMD', 'LINEAR_ROBOT_KEY', 'LINEAR_API_KEY']);

/** Base variables an agent shell needs to work at all. Nothing secret. */
const BASE_ALLOW = ['PATH', 'HOME', 'USER', 'LOGNAME', 'SHELL', 'LANG', 'LC_ALL', 'LC_CTYPE', 'TERM', 'TMPDIR', 'TZ', 'XDG_CONFIG_HOME', 'XDG_DATA_HOME', 'XDG_CACHE_HOME', 'XDG_STATE_HOME', 'DEVELOPER_DIR'];

function readEnvFile(file) {
  if (!file || !fs.existsSync(file)) return {};
  const st = fs.statSync(file);
  if (process.platform !== 'win32' && (st.mode & 0o077) !== 0) {
    throw new Error(`${file} is readable by other users (mode ${(st.mode & 0o777).toString(8)}): chmod 600 it`);
  }
  return parseEnvFile(fs.readFileSync(file, 'utf8'));
}

function fromCmd(cmd) {
  // e.g. AIDLC_LINEAR_DAEMON_KEY_CMD="security find-generic-password -s aidlc-linear-daemon -w"
  return execFileSync('/bin/sh', ['-c', cmd], { encoding: 'utf8', env: { PATH: process.env.PATH } }).trim();
}

/**
 * Load secrets. Precedence per name: <NAME>_CMD (keychain etc.) → env file → this process's env.
 * Returns { daemon: {...}, agent: {...} }.
 */
export function loadSecrets(cfg, env = process.env) {
  const dfile = readEnvFile(cfg.secrets.daemonEnvFile);
  const afile = readEnvFile(cfg.secrets.agentEnvFile);
  const daemon = {};
  for (const name of DAEMON_SECRET_NAMES) {
    const cmd = dfile[`${name}_CMD`] || env[`${name}_CMD`];
    daemon[name] = cmd ? fromCmd(cmd) : dfile[name] || env[name] || '';
  }
  const agent = {};
  for (const [k, v] of Object.entries(afile)) agent[k] = v;
  for (const k of ['AIDLC_LLM_BASE_URL', 'AIDLC_LINEAR_AGENT_KEY', 'GH_TOKEN']) if (!agent[k] && env[k]) agent[k] = env[k];
  return { daemon, agent };
}

/** Problems with the split. Any entry here blocks dispatch. */
export function secretProblems(secrets) {
  const errs = [];
  const { daemon, agent } = secrets;
  const daemonApp = daemon.AIDLC_LINEAR_DAEMON_CLIENT_ID && daemon.AIDLC_LINEAR_DAEMON_CLIENT_SECRET;
  const agentApp = daemon.AIDLC_LINEAR_AGENT_CLIENT_ID && daemon.AIDLC_LINEAR_AGENT_CLIENT_SECRET;
  if (!daemonApp && !daemon.AIDLC_LINEAR_DAEMON_KEY) errs.push('no daemon Linear credential: set AIDLC_LINEAR_DAEMON_CLIENT_ID + _SECRET (OAuth app, recommended) or AIDLC_LINEAR_DAEMON_KEY');
  if (!agentApp && !agent.AIDLC_LINEAR_AGENT_KEY) errs.push('no agent Linear credential: set AIDLC_LINEAR_AGENT_CLIENT_ID + _SECRET in the daemon env (per-run tokens, recommended) or AIDLC_LINEAR_AGENT_KEY in the agent env');
  if (daemonApp && agentApp && daemon.AIDLC_LINEAR_DAEMON_CLIENT_ID === daemon.AIDLC_LINEAR_AGENT_CLIENT_ID) errs.push('the daemon and agent use the same OAuth app: use two apps, so an agent\'s moves are attributable to the agent');
  for (const name of Object.keys(agent)) if (FORBIDDEN_AGENT_NAMES.has(name)) errs.push(`agent env file defines ${name}: daemon-only secrets must never reach an agent`);
  const daemonValues = Object.values(daemon).filter(Boolean);
  for (const [k, v] of Object.entries(agent)) {
    if (v && daemonValues.includes(v)) errs.push(`agent variable ${k} carries a daemon secret value (separate keys = kill switch)`);
  }
  return errs;
}

/**
 * The environment of an agent (or code-under-test) process. Built from scratch:
 * base allowlist from this process + the agent secrets (unless `withAgentSecrets` is false)
 * + run context + configured passEnv. Daemon secrets can never be in it.
 */
export function buildChildEnv({ secrets, passEnv = [], context = {}, withAgentSecrets = true, env = process.env }) {
  const out = {};
  for (const k of BASE_ALLOW) if (env[k] !== undefined) out[k] = env[k];
  for (const k of passEnv) if (env[k] !== undefined && !FORBIDDEN_AGENT_NAMES.has(k)) out[k] = env[k];
  if (withAgentSecrets) for (const [k, v] of Object.entries(secrets.agent)) if (!FORBIDDEN_AGENT_NAMES.has(k)) out[k] = v;
  for (const [k, v] of Object.entries(context)) if (v !== undefined && v !== null) out[k] = String(v);
  const daemonValues = Object.values(secrets.daemon).filter(Boolean);
  for (const [k, v] of Object.entries(out)) {
    if (FORBIDDEN_AGENT_NAMES.has(k) || daemonValues.includes(v)) {
      throw new Error(`refusing to start a child process: ${k} would carry a daemon secret`);
    }
  }
  return out;
}

export function allSecretValues(secrets) {
  const agentSecrets = Object.entries(secrets.agent)
    .filter(([k]) => /KEY|TOKEN|SECRET|PASSWORD/i.test(k))
    .map(([, v]) => v);
  return [...Object.values(secrets.daemon), ...agentSecrets].filter(Boolean);
}
