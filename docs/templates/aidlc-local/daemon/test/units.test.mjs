// Pure pieces: transitions validation (ceiling rule), slice-plan parity with aidlc-slices.sh, the
// secret split, the private-bind rule for the manual kick.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { buildChildEnv, secretProblems } from '../lib/secrets.mjs';
import { extractPlan } from '../lib/slices.mjs';
import { loadTransitions, match, validateTransitions } from '../lib/transitions.mjs';
import { globToRegExp, isPrivateBind, parseDuration } from '../lib/util.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const EXAMPLE = path.join(HERE, '..', 'transitions.json.example');
const SLICES_SH = path.join(HERE, '..', '..', 'aidlc-slices.sh');

test('transitions.json.example is valid and covers the plan §4 table', () => {
  const doc = loadTransitions(EXAMPLE);
  const has = (kind, state, event, extra = {}) => assert.ok(match(doc, { kind, state, event, ...extra }).length, `${kind}/${state}/${event}`);
  has('feature', 'plan', 'enter', { actor: 'human' });
  has('feature', 'design', 'enter', { actor: 'human' });
  has('feature', 'build', 'enter', { actor: 'human' });
  has('feature', 'build', 'children.done');
  has('feature', 'staging', 'run.exited', { outcome: 'ok' });
  has('feature', 'ship', 'enter', { actor: 'daemon' });
  has('feature', 'done', 'enter', { actor: 'human' });
  has('slice', 'build', 'enter', { actor: 'daemon' });
  has('slice', 'build', 'enter', { actor: 'human', from: 'review' });
  has('slice', 'build', 'pr.ready');
  has('slice', 'review', 'pr.merged');
  has('slice', 'staging', 'enter', { actor: 'daemon' });
  has('slice', 'done', 'enter', { actor: 'daemon' });
  has('unit', 'staging', 'enter', { actor: 'daemon' });
  for (const s of ['plan', 'design', 'staging']) has('feature', s, 'comment');
  // Gates only open on human moves: a daemon "enter" into Plan/Design/Build+Test/Done matches nothing.
  for (const s of ['plan', 'design', 'build', 'done']) assert.equal(match(doc, { kind: 'feature', state: s, event: 'enter', actor: 'daemon' }).length, 0, s);
  // The umbrella never builds.
  assert.ok(!doc.rows.some((r) => [r.kind].flat().includes('feature') && r.do.some((a) => a.dispatch === 'build')));
});

test('ceiling rule: a transitions file that moves a Feature into a gate state is rejected', () => {
  const bad = { version: 1, rows: [{ kind: 'feature', state: 'ship', event: 'run.exited', do: [{ move: 'done' }] }] };
  assert.match(validateTransitions(bad).join('\n'), /ceiling rule — the daemon may never move a feature into done/);
  const bad2 = { version: 1, rows: [{ kind: 'slice', state: 'review', event: 'pr.merged', do: [{ move: 'build' }] }] };
  assert.match(validateTransitions(bad2).join('\n'), /never move a slice into build/);
  const bad3 = { version: 1, rows: [{ kind: 'feature', state: 'build', event: 'enter', do: [{ dispatch: 'build' }] }] };
  assert.match(validateTransitions(bad3).join('\n'), /umbrella Feature never builds/);
  const bad4 = { version: 1, rows: [{ kind: 'feature', state: 'plan', event: 'enter', do: [{ shell: 'rm -rf /' }] }] };
  assert.match(validateTransitions(bad4).join('\n'), /exactly one of/);
});

const PLANS = {
  ok: { version: 1, slices: [{ key: 'a', title: 'A', acceptance: ['x'] }, { key: 'b', title: 'B', acceptance: ['y'], blockedBy: ['a'] }] },
  empty: { version: 1, slices: [] },
  version: { version: 2, slices: [] },
  dupes: { version: 1, slices: [{ key: 'a', title: 'A', acceptance: ['x'] }, { key: 'a', title: 'B', acceptance: ['y'] }] },
  forward: { version: 1, slices: [{ key: 'a', title: 'A', acceptance: ['x'], blockedBy: ['b'] }, { key: 'b', title: 'B', acceptance: ['y'] }] },
  badkey: { version: 1, slices: [{ key: 'Not_Kebab', title: 'A', acceptance: ['x'] }] },
  noacc: { version: 1, slices: [{ key: 'a', title: 'A', acceptance: [] }] },
  ten: { version: 1, slices: Array.from({ length: 10 }, (_, i) => ({ key: `s${i}`, title: `S${i}`, acceptance: ['x'] })) },
};
const md = (p) => `# Tech Spec\n\n## Slice plan\n\n\`\`\`aidlc-slices\n${typeof p === 'string' ? p : JSON.stringify(p, null, 2)}\n\`\`\`\n`;

test('slice plan rules match aidlc-slices.sh (P1) verdict for verdict', { skip: spawnSync('jq', ['--version']).status !== 0 && 'jq not installed' }, () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aidlc-plan-'));
  try {
    const cases = { ...PLANS, notjson: '{ nope', two: null };
    for (const [name, plan] of Object.entries(cases)) {
      const text = name === 'two' ? md(PLANS.ok) + md(PLANS.ok) : md(plan);
      const file = path.join(dir, `${name}.md`);
      fs.writeFileSync(file, text);
      const sh = spawnSync('bash', [SLICES_SH, '--plan-file', file], { encoding: 'utf8' });
      let js = null;
      try {
        extractPlan(text);
      } catch (e) {
        js = e.message;
      }
      assert.equal(sh.status === 0, js === null, `${name}: shell ${sh.status === 0 ? 'accepts' : 'rejects'}, daemon ${js === null ? 'accepts' : 'rejects'}`);
      if (js) {
        const shErr = sh.stderr.replace(/^aidlc-slices: /, '').trim();
        assert.equal(js, shErr, `${name}: same message`);
      }
    }
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('secret split: same key for both principals, or a daemon secret in the agent env, blocks dispatch', () => {
  const ok = { daemon: { AIDLC_LINEAR_DAEMON_KEY: 'lin_daemon_1234567890' }, agent: { AIDLC_LINEAR_AGENT_KEY: 'lin_agent_1234567890' } };
  assert.deepEqual(secretProblems(ok), []);
  assert.match(secretProblems({ daemon: ok.daemon, agent: { AIDLC_LINEAR_AGENT_KEY: 'lin_daemon_1234567890' } }).join(), /daemon secret value/);
  assert.match(secretProblems({ daemon: ok.daemon, agent: { ...ok.agent, AIDLC_LINEAR_DAEMON_KEY: 'x' } }).join(), /must never reach an agent/);
  const env = buildChildEnv({ secrets: ok, env: { PATH: '/bin', AIDLC_LINEAR_DAEMON_KEY: 'lin_daemon_1234567890', SECRET_SAUCE: 'x' }, passEnv: ['AIDLC_LINEAR_DAEMON_KEY'] });
  assert.equal(env.AIDLC_LINEAR_DAEMON_KEY, undefined, 'passEnv cannot smuggle the daemon key');
  assert.equal(env.SECRET_SAUCE, undefined, 'nothing is inherited outside the allowlist');
  assert.throws(() => buildChildEnv({ secrets: ok, env: { PATH: '/bin' }, context: { SNEAKY: 'lin_daemon_1234567890' } }), /daemon secret/);
  const verify = buildChildEnv({ secrets: ok, env: { PATH: '/bin' }, withAgentSecrets: false });
  assert.equal(verify.AIDLC_LINEAR_AGENT_KEY, undefined, 'code under test gets no keys at all');
});

test('manual kick binds only to loopback / private / mesh-VPN interfaces', () => {
  for (const h of ['127.0.0.1', '::1', 'localhost', '10.0.0.5', '192.168.1.20', '172.20.0.1', '100.101.102.103', 'fd7a:115c:a1e0::1']) assert.ok(isPrivateBind(h), h);
  for (const h of ['0.0.0.0', '::', '8.8.8.8', '172.32.0.1', '', undefined]) assert.ok(!isPrivateBind(h), String(h));
});

test('helpers', () => {
  assert.equal(parseDuration('10m'), 600000);
  assert.equal(parseDuration('30s'), 30000);
  assert.ok(globToRegExp('.github/workflows/**').test('.github/workflows/ci.yml'));
  assert.ok(!globToRegExp('*.yml').test('a/b.yml'));
});
