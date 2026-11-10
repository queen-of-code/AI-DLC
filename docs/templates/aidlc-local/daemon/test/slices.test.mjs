// Slice choreography (plan §4): create on the human's Build+Test gate, release one at a time,
// umbrella waits and never builds, breaker counts bounces per slice, check evidence at PR head and
// merge SHA, tamper flag, base-branch check definitions.
import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { HUMAN, TECH_SPEC, TWO_SLICES, world } from './harness.mjs';

let w;
afterEach(async () => w && (await w.close()));

const commit = (file, content = 'x\n') => ({ commit: { file, content } });
const SCORECARD = (passed, total, humanPending = 0) => ({
  document: {
    title: 'Validate Scorecard — CSV export',
    content: `# Scorecard\n\n\`\`\`aidlc-scorecard\n${JSON.stringify({ version: 1, passed, failed: total - passed - humanPending, humanPending, total, proposedReturn: '' })}\n\`\`\`\n`,
  },
});

async function gatedFeature(w, slices = TWO_SLICES) {
  const f = w.feature();
  w.mock.move(f.identifier, 'Plan', HUMAN);
  w.mock.move(f.identifier, 'Design', HUMAN);
  w.mock.saveDocument(f.id, 'Tech Spec — CSV export', TECH_SPEC(slices));
  await w.settle();
  w.mock.move(f.identifier, 'Build+Test', HUMAN);
  return f;
}

const phases = (w) => w.calls().map((c) => `${c.env.AIDLC_PHASE}:${c.env.AIDLC_ISSUE}`);
const branchOf = (w, issue) => w.store.findIssue(issue.identifier).branch;

/** Drive one slice from "build run done" through the human's merge to Done. */
async function shipSlice(w, slice) {
  const pr = w.gh.openPr(branchOf(w, slice));
  w.gh.green(pr.headSha);
  await w.settle(); // pr.ready → verify → Review → review run
  const sha = w.gh.merge(pr);
  w.gh.green(sha);
  await w.settle(); // merged → In Staging → verify merge SHA → Done → release next
  return pr;
}

test('Design → Build+Test gate creates the slices (backlog, blocks chain) and releases only the first', async () => {
  w = await world({}, { script: { design: [[]], build: [[{ sleep: 200 }, commit('a.txt')]] } });
  const f = await gatedFeature(w);
  await w.tick();
  const kids = w.mock.childrenOf(f.identifier);
  assert.equal(kids.length, 2);
  assert.match(kids[0].description, /`aidlc-slice: ENG-1\/export-api`/);
  assert.equal(w.mock.relations.length, 1);
  assert.equal(w.mock.relations[0].issueId, kids[0].id, 'export-api blocks export-ui');
  assert.equal(w.mock.stateOf(kids[0].identifier), 'Build+Test', 'slice 1 released');
  assert.equal(w.mock.stateOf(kids[1].identifier), 'Not Started', 'slice 2 stays inert');
  await w.engine.runner.idle();
  assert.deepEqual(phases(w), ['design:ENG-1', `build:${kids[0].identifier}`], 'the umbrella never builds');
  // Daemon's own moves are authorized: nothing reverted, nothing paused.
  await w.settle();
  assert.equal(w.mock.stateOf(kids[0].identifier), 'Build+Test');
  assert.ok(!Object.values(w.store.data.issues).some((r) => r.paused));

  // Idempotent: running creation again adds nothing.
  await w.engine.createSlicesAction(await w.engine.linear.issue(f.id), w.store.findIssue(f.identifier), { id: 'again' });
  assert.equal(w.mock.childrenOf(f.identifier).length, 2);
  assert.equal(w.mock.relations.length, 1);
});

test('full chain: build → review → merge → Done → next slice → feature In Staging → ship at merged main → Ship → learn → human Done', async () => {
  w = await world({}, {
    script: {
      design: [[]],
      build: [[commit('api.txt')], [commit('ui.txt')]],
      review: [[], []],
      ship: [[SCORECARD(4, 4)]],
      learn: [[]],
    },
  });
  const f = await gatedFeature(w);
  await w.settle();
  const [s1, s2] = w.mock.childrenOf(f.identifier);
  assert.ok(w.originHas(`refs/heads/${branchOf(w, s1)}`), 'the build run pushed the slice branch');

  await shipSlice(w, s1);
  assert.equal(w.mock.stateOf(s1.identifier), 'Done');
  assert.equal(w.mock.stateOf(s2.identifier), 'Build+Test', 'next sibling released when slice 1 reached Done');
  assert.equal(w.mock.stateOf(f.identifier), 'Build+Test', 'umbrella waits');

  await shipSlice(w, s2);
  assert.equal(w.mock.stateOf(s2.identifier), 'Done');
  // Last slice Done → feature In Staging → checks at merged main (= slice 2's merge, already green) → ship.
  const main = (await import('node:child_process')).execFileSync('git', ['rev-parse', 'refs/heads/main'], { cwd: w.origin, encoding: 'utf8' }).trim();
  assert.ok(w.events().some((e) => e.issue === 'ENG-1' && e.type === 'move' && /build → staging/.test(e.msg)));
  await w.settle();
  assert.equal(w.mock.stateOf(f.identifier), 'Ship', 'scorecard ≥ threshold → Ship');
  await w.settle();

  assert.deepEqual(phases(w), [
    'design:ENG-1',
    `build:${s1.identifier}`,
    `review:${s1.identifier}`,
    `build:${s2.identifier}`,
    `review:${s2.identifier}`,
    'ship:ENG-1',
    'learn:ENG-1',
  ]);
  const ship = w.calls().find((c) => c.env.AIDLC_PHASE === 'ship');
  assert.match(ship.argv.at(-1), new RegExp(`detached at \`${main}\``), 'ship lane pinned to merged main');
  const review = w.calls().find((c) => c.env.AIDLC_PHASE === 'review');
  assert.match(review.argv.at(-1), /Check verdict at head, verified by the daemon: \*\*GREEN\*\*/);

  w.mock.move(f.identifier, 'Done', HUMAN);
  await w.settle();
  assert.ok(w.store.findIssue(f.identifier).closed);
  assert.equal(w.mock.stateOf(f.identifier), 'Done', 'the human Done gate stands');
});

test('1-slice Feature: the Feature is the unit — it builds itself, validates at the merge SHA', async () => {
  w = await world({}, { script: { design: [[]], build: [[commit('one.txt')]], review: [[]], ship: [[SCORECARD(3, 3)]], learn: [[]] } });
  const f = await gatedFeature(w, []);
  await w.settle();
  assert.equal(w.mock.childrenOf(f.identifier).length, 0);
  assert.equal(w.store.findIssue(f.identifier).kind, 'unit');
  const pr = w.gh.openPr(branchOf(w, f));
  w.gh.green(pr.headSha);
  await w.settle();
  assert.equal(w.mock.stateOf(f.identifier), 'Review');
  const sha = w.gh.merge(pr);
  w.gh.green(sha);
  await w.settle();
  await w.settle();
  assert.equal(w.mock.stateOf(f.identifier), 'Ship');
  assert.deepEqual(phases(w), ['design:ENG-1', 'build:ENG-1', 'review:ENG-1', 'ship:ENG-1', 'learn:ENG-1']);
  assert.match(w.calls()[3].argv.at(-1), new RegExp(sha));
});

test('a marker sub-issue the daemon did not create is not a slice: never dispatched, flagged', async () => {
  w = await world({}, { script: { build: [[]] } });
  const f = w.feature();
  const forged = w.mock.createIssue({ title: 'forged', description: '`aidlc-slice: ENG-1/evil`', state: 'Build+Test', parentId: f.id, creatorId: 'user-bot' });
  w.mock.move(forged.identifier, 'Review', 'user-bot');
  w.mock.move(forged.identifier, 'Build+Test', HUMAN);
  await w.settle();
  assert.equal(w.calls().length, 0);
  assert.ok(w.mock.commentsOn(forged.identifier).some((c) => /did not create it/.test(c.body)));
});

test('bounce re-dispatches build on the slice branch with the findings; the breaker trips per slice and stops the chain', async () => {
  w = await world({ breaker: { bounces: 2 } }, { script: { design: [[]], build: [[commit('api.txt')], [commit('fix1.txt')], [commit('fix2.txt')]], review: [[], [], []] } });
  const f = await gatedFeature(w);
  await w.settle();
  const [s1, s2] = w.mock.childrenOf(f.identifier);
  const pr = w.gh.openPr(branchOf(w, s1));
  w.gh.green(pr.headSha);
  w.gh.findings[pr.number] = ['### AIDLC Review — Testing\n\n**blocking**: no test for empty export'];
  await w.settle();
  assert.equal(w.mock.stateOf(s1.identifier), 'Review');

  w.mock.move(s1.identifier, 'Build+Test', HUMAN); // bounce 1
  await w.settle();
  const b1 = w.calls().filter((c) => c.env.AIDLC_PHASE === 'build')[1];
  assert.match(b1.argv.at(-1), /bounce 1 of 2/);
  assert.match(b1.argv.at(-1), /no test for empty export/);
  assert.ok(b1.argv.at(-1).includes(branchOf(w, s1)));

  w.gh.refresh(pr);
  w.gh.green(pr.headSha);
  await w.settle();
  assert.equal(w.mock.stateOf(s1.identifier), 'Review');
  w.mock.move(s1.identifier, 'Build+Test', HUMAN); // bounce 2 = trip
  await w.settle();
  assert.equal(w.calls().filter((c) => c.env.AIDLC_PHASE === 'build').length, 2, 'no build after the breaker trips');
  assert.ok(w.mock.commentsOn(s1.identifier).some((c) => /Circuit breaker tripped/.test(c.body)));
  assert.equal(w.mock.find(s1.identifier).assigneeId, HUMAN, 'reassigned to the lead');
  assert.match(w.store.findIssue(f.identifier).chainStopped, /breaker/);

  // Chain progress is not a bounce, and a stopped chain releases nothing.
  w.mock.move(s1.identifier, 'Done', HUMAN);
  await w.settle();
  assert.equal(w.mock.stateOf(s2.identifier), 'Not Started');
});

test('merged straight from Build+Test: Review skipped is recorded, not blocked', async () => {
  w = await world({}, { script: { design: [[]], build: [[commit('api.txt')], [{ sleep: 50 }]] } });
  const f = await gatedFeature(w);
  await w.settle();
  const [s1] = w.mock.childrenOf(f.identifier);
  const pr = w.gh.openPr(branchOf(w, s1), { draft: true });
  const sha = w.gh.merge(pr);
  w.gh.green(sha);
  await w.settle();
  assert.equal(w.mock.stateOf(s1.identifier), 'Done');
  assert.ok(w.mock.commentsOn(s1.identifier).some((c) => /Review was skipped/.test(c.body)));
});

test('red checks at the merge SHA: no Done, failure presented with a proposed return phase', async () => {
  w = await world({}, { script: { design: [[]], build: [[commit('api.txt')]], review: [[]] } });
  const f = await gatedFeature(w);
  await w.settle();
  const [s1] = w.mock.childrenOf(f.identifier);
  const pr = w.gh.openPr(branchOf(w, s1));
  w.gh.green(pr.headSha);
  await w.settle();
  const sha = w.gh.merge(pr);
  w.gh.red(sha);
  await w.settle();
  assert.equal(w.mock.stateOf(s1.identifier), 'In Staging');
  assert.ok(w.mock.commentsOn(s1.identifier).some((c) => /checks red/.test(c.body) && /Proposed return phase: \*\*Build\+Test\*\*/.test(c.body)));
});

test('pending checks defer the Review move until they complete', async () => {
  w = await world({}, { script: { design: [[]], build: [[commit('api.txt')]], review: [[]] } });
  const f = await gatedFeature(w);
  await w.settle();
  const [s1] = w.mock.childrenOf(f.identifier);
  const pr = w.gh.openPr(branchOf(w, s1));
  w.gh.checkRuns[pr.headSha] = [{ name: 'test', status: 'in_progress', conclusion: null }];
  await w.settle();
  assert.equal(w.mock.stateOf(s1.identifier), 'Build+Test');
  w.gh.green(pr.headSha);
  w.advance(61e3);
  await w.settle();
  assert.equal(w.mock.stateOf(s1.identifier), 'Review');
});

test('tamper flag: a PR touching check definitions is flagged and the review prompt says so', async () => {
  w = await world({}, { script: { design: [[]], build: [[commit('api.txt')]], review: [[]] } });
  const f = await gatedFeature(w);
  await w.settle();
  const [s1] = w.mock.childrenOf(f.identifier);
  const pr = w.gh.openPr(branchOf(w, s1));
  w.gh.files[pr.number] = ['src/api.ts', '.github/workflows/ci.yml'];
  w.gh.green(pr.headSha);
  await w.settle();
  assert.ok(w.mock.commentsOn(s1.identifier).some((c) => /Check definitions changed/.test(c.body) && /ci\.yml/.test(c.body)));
  const review = w.calls().find((c) => c.env.AIDLC_PHASE === 'review');
  assert.match(review.argv.at(-1), /Check definitions changed in this PR/);
});

test('hooks-only: the daemon re-runs the suite itself, with the base branch check definitions', async () => {
  w = await world(
    { ci: { mode: 'hooks-only', command: './check.sh', definitionPaths: ['check.sh', '.github/workflows/**'] } },
    { script: { design: [[]], build: [[commit('FAIL', 'broken\n'), commit('check.sh', '#!/bin/sh\nexit 0\n')]], review: [[]] } },
  );
  const f = await gatedFeature(w);
  await w.settle();
  const [s1] = w.mock.childrenOf(f.identifier);
  const pr = w.gh.openPr(branchOf(w, s1));
  w.gh.files[pr.number] = ['FAIL', 'check.sh'];
  await w.settle();
  assert.equal(w.mock.stateOf(s1.identifier), 'Review', 'Review still happens, with the verdict');
  const review = w.calls().find((c) => c.env.AIDLC_PHASE === 'review');
  assert.match(review.argv.at(-1), /\*\*RED\*\*/, 'the agent\'s rewritten check.sh did not count: base definition ran');
  assert.match(review.argv.at(-1), /base definitions: [^)]*check\.sh/);
});

test('a Validate re-run that edits the existing scorecard counts (Linear keeps updatedAt on content edits); one that does not touch it is not a scorecard', async () => {
  w = await world({}, {
    script: { design: [[]], build: [[commit('one.txt')]], review: [[]], ship: [[SCORECARD(2, 4)], [], [SCORECARD(4, 4)]], learn: [[]] },
  });
  const f = await gatedFeature(w, []);
  await w.settle();
  const pr = w.gh.openPr(branchOf(w, f));
  w.gh.green(pr.headSha);
  await w.settle();
  w.gh.green(w.gh.merge(pr));
  await w.settle();
  assert.equal(w.mock.stateOf(f.identifier), 'In Staging', '50% → stays in In Staging');
  const docs = () => w.mock.documents.filter((d) => d.issueId === f.id && d.title.startsWith('Validate Scorecard'));
  const updated = docs()[0].updatedAt;

  w.mock.addComment(f.id, 'Re-validate please', HUMAN);
  await w.settle(); // ship run 2 writes nothing
  assert.equal(w.mock.stateOf(f.identifier), 'In Staging');
  assert.ok(w.mock.commentsOn(f.identifier).some((c) => /ended without a readable/.test(c.body)), 'the stale 50% scorecard is not re-counted');

  w.mock.addComment(f.id, 'Fixed, try again', HUMAN);
  await w.settle(); // ship run 3 rewrites the same Document's content
  assert.equal(docs().length, 1, 'same Document, edited');
  assert.equal(docs()[0].updatedAt, updated, 'updatedAt unchanged, as on real Linear');
  await w.settle();
  assert.equal(w.mock.stateOf(f.identifier), 'Ship', 'the edited scorecard (100%) is recognized by content');
});
