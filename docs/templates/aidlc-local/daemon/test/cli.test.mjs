// The real entry points: env-file secrets, `aidlc-daemon --once`, status, pause, gate confirm, doctor.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { afterEach, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { readJsonc } from '../lib/util.mjs';
import { AGENT_KEY, BOT, DAEMON_KEY, HUMAN, world } from './harness.mjs';

const BIN = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'bin');
let w;
afterEach(async () => w && (await w.close()));

function withEnvFiles(w) {
  const d = path.join(w.configDir, 'daemon.env');
  const a = path.join(w.configDir, 'agent.env');
  fs.writeFileSync(d, `AIDLC_LINEAR_DAEMON_KEY=${DAEMON_KEY}\nAIDLC_GH_READ_TOKEN=\n`, { mode: 0o600 });
  fs.writeFileSync(a, `AIDLC_LINEAR_AGENT_KEY=${AGENT_KEY}\nAIDLC_LLM_BASE_URL=http://127.0.0.1:1/v1\nGH_TOKEN=ghp_agent\n`, { mode: 0o600 });
  const file = path.join(w.configDir, 'config.jsonc');
  const cfg = readJsonc(file);
  cfg.secrets = { daemonEnvFile: d, agentEnvFile: a };
  fs.writeFileSync(file, JSON.stringify(cfg, null, 2));
  fs.chmodSync(w.configDir, 0o700);
}

// Async on purpose: the Linear mock runs in this process, so a blocking spawnSync would starve it.
const run = (w, bin, ...args) =>
  new Promise((resolve) => {
    const p = spawn(process.execPath, [path.join(BIN, bin), ...args, '--config-dir', w.configDir], {
      env: { PATH: process.env.PATH, HOME: process.env.HOME, FAKE_OC_DIR: w.ocDir, FAKE_LINEAR_URL: w.mock.url },
    });
    let stdout = '';
    let stderr = '';
    p.stdout.on('data', (d) => (stdout += d));
    p.stderr.on('data', (d) => (stderr += d));
    const t = setTimeout(() => p.kill('SIGKILL'), 60e3);
    p.on('close', (status) => {
      clearTimeout(t);
      resolve({ status, stdout, stderr });
    });
  });

test('aidlc-daemon --once: secrets from env files, a human gate dispatched through the real entry point', async () => {
  w = await world({}, { script: { plan: [[]] } });
  withEnvFiles(w);
  const f = w.feature();
  w.mock.move(f.identifier, 'Plan', HUMAN);
  const r = await run(w, 'aidlc-daemon', '--once');
  assert.equal(r.status, 0, r.stderr);
  const calls = w.calls();
  assert.equal(calls.length, 1);
  assert.equal(calls[0].env.AIDLC_LINEAR_AGENT_KEY, AGENT_KEY);
  assert.ok(!Object.values(calls[0].env).includes(DAEMON_KEY));
  assert.equal(w.mock.find(f.identifier).delegateId, null);

  const s = await run(w, 'aidlc', 'status', f.identifier);
  assert.equal(s.status, 0, s.stderr);
  assert.match(s.stdout, /ENG-1\s+feature\s+Plan/);
  assert.match(s.stdout, /last plan: ok/);
});

test('aidlc refuses to start when the agent env carries the daemon key', async () => {
  w = await world();
  withEnvFiles(w);
  fs.appendFileSync(path.join(w.configDir, 'agent.env'), `AIDLC_LINEAR_DAEMON_KEY=${DAEMON_KEY}\n`);
  const r = await run(w, 'aidlc-daemon', '--once');
  assert.equal(r.status, 1);
  assert.match(r.stderr, /must never reach an agent/);
});

test('aidlc refuses a world-readable secrets file', async () => {
  w = await world();
  withEnvFiles(w);
  fs.chmodSync(path.join(w.configDir, 'daemon.env'), 0o644);
  const r = await run(w, 'aidlc-daemon', '--once');
  assert.equal(r.status, 1);
  assert.match(r.stderr, /chmod 600/);
});

test('aidlc pause / resume / gate confirm (inline, no daemon running)', async () => {
  w = await world({}, { script: { plan: [[]] } });
  withEnvFiles(w);
  const f = w.feature();
  w.mock.move(f.identifier, 'Plan', HUMAN);
  assert.equal((await run(w, 'aidlc', 'pause')).status, 0);
  assert.equal((await run(w, 'aidlc-daemon', '--once')).status, 0);
  assert.equal(w.calls().length, 0, 'paused: nothing dispatched');
  w.mock.move(f.identifier, 'Design', BOT); // unauthorized while paused
  assert.equal((await run(w, 'aidlc-daemon', '--once')).status, 0);
  assert.equal(w.mock.stateOf(f.identifier), 'Plan', 'reverted even while paused');
  const st = await run(w, 'aidlc', 'status');
  assert.match(st.stdout, /PAUSED \(unauthorized\)/);
  const c = await run(w, 'aidlc', 'gate', 'confirm', f.identifier);
  assert.match(c.stdout, /dispatch resumed/);
  assert.equal((await run(w, 'aidlc', 'resume')).status, 0);
  assert.equal((await run(w, 'aidlc-daemon', '--once')).status, 0);
  assert.equal(w.calls().length, 1, 'the Plan gate dispatched after resume');
});

test('aidlc doctor reports the split and the isolation warning', async () => {
  w = await world();
  withEnvFiles(w);
  const r = await run(w, 'aidlc', 'doctor');
  assert.match(r.stdout, /PASS.*daemon and agent keys present and distinct/);
  assert.match(r.stdout, /PASS.*daemon key authenticates as AIDLC Bot/);
  assert.match(r.stdout, /agent key is the same bot member/);
  assert.match(r.stdout, /WARN.*runner\.runAs is empty/);
  assert.match(r.stdout, /transitions\.json valid/);
});

test('config.jsonc.example parses', () => {
  const cfg = readJsonc(path.join(BIN, '..', 'config.jsonc.example'));
  assert.equal(cfg.ci.mode, 'actions-cloud');
  assert.equal(cfg.gates.fence, true);
});
