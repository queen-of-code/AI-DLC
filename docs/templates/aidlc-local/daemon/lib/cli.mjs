// `aidlc` — the human's controls for the daemon (plan §6 CLI).
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadConfig, resolveConfigDir, validateConfig } from './config.mjs';
import { buildEngine, daemonPid, linearClients, runDaemon } from './daemon.mjs';
import { Linear } from './linear.mjs';
import { loadSecrets, secretProblems } from './secrets.mjs';
import { backlogStateId, extractPlan, techSpecOf } from './slices.mjs';
import { Store } from './store.mjs';
import { loadTransitions } from './transitions.mjs';
import { isPrivateBind } from './util.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');

const USAGE = `aidlc — AIDLC local daemon controls

  aidlc daemon [--once]              run the daemon in the foreground (launchd/systemd call this)
  aidlc status [ISSUE]               where each issue is (kind, state, run, park/pause, checks) + recent events
  aidlc tail [-f] [-n N] [ISSUE]     follow the event log
  aidlc gate confirm ISSUE           after a fence/revert flag: resume dispatch (re-applies a fenced HUMAN move)
  aidlc pause [--stop-runs]          kill switch: no new dispatch or machine moves (reverts keep running)
  aidlc resume                       lift the kill switch
  aidlc reconcile [--since ISO]      after the machine was off: clear stale claims/lanes, re-scan every issue
  aidlc doctor                       check config, keys, Linear, git, OpenCode, isolation
  aidlc slices FEATURE [--adopt] [--dry-run]   human-held slice creation (P1 aidlc-slices.sh, daemon-aware)
  aidlc breaker reset ISSUE          re-arm a tripped bounce breaker (restarts the slice chain)
  aidlc kick                         poll now (same as the private HTTP kick)
  aidlc init --repo DIR --nwo OWNER/NAME --team KEY   create ~/.config/aidlc/<owner>/<name>/

  global: --config-dir DIR  (default $AIDLC_CONFIG_DIR, or the only repo under ~/.config/aidlc)`;

function parse(argv) {
  const out = { _: [], flags: {} };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const k = a.slice(2);
      const next = argv[i + 1];
      if (next !== undefined && !next.startsWith('-') && ['config-dir', 'since', 'repo', 'nwo', 'team', 'n'].includes(k)) {
        out.flags[k] = next;
        i++;
      } else out.flags[k] = true;
    } else if (a === '-f') out.flags.f = true;
    else if (a === '-n') out.flags.n = argv[++i];
    else out._.push(a);
  }
  return out;
}

/** Mutations go through the running daemon (one writer); inline only when no daemon is running. */
async function viaDaemon(configDir, req, inline) {
  if (daemonPid(configDir)) {
    new Store(configDir).addRequest(req);
    fs.writeFileSync(path.join(configDir, 'KICK'), '');
    console.log(`queued for the running daemon (pid ${daemonPid(configDir)}); watch: aidlc tail -f`);
    return;
  }
  const { engine } = await buildEngine(configDir);
  console.log(await inline(engine));
  await engine.runner.idle();
}

function fmtRec(r) {
  const bits = [`${r.identifier.padEnd(9)} ${String(r.kind || '?').padEnd(7)} ${String(r.state || '?').padEnd(12)}`];
  if (r.run) bits.push(`RUNNING ${r.run.phase} since ${r.run.startedAt} (pid ${r.run.pid})`);
  else if (r.lastRun) bits.push(`last ${r.lastRun.phase}: ${r.lastRun.outcome} ${r.lastRun.endedAt || ''}`);
  if (r.parked) bits.push(`PARKED (${r.parked.phase}, needs-a-human since ${r.parked.since})`);
  if (r.paused) bits.push(`PAUSED (${r.paused.kind}) → aidlc gate confirm ${r.identifier}`);
  if (r.breaker) bits.push(`BREAKER tripped (${r.breaker.bounces} bounces)`);
  if (r.chainStopped) bits.push(`chain stopped: ${r.chainStopped}`);
  if (r.deferred?.length) bits.push(`waiting: ${r.deferred.map((d) => d.why).join('; ')}`);
  if (r.lastChecks) bits.push(`checks ${r.lastChecks.status} @ ${r.lastChecks.sha.slice(0, 10)}`);
  return bits.join('  ·  ');
}

async function doctor(configDir) {
  let fails = 0;
  let warns = 0;
  const pass = (m) => console.log(`  \x1b[32mPASS\x1b[0m ${m}`);
  const warn = (m) => {
    warns++;
    console.log(`  \x1b[33mWARN\x1b[0m ${m}`);
  };
  const fail = (m) => {
    fails++;
    console.log(`  \x1b[31mFAIL\x1b[0m ${m}`);
  };
  console.log(`\nConfig (${configDir})`);
  let cfg;
  try {
    cfg = loadConfig(configDir);
    const errs = validateConfig(cfg);
    errs.length ? errs.forEach(fail) : pass('config.jsonc valid');
  } catch (e) {
    fail(e.message);
    return 1;
  }
  try {
    loadTransitions(path.join(configDir, 'transitions.json'));
    pass('transitions.json valid (ceiling rule holds)');
  } catch (e) {
    fail(e.message);
  }
  const mode = (fs.statSync(configDir).mode & 0o777).toString(8);
  mode === '700' ? pass('config dir is 0700') : warn(`config dir mode ${mode}: chmod 700 ${configDir}`);
  if (cfg.kick.bind) isPrivateBind(cfg.kick.bind) ? pass(`kick bound to private ${cfg.kick.bind}`) : fail(`kick.bind ${cfg.kick.bind} is not private`);
  else pass('manual kick off (use `aidlc kick`)');

  console.log('\nSecrets (two principals)');
  let secrets;
  try {
    secrets = loadSecrets(cfg);
    const sp = secretProblems(secrets);
    sp.length ? sp.forEach(fail) : pass('daemon and agent Linear credentials present and distinct');
    if (!secrets.daemon.AIDLC_GH_READ_TOKEN) warn('AIDLC_GH_READ_TOKEN not set: the daemon falls back to your ambient gh auth');
  } catch (e) {
    fail(e.message);
  }
  if (process.env.AIDLC_LINEAR_DAEMON_KEY) warn('AIDLC_LINEAR_DAEMON_KEY is exported in this shell; keep it in the daemon env file or keychain only');
  cfg.runner.runAs
    ? pass(`agents run as OS user ${cfg.runner.runAs} (cannot read the daemon key file or state)`)
    : warn('runner.runAs is empty: agents run as YOU and their shell can read files you can read, including the daemon env file. The actor check + revert still catches any state move; for a hard boundary see OPENCODE-LOCAL.md → Separate OS user');

  console.log('\nLinear');
  if (secrets && !secretProblems(secrets).length) {
    try {
      const { linear: d, agentAuth } = linearClients(cfg, secrets);
      const me = await d.viewer();
      const oauth = !!secrets.daemon.AIDLC_LINEAR_DAEMON_CLIENT_ID;
      oauth
        ? pass(`daemon authenticates as ${me.name} (app user, can be the delegate)`)
        : fail(`daemon authenticates as ${me.name} with a static key. Linear only accepts an app user as delegate, so the claim will fail: use an OAuth app (OPENCODE-LOCAL.md → Linear apps)`);
      let them;
      if (agentAuth.kind === 'oauth') {
        const t = await agentAuth.tokens.mint();
        them = await new Linear({ apiUrl: cfg.linear.apiUrl, key: t.token }).viewer().catch(() => null);
        await agentAuth.tokens.revoke(t.token).catch(() => {});
      } else them = await new Linear({ apiUrl: cfg.linear.apiUrl, key: agentAuth.key }).viewer().catch(() => null);
      if (!them) fail('the agent credential is rejected by Linear');
      else if (them.id === me.id) warn(`agent and daemon are the same Linear identity (${them.name}): agent moves can only be told apart by the daemon's own move log. Use a separate "AIDLC Agent" app`);
      else pass(`agent authenticates as ${them.name}, a separate identity${agentAuth.kind === 'oauth' ? ' (per-run tokens, revoked after each run)' : ''}`);
      const team = await d.team(cfg.linear.team);
      for (const k of ['plan', 'design', 'build', 'review', 'staging', 'ship', 'done']) {
        team.states.some((x) => x.name === cfg.states[k]) ? null : fail(`team ${team.key} has no state "${cfg.states[k]}"`);
      }
      pass(`team ${team.key}: ${team.states.length} states`);
      try {
        const b = backlogStateId(team, cfg);
        const triage = team.states.find((x) => x.name === cfg.states.triage);
        b === triage?.id ? fail(`the slice backlog resolves to "${triage.name}": set states.backlog (e.g. "Parked")`) : pass(`slices wait in "${team.states.find((x) => x.id === b).name}"`);
      } catch (e) {
        fail(e.message);
      }
      (await d.labelId(cfg.labels.needsHuman, team.id)) ? pass(`label ${cfg.labels.needsHuman}`) : fail(`no "${cfg.labels.needsHuman}" label`);
    } catch (e) {
      fail(e.message);
    }
  }
  warn('the agent token needs `write` for Documents, so Linear cannot stop it moving state (no tier 1): the daemon\'s actor check + revert (tiers 2–3) is the control — plan §3');

  console.log('\nRepo + tools');
  try {
    const remote = execFileSync('git', ['-C', cfg.repo.path, 'remote', 'get-url', cfg.repo.remote], { encoding: 'utf8' }).trim();
    pass(`git ${cfg.repo.path} → ${remote}`);
  } catch (e) {
    fail(`git: ${e.message.split('\n')[0]}`);
  }
  const which = (c) => spawnSync('/bin/sh', ['-c', `command -v ${c}`], { encoding: 'utf8' }).stdout.trim();
  which(cfg.runner.command) ? pass(`${cfg.runner.command} found`) : fail(`${cfg.runner.command} not on PATH`);
  which('gh') ? pass('gh found') : fail('gh not installed (PR state, merge SHA, checks)');
  try {
    fs.mkdirSync(cfg.lanes.dir, { recursive: true });
    fs.accessSync(cfg.lanes.dir, fs.constants.W_OK);
    pass(`lanes dir ${cfg.lanes.dir}`);
    if (cfg.lanes.dir.startsWith(cfg.repo.path + path.sep)) fail('lanes dir is inside the repo checkout; put it next to it');
  } catch (e) {
    fail(`lanes dir: ${e.message}`);
  }
  if (cfg.ci.mode !== 'actions-cloud') pass(`ci.mode ${cfg.ci.mode}: local re-run \`${cfg.ci.command}\` with base-branch definitions=${cfg.ci.useBaseDefinitions}`);
  else pass('ci.mode actions-cloud: GitHub check runs at the SHA are the evidence');
  const agentsFile = path.join(cfg.repo.path, 'opencode.jsonc');
  if (fs.existsSync(agentsFile) && /AIDLC_LINEAR_DAEMON_KEY|AIDLC_GH_READ_TOKEN/.test(fs.readFileSync(agentsFile, 'utf8'))) fail('opencode.jsonc references a daemon-only secret');
  console.log(`\nAlso run, in the agent shell: ${path.join(ROOT, '..', 'aidlc-doctor.sh')} (OpenCode config, models, tool calling)`);
  console.log(`\n${fails} FAIL, ${warns} WARN`);
  return fails ? 1 : 0;
}

function init(flags) {
  const { repo, nwo, team } = flags;
  if (!repo || !nwo || !team) throw new Error('usage: aidlc init --repo DIR --nwo OWNER/NAME --team KEY');
  const dir = path.join(os.homedir(), '.config', 'aidlc', ...nwo.split('/'));
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  fs.chmodSync(dir, 0o700);
  const cfgFile = path.join(dir, 'config.jsonc');
  if (!fs.existsSync(cfgFile)) {
    const t = fs.readFileSync(path.join(ROOT, 'config.jsonc.example'), 'utf8').replace('"/path/to/your/repo"', JSON.stringify(path.resolve(repo))).replace('"owner/repo"', JSON.stringify(nwo)).replace('"ENG"', JSON.stringify(team));
    fs.writeFileSync(cfgFile, t, { mode: 0o600 });
  }
  const tFile = path.join(dir, 'transitions.json');
  if (!fs.existsSync(tFile)) fs.copyFileSync(path.join(ROOT, 'transitions.json.example'), tFile);
  for (const f of ['daemon.env', 'agent.env']) {
    const p = path.join(os.homedir(), '.config', 'aidlc', f);
    if (!fs.existsSync(p)) fs.writeFileSync(p, fs.readFileSync(path.join(ROOT, `${f}.example`), 'utf8'), { mode: 0o600 });
  }
  return `created ${dir}\nnext: edit config.jsonc, fill ~/.config/aidlc/daemon.env and agent.env, then: aidlc doctor --config-dir ${dir}`;
}

export async function main(argv) {
  const { _: args, flags } = parse(argv);
  const cmd = args[0];
  if (!cmd || flags.help || cmd === 'help') {
    console.log(USAGE);
    return 0;
  }
  if (cmd === 'init') {
    console.log(init(flags));
    return 0;
  }
  const configDir = resolveConfigDir(flags['config-dir']);
  const store = () => new Store(configDir);

  switch (cmd) {
    case 'daemon':
      await runDaemon(configDir, { once: !!flags.once });
      return 0;
    case 'status': {
      const s = store();
      const pid = daemonPid(configDir);
      console.log(`daemon: ${pid ? `running (pid ${pid})` : 'not running'}${s.isPaused() ? '  ·  PAUSED (aidlc resume)' : ''}  ·  cursor ${s.data.cursor}`);
      const recs = Object.values(s.data.issues).filter((r) => !r.closed && r.kind && r.kind !== 'other');
      const pick = args[1] ? recs.filter((r) => r.identifier === args[1] || r.parent === args[1]) : recs;
      for (const r of pick.sort((a, b) => a.identifier.localeCompare(b.identifier, undefined, { numeric: true }))) console.log(fmtRec(r));
      if (args[1]) {
        console.log('\nrecent events:');
        for (const e of s.readEvents({ issue: args[1], limit: 20 })) console.log(`  ${e.at}  ${e.type.padEnd(9)} ${e.msg}`);
        const r = s.findIssue(args[1]);
        if (r?.lastRun?.runId) console.log(`\nlast run log: ${s.runLog(r.identifier, r.lastRun.runId)}`);
      }
      return 0;
    }
    case 'tail': {
      const s = store();
      const n = Number(flags.n || 30);
      const show = (e) => console.log(`${e.at}  ${String(e.issue || '-').padEnd(9)} ${e.type.padEnd(9)} ${e.msg}`);
      s.readEvents({ issue: args[1], limit: n }).forEach(show);
      if (!flags.f) return 0;
      let size = fs.existsSync(s.eventsFile) ? fs.statSync(s.eventsFile).size : 0;
      await new Promise(() =>
        setInterval(() => {
          if (!fs.existsSync(s.eventsFile)) return;
          const st = fs.statSync(s.eventsFile);
          if (st.size <= size) return;
          const fd = fs.openSync(s.eventsFile, 'r');
          const buf = Buffer.alloc(st.size - size);
          fs.readSync(fd, buf, 0, buf.length, size);
          fs.closeSync(fd);
          size = st.size;
          for (const l of buf.toString('utf8').split('\n').filter(Boolean)) {
            const e = JSON.parse(l);
            if (!args[1] || e.issue === args[1]) show(e);
          }
        }, 1000),
      );
      return 0;
    }
    case 'gate': {
      if (args[1] !== 'confirm' || !args[2]) throw new Error('usage: aidlc gate confirm ISSUE');
      await viaDaemon(configDir, { cmd: 'gate-confirm', issue: args[2] }, (e) => e.confirmGate(args[2]));
      return 0;
    }
    case 'breaker': {
      if (args[1] !== 'reset' || !args[2]) throw new Error('usage: aidlc breaker reset ISSUE');
      await viaDaemon(configDir, { cmd: 'breaker-reset', issue: args[2] }, async (e) => {
        const m = e.resetBreaker(args[2]);
        e.store.save();
        return m;
      });
      return 0;
    }
    case 'pause': {
      fs.writeFileSync(store().pauseFile, `paused ${new Date().toISOString()} by ${os.userInfo().username}\n`);
      if (flags['stop-runs']) store().addRequest({ cmd: 'stop-runs' });
      console.log(`paused: no new dispatch or machine moves${flags['stop-runs'] ? '; live runs are being stopped' : ' (live runs finish; --stop-runs to kill them)'}. Reverts of unauthorized moves keep running.`);
      return 0;
    }
    case 'resume':
      fs.rmSync(store().pauseFile, { force: true });
      fs.writeFileSync(path.join(configDir, 'KICK'), '');
      console.log('resumed; deferred work dispatches on the next tick');
      return 0;
    case 'reconcile':
      await viaDaemon(configDir, { cmd: 'reconcile', since: flags.since || null }, async (e) => JSON.stringify(await e.reconcile({ since: flags.since || null })));
      return 0;
    case 'kick':
      fs.writeFileSync(path.join(configDir, 'KICK'), '');
      console.log(daemonPid(configDir) ? 'kicked' : 'no daemon running; the kick waits for it');
      return 0;
    case 'doctor':
      return doctor(configDir);
    case 'slices': {
      const feature = args[1];
      if (!feature) throw new Error('usage: aidlc slices FEATURE [--adopt] [--dry-run]');
      if (daemonPid(configDir) && !flags['dry-run']) throw new Error('the daemon is running and creates slices on the gate itself; stop it first (or use --dry-run)');
      const { engine } = await buildEngine(configDir);
      const issue = await engine.linear.issue(feature);
      if (!issue) throw new Error(`no issue ${feature}`);
      if (flags['dry-run']) {
        const plan = extractPlan(techSpecOf(issue).content);
        console.log(plan.slices.length ? plan.slices.map((s) => `  ${s.key}  ${s.title}${s.blockedBy?.length ? `  (after ${s.blockedBy.join(', ')})` : ''}`).join('\n') : '1-slice Feature (the Feature itself is the unit)');
        return 0;
      }
      if (engine.stateKeyOf(issue) !== 'build') throw new Error(`${feature} is in "${issue.state.name}", not "${engine.cfg.states.build}" — slices are created only after the human gates Design → Build+Test`);
      const { createSlices } = await import('./slices.mjs');
      const r = await createSlices({
        linear: engine.linear,
        issue,
        team: engine.team,
        cfg: engine.cfg,
        adopt: !!flags.adopt,
        known: (id) => !!engine.store.data.knownSlices[id],
        remember: (id, v) => (engine.store.data.knownSlices[id] = v),
        log: console.log,
      });
      engine.store.save();
      console.log(r.unit ? '1-slice Feature: nothing to create' : r.slices.map((s) => `${s.created ? 'created' : 'exists '} ${s.identifier}  ${s.key}`).join('\n'));
      console.log('Start the daemon (or run `aidlc reconcile`) to release the first slice.');
      return 0;
    }
    default:
      console.error(USAGE);
      return 2;
  }
}
