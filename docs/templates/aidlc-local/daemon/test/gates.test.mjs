// Human gates dispatch; the claim is a delegate compare-and-set that moves no state; agents never
// see the daemon's secrets.
import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { AGENT, APPS, BOT, DAEMON_KEY, HUMAN, world } from './harness.mjs';

let w;
afterEach(async () => w && (await w.close()));

test('human Plan gate dispatches /plan with agent + model + session, delegate set during and cleared after', async () => {
  w = await world({}, { script: { plan: [[{ sleep: 300 }]] } });
  const f = w.feature();
  w.mock.move(f.identifier, 'Plan', HUMAN);
  await w.tick();

  assert.equal(w.engine.runner.live.size, 1, 'a plan run is live');
  assert.equal(w.mock.find(f.identifier).delegateId, BOT, 'delegate = bot while the run is live (the claim)');
  assert.equal(w.mock.stateOf(f.identifier), 'Plan', 'the claim moved no state');
  await w.engine.runner.idle();

  const [call] = w.calls();
  const argv = call.argv;
  assert.deepEqual(argv.slice(0, 6), ['run', '--standalone', '--agent', 'aidlc-runner', '--model', 'local/aidlc-strong']);
  assert.equal(argv[6], '--session');
  assert.match(argv[7], /^ses_aidlc-eng-\d+-plan-/, 'OpenCode requires session ids starting with "ses"');
  assert.ok(!argv.includes('--command'), 'opencode run has no --command flag');
  assert.match(argv.at(-1), /Load the `aidlc-local` skill, then the `plan` skill/);
  assert.match(argv.at(-1), /You must not change AIDLC phase\/workflow state/);
  assert.equal(w.mock.find(f.identifier).delegateId, null, 'delegate cleared at the end of the run');
  assert.ok(call.cwd.startsWith(w.cfg.lanes.dir), 'the run executes in a robot lane, not the human checkout');
});

test('the agent gets a per-run token for its own app identity, revoked at the end; never a daemon credential', async () => {
  w = await world({}, { script: { plan: [[{ comment: 'agent handoff' }]] } });
  const f = w.feature();
  w.mock.move(f.identifier, 'Plan', HUMAN);
  await w.settle();
  const env = w.calls()[0].env;
  const token = env.AIDLC_LINEAR_AGENT_KEY;
  assert.match(token, /^lin_oauth_/);
  assert.ok(w.mock.revoked.includes(token), 'the run token is revoked when the run ends');
  assert.equal(w.mock.tokens[token], undefined);
  assert.equal(w.mock.commentsOn(f.identifier).find((c) => c.body === 'agent handoff').userId, AGENT, 'the agent acts as its own app user');
  for (const [k, v] of Object.entries(env)) {
    for (const s of [DAEMON_KEY, APPS.daemon.secret, APPS.agent.secret, w.secrets.daemon.AIDLC_GH_READ_TOKEN]) assert.notEqual(v, s, `${k} carries a daemon secret`);
  }
  for (const n of ['AIDLC_LINEAR_DAEMON_KEY', 'AIDLC_LINEAR_DAEMON_CLIENT_SECRET', 'AIDLC_LINEAR_AGENT_CLIENT_SECRET', 'AIDLC_GH_READ_TOKEN']) assert.equal(env[n], undefined, n);
});

test('a member-seat daemon key (P1 style) cannot claim: Linear refuses the delegate, nothing dispatches, flagged', async () => {
  w = await world({}, { script: { plan: [[]] }, legacyKeys: true });
  const f = w.feature();
  w.mock.move(f.identifier, 'Plan', HUMAN);
  await w.settle();
  assert.equal(w.calls().length, 0);
  assert.ok(w.mock.commentsOn(f.identifier).some((c) => /delegateId must correspond to an app user/.test(c.body) && /OAuth app with actor=app/.test(c.body)));
  void BOT;
});

test('claim CAS: an issue delegated to someone else is not dispatched', async () => {
  w = await world({}, { script: { plan: [[]] } });
  const f = w.feature();
  w.mock.find(f.identifier).delegateId = 'user-other';
  w.mock.move(f.identifier, 'Plan', HUMAN);
  await w.settle();
  assert.equal(w.calls().length, 0);
  assert.equal(w.mock.find(f.identifier).delegateId, 'user-other', 'the daemon never overwrites another claim');
  assert.ok(w.events().some((e) => e.type === 'claim' && /someone else/.test(e.msg)));
});

test('a run already live on the issue is the answer to "should I start one" (no double start)', async () => {
  w = await world({}, { script: { plan: [[{ sleep: 400 }]] } });
  const f = w.feature();
  w.mock.move(f.identifier, 'Plan', HUMAN);
  await w.tick();
  await w.tick();
  await w.tick({ full: false });
  assert.equal(w.engine.runner.live.size, 1);
  await w.engine.runner.idle();
  await w.settle();
  assert.equal(w.calls().length, 1, 'exactly one plan run');
});

test('moves before the daemon was installed are history, not gates', async () => {
  w = await world({}, { script: { plan: [[]] } });
  const f = w.feature();
  w.mock.move(f.identifier, 'Plan', HUMAN);
  w.store.data.installedAt = new Date(w.now() + 1000).toISOString();
  w.advance(2000);
  await w.settle();
  assert.equal(w.calls().length, 0);
});

test('Design gate dispatches /design; a Triage → Plan → Design catch-up only dispatches the current state', async () => {
  w = await world({}, { script: { design: [[]] } });
  const f = w.feature();
  w.mock.move(f.identifier, 'Plan', HUMAN);
  w.mock.move(f.identifier, 'Design', HUMAN);
  await w.settle();
  const phases = w.calls().map((c) => c.env.AIDLC_PHASE);
  assert.deepEqual(phases, ['design']);
});

test('a human comment on an issue with no run yet does nothing', async () => {
  w = await world();
  const f = w.feature('x', 'Triage');
  w.mock.addComment(f.id, 'thinking out loud', HUMAN);
  await w.settle();
  assert.equal(w.calls().length, 0);
});

test('no-robots: a human gate on a hands-off issue dispatches nothing and moves nothing; without the label the next gate dispatches', async () => {
  w = await world({}, { script: { plan: [[{ sleep: 100 }]], design: [[{ sleep: 100 }]] } });
  const label = w.mock.addLabel('no-robots');
  const f = w.feature();
  w.mock.find(f.identifier).labelIds.add(label.id);
  w.mock.move(f.identifier, 'Plan', HUMAN);
  await w.tick();
  await w.engine.runner.idle();
  assert.equal(w.engine.runner.live.size, 0, 'no run started');
  assert.equal(w.calls().length, 0, 'opencode never ran');
  assert.equal(w.mock.find(f.identifier).delegateId, null, 'no claim');
  assert.equal(w.mock.stateOf(f.identifier), 'Plan', 'state untouched');
  assert.ok(w.store.readEvents({ issue: f.identifier, limit: 500 }).some((e) => e.type === 'hands-off'), 'the skip is recorded');

  w.mock.find(f.identifier).labelIds.delete(label.id);
  w.mock.move(f.identifier, 'Design', HUMAN);
  await w.tick();
  await w.engine.runner.idle();
  assert.equal(w.calls().length, 1, 'the next human gate dispatches once the label is gone');
});

test('an expired or revoked daemon token is re-minted on the first 401', async () => {
  w = await world();
  const before = await w.engine.linear.tokens.token();
  delete w.mock.tokens[before]; // Linear no longer accepts it
  const me = await w.engine.linear.viewer();
  assert.equal(me.id, BOT);
  assert.notEqual(await w.engine.linear.tokens.token(), before);
});
