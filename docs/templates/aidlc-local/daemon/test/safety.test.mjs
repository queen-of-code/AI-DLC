// Gate validation (plan §3): actor check + revert of bot-actor moves the daemon didn't make, the
// temporal fence, `aidlc gate confirm`; resume + park; wall-clock caps; evidence; kill switch.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { afterEach, test } from 'node:test';
import { BOT, HUMAN, TECH_SPEC, TWO_SLICES, world } from './harness.mjs';

let w;
afterEach(async () => w && (await w.close()));

const BUILD = 'state-buildtest';
const DESIGN = 'state-design';
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function designing(w) {
  const f = w.feature();
  w.mock.saveDocument(f.id, 'Tech Spec — CSV export', TECH_SPEC(TWO_SLICES));
  w.mock.move(f.identifier, 'Plan', HUMAN);
  w.mock.move(f.identifier, 'Design', HUMAN);
  return f;
}

test('an agent that moves its own gate with the bot key is reverted within one poll, flagged, paused; its run is stopped', async () => {
  w = await world({}, { script: { design: [[{ moveTo: BUILD }, { sleep: 3000 }]], plan: [] } });
  const f = await designing(w);
  await w.tick();
  await wait(700); // the agent's move lands while its run is alive
  assert.equal(w.mock.stateOf(f.identifier), 'Build+Test', 'the agent did move it');
  await w.tick({ full: false }); // the 30s loop
  assert.equal(w.mock.stateOf(f.identifier), 'Design', 'reverted');
  await w.engine.runner.idle();
  const flag = w.mock.commentsOn(f.identifier).find((c) => /Unauthorized state move reverted/.test(c.body));
  assert.ok(flag, 'flagged');
  assert.match(flag.body, /the \*\*agent\*\* identity \(AIDLC Agent\)/);
  assert.equal(w.store.findIssue(f.identifier).paused.kind, 'unauthorized');
  assert.equal(w.mock.childrenOf(f.identifier).length, 0, 'no slices: the self-approval never became a gate');
  assert.equal(w.store.findIssue(f.identifier).lastRun.outcome, 'stopped');

  // Paused: nothing dispatches until a human confirms.
  await w.settle();
  assert.equal(w.calls().length, 1);
  w.script({ design: [[]] });
  assert.match(await w.engine.confirmGate(f.identifier), /dispatch resumed/);
  await w.settle();
  assert.equal(w.mock.stateOf(f.identifier), 'Design', 'confirm never re-applies a bot move');
  assert.deepEqual(w.calls().map((c) => c.env.AIDLC_PHASE), ['design', 'design'], 'the stopped run is re-dispatched');
});

test('a bot-actor move with no run alive (raw key misuse) is reverted too', async () => {
  w = await world({}, { script: { plan: [[]] } });
  const f = w.feature();
  w.mock.move(f.identifier, 'Plan', HUMAN);
  await w.settle();
  w.mock.move(f.identifier, 'Design', BOT);
  await w.tick();
  assert.equal(w.mock.stateOf(f.identifier), 'Plan');
  assert.equal(w.calls().filter((c) => c.env.AIDLC_PHASE === 'design').length, 0);
});

test('an integration move (Linear GitHub automation) is not a gate: reverted and flagged', async () => {
  w = await world({}, { script: { plan: [[]] } });
  const f = w.feature();
  w.mock.move(f.identifier, 'Plan', HUMAN);
  await w.settle();
  w.mock.move(f.identifier, 'Design', null, { type: 'github', name: 'GitHub' });
  await w.tick();
  assert.equal(w.mock.stateOf(f.identifier), 'Plan');
  assert.ok(w.mock.commentsOn(f.identifier).some((c) => /integration \(GitHub\)/.test(c.body)));
});

test('temporal fence: a human move while the run is alive stops the run and reverts; gate confirm re-applies it as the gate', async () => {
  w = await world({}, { script: { design: [[{ sleep: 3000 }]], build: [[]] } });
  const f = await designing(w);
  await w.tick();
  w.mock.move(f.identifier, 'Build+Test', HUMAN);
  await w.tick({ full: false });
  assert.equal(w.mock.stateOf(f.identifier), 'Design');
  await w.engine.runner.idle();
  assert.ok(w.mock.commentsOn(f.identifier).some((c) => /Temporal fence/.test(c.body) && /aidlc gate confirm ENG-1/.test(c.body)));
  assert.equal(w.mock.childrenOf(f.identifier).length, 0);

  assert.match(await w.engine.confirmGate(f.identifier), /re-applied Design → Build\+Test/);
  await w.settle();
  assert.equal(w.mock.stateOf(f.identifier), 'Build+Test');
  assert.equal(w.mock.childrenOf(f.identifier).length, 2, 'the confirmed gate created the slices');
});

test('temporal fence: a move observed after the run exited is accepted (the common case)', async () => {
  w = await world({}, { script: { design: [[]], build: [[]] } });
  const f = await designing(w);
  await w.settle();
  w.mock.move(f.identifier, 'Build+Test', HUMAN);
  await w.settle();
  assert.equal(w.mock.childrenOf(f.identifier).length, 2);
  assert.ok(!w.store.findIssue(f.identifier).paused);
});

test('resume: a human comment on an ended run re-dispatches the phase with the comment; bot comments and repeats do not', async () => {
  w = await world({}, { script: { plan: [[{ comment: 'handoff from the agent' }], [], [{ sleep: 600 }], []] } });
  const f = w.feature();
  w.mock.move(f.identifier, 'Plan', HUMAN);
  await w.settle();
  assert.equal(w.calls().length, 1, 'the agent\'s own comment does not resume');

  w.mock.addComment(f.id, 'Please add an offline mode section.', HUMAN);
  await w.settle();
  assert.equal(w.calls().length, 2);
  assert.match(w.calls()[1].argv.at(-1), /Please add an offline mode section/);
  await w.settle();
  assert.equal(w.calls().length, 2, 'dedupe by comment id');

  // A comment made while a run is live waits for the run to end, then resumes once.
  w.mock.addComment(f.id, 'one more', HUMAN);
  await w.settle();
  assert.equal(w.calls().length, 3);
  w.mock.addComment(f.id, 'and while you are at it', HUMAN);
  w.mock.addComment(f.id, 'also this', HUMAN);
  await w.settle();
  assert.equal(w.calls().length, 4, 'two comments after an ended run → one resume');
});

test('park: an AIDLC question parks the run (needs-a-human, lane + session kept); the answer resumes the same session', async () => {
  w = await world({}, { script: { build: [], plan: [[{ comment: '**AIDLC question**\n@melissa 1. CSV or XLSX? (recommend CSV)' }], [{ print: 'resumed' }]] } });
  const f = w.feature();
  w.mock.move(f.identifier, 'Plan', HUMAN);
  await w.settle();
  const rec = w.store.findIssue(f.identifier);
  assert.ok(rec.parked, 'parked');
  assert.deepEqual(w.mock.labelsOf(f.identifier), ['needs-a-human']);
  assert.ok(fs.existsSync(rec.parked.lane.path), 'lane kept for the resume');
  await w.tick({ full: false });
  assert.equal(w.calls().length, 1, 'no answer yet: nothing');

  w.mock.addComment(f.id, 'CSV.', HUMAN);
  await w.tick({ full: false });
  await w.engine.runner.idle();
  const [first, second] = w.calls();
  assert.equal(second.argv[second.argv.indexOf('--session') + 1], first.argv[first.argv.indexOf('--session') + 1], 'same OpenCode session');
  assert.equal(second.cwd, first.cwd, 'same lane');
  assert.match(second.argv.at(-1), /> CSV\./);
  assert.deepEqual(w.mock.labelsOf(f.identifier), []);
  assert.equal(w.store.findIssue(f.identifier).parked, null);
});

test('park: a human state move clears needs-a-human and the parked lane', async () => {
  w = await world({}, { script: { plan: [[{ comment: '**AIDLC question**\n1. ?' }]], design: [[]] } });
  const f = w.feature();
  w.mock.move(f.identifier, 'Plan', HUMAN);
  await w.settle();
  const lane = w.store.findIssue(f.identifier).parked.lane.path;
  w.mock.move(f.identifier, 'Design', HUMAN);
  await w.settle();
  assert.deepEqual(w.mock.labelsOf(f.identifier), []);
  assert.ok(!fs.existsSync(lane));
  assert.equal(w.calls().at(-1).env.AIDLC_PHASE, 'design');
});

test('wall-clock cap: a hung run is killed, the delegate cleared, retried with backoff, then surfaced to the human', async () => {
  w = await world({ caps: { plan: '1s' }, runner: { retries: 1, backoff: '1s', killGrace: '1s' } }, { script: { plan: [[{ sleep: 10000 }], [{ sleep: 10000 }]] } });
  const f = w.feature();
  w.mock.move(f.identifier, 'Plan', HUMAN);
  await w.tick();
  await w.engine.runner.idle();
  assert.equal(w.store.findIssue(f.identifier).lastRun.outcome, 'timeout');
  assert.equal(w.mock.find(f.identifier).delegateId, null);
  await w.tick({ full: false }); // exit processed → retry scheduled after the backoff
  assert.equal(w.calls().length, 1, 'not before the backoff');
  w.advance(2000);
  await w.tick({ full: false }); // retry dispatched
  await w.engine.runner.idle();
  await w.tick({ full: false }); // second timeout → surfaced
  assert.equal(w.calls().length, 2, 'one retry');
  assert.ok(w.mock.commentsOn(f.identifier).some((c) => /hit its wall-clock cap \(1s\) 2 time/.test(c.body)));
});

test('evidence is uploaded to Linear before the lane is torn down; the log tail is redacted', async () => {
  w = await world({}, { script: { plan: [[{ evidence: { name: 'shot.png', content: 'PNGDATA' } }, { printEnv: 'AIDLC_LINEAR_AGENT_KEY' }]] } });
  const f = w.feature();
  w.mock.move(f.identifier, 'Plan', HUMAN);
  await w.settle();
  const up = Object.values(w.mock.uploads)[0];
  assert.equal(up.filename, 'shot.png');
  assert.equal(up.bytes.toString(), 'PNGDATA');
  const status = w.mock.commentsOn(f.identifier).find((c) => /AIDLC daemon\*\* — `plan` run/.test(c.body));
  assert.match(status.body, /!\[shot\.png\]\(https:\/\/uploads\.linear\.app\/mock\//);
  const token = w.calls()[0].env.AIDLC_LINEAR_AGENT_KEY;
  assert.ok(!status.body.includes(token), 'the run token is redacted from the log tail');
  assert.match(status.body, /AIDLC_LINEAR_AGENT_KEY=\[REDACTED\]/);
  assert.ok(!fs.existsSync(w.calls()[0].cwd), 'lane removed after upload');
  const rec = w.store.findIssue(f.identifier);
  assert.ok(fs.existsSync(path.join(w.store.evidenceDir(f.identifier, rec.lastRun.runId), 'shot.png')), 'local copy kept');
});

test('one status comment per issue, edited in place', async () => {
  w = await world({}, { script: { plan: [[], []] } });
  const f = w.feature();
  w.mock.move(f.identifier, 'Plan', HUMAN);
  await w.settle();
  w.mock.addComment(f.id, 'revise', HUMAN);
  await w.settle();
  assert.equal(w.mock.commentsOn(f.identifier).filter((c) => /AIDLC daemon\*\* — `plan` run/.test(c.body)).length, 1);
});

test('PAUSE file: no dispatch while paused (gate deferred, not lost); reverts still happen', async () => {
  w = await world({}, { script: { plan: [[]] } });
  fs.writeFileSync(w.store.pauseFile, '');
  const f = w.feature();
  w.mock.move(f.identifier, 'Plan', HUMAN);
  await w.settle();
  assert.equal(w.calls().length, 0);
  w.mock.move(f.identifier, 'Design', BOT);
  await w.tick();
  assert.equal(w.mock.stateOf(f.identifier), 'Plan', 'the safety core keeps running while paused');
  await w.engine.confirmGate(f.identifier);
  fs.unlinkSync(w.store.pauseFile);
  await w.settle();
  assert.equal(w.calls().length, 1, 'the deferred Plan gate dispatches on resume');
});

test('ceiling rule: the daemon refuses to move a Feature into a gate state, whatever the transitions say', async () => {
  w = await world();
  const f = w.feature();
  w.mock.move(f.identifier, 'Plan', HUMAN);
  await w.settle();
  const issue = await w.engine.linear.issue(f.id);
  const r = await w.engine.machineMove(issue, 'done');
  assert.equal(r, 'stop');
  assert.equal(w.mock.stateOf(f.identifier), 'Plan');
  assert.ok(w.mock.commentsOn(f.identifier).some((c) => /Ceiling rule/.test(c.body)));
});

test('reconcile after a crash: stale run records, stale bot delegates and orphan lanes are cleared', async () => {
  w = await world({}, { script: { plan: [[]] } });
  const f = w.feature();
  const rec = w.store.issue(f.id, f.identifier);
  rec.run = { runId: 'plan-old', phase: 'plan', pid: 999999, startedAt: new Date(w.now() - 1000).toISOString(), lane: { path: path.join(w.cfg.lanes.dir, 'ENG-1-plan-old') } };
  fs.mkdirSync(path.join(w.cfg.lanes.dir, 'orphan'), { recursive: true });
  w.mock.find(f.identifier).delegateId = BOT;
  const report = await w.engine.reconcile({ scan: false });
  assert.deepEqual({ ...report, scanned: undefined }, { staleRuns: 1, delegatesCleared: 1, lanesRemoved: 1, scanned: undefined });
  assert.equal(w.mock.find(f.identifier).delegateId, null);
  assert.equal(w.store.findIssue(f.identifier).run, null);
});

test('a PR merged by the bot account never advances until a human accepts it', async () => {
  w = await world({}, { script: { design: [[]], build: [[{ commit: { file: 'a.txt', content: 'a\n' } }]], review: [[]] } });
  const f = w.feature();
  w.mock.saveDocument(f.id, 'Tech Spec — CSV export', TECH_SPEC(TWO_SLICES));
  w.mock.move(f.identifier, 'Design', HUMAN);
  await w.settle();
  w.mock.move(f.identifier, 'Build+Test', HUMAN);
  await w.settle();
  const [s1] = w.mock.childrenOf(f.identifier);
  const pr = w.gh.openPr(w.store.findIssue(s1.identifier).branch);
  w.gh.green(pr.headSha);
  await w.settle();
  w.gh.green(w.gh.merge(pr, 'aidlc-bot'));
  await w.settle();
  assert.equal(w.mock.stateOf(s1.identifier), 'Review', 'not advanced');
  assert.equal(w.store.findIssue(s1.identifier).paused.kind, 'bot-merge');
  assert.match(await w.engine.confirmGate(s1.identifier), /accepted by a human/);
  await w.settle();
  assert.equal(w.mock.stateOf(s1.identifier), 'Done');
});

test('a non-human move to Canceled (auto-close) is recorded, not reverted', async () => {
  w = await world({}, { script: { plan: [[]] } });
  const f = w.feature();
  w.mock.move(f.identifier, 'Plan', HUMAN);
  await w.settle();
  w.mock.move(f.identifier, 'Canceled', null, { type: 'system', name: 'Auto-close' });
  await w.settle();
  assert.equal(w.mock.stateOf(f.identifier), 'Canceled');
  assert.ok(!w.store.findIssue(f.identifier).paused);
});
