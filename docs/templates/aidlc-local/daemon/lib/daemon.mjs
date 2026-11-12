// The daemon process: two poll cadences (eligible work / parked + live runs), a persisted cursor,
// a manual kick on a private interface, crash recovery on start, graceful shutdown.
// Polling machinery inherited from docs/SELF-HOSTED-AIDLC.md.
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { loadConfig, validateConfig } from './config.mjs';
import { Engine } from './engine.mjs';
import { Linear } from './linear.mjs';
import { ClientCredentials } from './oauth.mjs';
import { loadSecrets, secretProblems } from './secrets.mjs';
import { Store } from './store.mjs';
import { loadTransitions } from './transitions.mjs';
import { isPrivateBind } from './util.mjs';

export function daemonPid(configDir) {
  const f = path.join(configDir, 'daemon.pid');
  if (!fs.existsSync(f)) return null;
  const pid = Number(fs.readFileSync(f, 'utf8').trim());
  try {
    process.kill(pid, 0);
    return pid;
  } catch {
    return null;
  }
}

/** The daemon's Linear client, and how agents get their Linear credential. */
export function linearClients(cfg, secrets, fetchImpl = fetch) {
  const d = secrets.daemon;
  const tokens = d.AIDLC_LINEAR_DAEMON_CLIENT_ID
    ? new ClientCredentials({ oauthUrl: cfg.linear.oauthUrl, clientId: d.AIDLC_LINEAR_DAEMON_CLIENT_ID, clientSecret: d.AIDLC_LINEAR_DAEMON_CLIENT_SECRET, scopes: cfg.linear.daemonScopes, fetchImpl })
    : null;
  const linear = new Linear({ apiUrl: cfg.linear.apiUrl, key: tokens ? null : d.AIDLC_LINEAR_DAEMON_KEY, tokens, fetchImpl });
  const agentAuth = d.AIDLC_LINEAR_AGENT_CLIENT_ID
    ? { kind: 'oauth', tokens: new ClientCredentials({ oauthUrl: cfg.linear.oauthUrl, clientId: d.AIDLC_LINEAR_AGENT_CLIENT_ID, clientSecret: d.AIDLC_LINEAR_AGENT_CLIENT_SECRET, scopes: cfg.linear.agentScopes, fetchImpl }) }
    : { kind: 'static', key: secrets.agent.AIDLC_LINEAR_AGENT_KEY };
  return { linear, agentAuth };
}

/** Everything a daemon or an inline CLI command needs. Refuses to build on an unsafe config. */
export async function buildEngine(configDir, { log = (m) => console.error(`[aidlc] ${m}`) } = {}) {
  const cfg = loadConfig(configDir);
  const errs = validateConfig(cfg);
  if (errs.length) throw new Error(`config problems:\n  ${errs.join('\n  ')}`);
  const transitions = loadTransitions(path.join(configDir, 'transitions.json'));
  const secrets = loadSecrets(cfg);
  const sp = secretProblems(secrets);
  if (sp.length) throw new Error(`secret problems:\n  ${sp.join('\n  ')}`);
  const store = new Store(configDir);
  const { linear, agentAuth } = linearClients(cfg, secrets);
  const engine = await new Engine({ cfg, transitions, linear, agentAuth, store, secrets, log }).init();
  return { cfg, engine, store, secrets };
}

export async function runDaemon(configDir, { once = false } = {}) {
  const log = (m) => console.error(`${new Date().toISOString()} [aidlc] ${m}`);
  const existing = daemonPid(configDir);
  if (existing && existing !== process.pid) throw new Error(`a daemon is already running for ${configDir} (pid ${existing})`);
  const { cfg, engine, store, secrets } = await buildEngine(configDir, { log });
  if (cfg.kick.bind && !isPrivateBind(cfg.kick.bind)) throw new Error(`kick.bind ${cfg.kick.bind} is not a private interface — refusing to start (never 0.0.0.0)`);

  const pidFile = path.join(configDir, 'daemon.pid');
  fs.writeFileSync(pidFile, String(process.pid), { mode: 0o600 });
  log(`started for ${cfg.repo.nwo} / Linear ${cfg.linear.team} as ${engine.bot.name}; ci=${cfg.ci.mode}; eligible every ${cfg.poll.eligible}, parked every ${cfg.poll.parked}`);

  const recovered = await engine.reconcile({ scan: false });
  if (recovered.staleRuns || recovered.delegatesCleared || recovered.lanesRemoved) log(`crash recovery: ${JSON.stringify(recovered)}`);

  let stopping = false;
  const safeTick = (full) =>
    engine.tick({ full }).catch((e) => {
      log(`tick failed: ${e.message}`);
      store.event(null, 'error', `tick: ${e.message}`);
    });

  if (once) {
    await safeTick(true);
    await engine.runner.idle();
    await safeTick(false);
    fs.rmSync(pidFile, { force: true });
    return;
  }

  engine.runner.onExit = () => setTimeout(() => safeTick(false), 50);
  const timers = [setInterval(() => safeTick(true), cfg.ms.eligible), setInterval(() => safeTick(false), cfg.ms.parked)];
  const kickFile = path.join(configDir, 'KICK');
  timers.push(
    setInterval(() => {
      if (fs.existsSync(kickFile)) {
        fs.rmSync(kickFile, { force: true });
        log('kick (file)');
        safeTick(true);
      }
      if (fs.readdirSync(path.join(configDir, 'requests')).length) safeTick(false);
    }, 2000),
  );

  let server = null;
  if (cfg.kick.bind) {
    const token = secrets.daemon.AIDLC_KICK_TOKEN;
    server = http.createServer((req, res) => {
      if (token && req.headers.authorization !== `Bearer ${token}`) {
        res.statusCode = 401;
        return res.end('unauthorized\n');
      }
      if (req.method === 'POST' && req.url === '/kick') {
        log(`kick (http from ${req.socket.remoteAddress})`);
        safeTick(true);
        return res.end('ok\n');
      }
      if (req.method === 'GET' && req.url === '/healthz') return res.end(JSON.stringify({ ok: true, live: engine.runner.live.size, paused: store.isPaused() }) + '\n');
      res.statusCode = 404;
      res.end('not found\n');
    });
    server.listen(cfg.kick.port, cfg.kick.bind, () => log(`manual kick on http://${cfg.kick.bind}:${cfg.kick.port}/kick${token ? ' (bearer token)' : ''}`));
  }

  const shutdown = async (sig) => {
    if (stopping) return;
    stopping = true;
    log(`${sig}: stopping — live runs are stopped and their delegates cleared`);
    timers.forEach(clearInterval);
    server?.close();
    for (const id of [...engine.runner.live.keys()]) engine.runner.stop(id, `daemon ${sig}`);
    await Promise.race([engine.runner.idle(), new Promise((r) => setTimeout(r, cfg.ms.killGrace + 10e3))]);
    store.save();
    fs.rmSync(pidFile, { force: true });
    process.exit(0);
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
  await safeTick(true);
}
