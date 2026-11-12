// Decision B (owner, 2026-11-09): the agent's Linear token is read + comments only. It writes the
// Documents it produces as files in the lane docs dir; the daemon publishes them to Linear after the
// run, refusing to clobber a Document a human edited while the run was live.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { afterEach, test } from 'node:test';
import { HUMAN, TECH_SPEC, TWO_SLICES, world } from './harness.mjs';

let w;
afterEach(async () => w && (await w.close()));

test('the daemon publishes a Document the agent wrote to the lane docs dir; the agent\'s own write is refused', async () => {
  w = await world(
    {},
    {
      script: {
        design: [
          [
            { docFile: { file: 'tech-spec.md', content: TECH_SPEC(TWO_SLICES) } },
            { document: { title: 'Product Spec — CSV export', content: 'the agent cannot file Documents' } },
          ],
        ],
      },
    },
  );
  const f = w.feature();
  w.mock.move(f.identifier, 'Plan', HUMAN);
  w.mock.move(f.identifier, 'Design', HUMAN);
  await w.settle();

  const docs = w.mock.documents.filter((d) => d.issueId === f.id);
  assert.equal(docs.length, 1, 'exactly one Document: the daemon-published Tech Spec');
  assert.equal(docs[0].title, 'Tech Spec — CSV export');
  assert.equal(docs[0].content, TECH_SPEC(TWO_SLICES));
  const save = w.mock.calls.find((c) => c.op === 'TestSaveDocument');
  assert.ok(save && save.denied, 'the agent\'s own Document write was refused by Linear');
  const status = w.mock.commentsOn(f.identifier).find((c) => /AIDLC daemon\*\* — `design` run/.test(c.body));
  assert.match(status.body, /documents published: Tech Spec — CSV export/);
  const run = w.store.findIssue(f.identifier).lastRun;
  assert.ok(fs.existsSync(path.join(w.store.dir, 'docs', f.identifier, run.runId, 'tech-spec.md')), 'an audit copy of the published file survives the lane');
});

test('a resumed run updates the same Document in place — no duplicate', async () => {
  w = await world(
    {},
    {
      script: {
        plan: [
          [
            { docFile: { file: 'product-spec.md', content: 'v1 of the product spec\n' } },
            { comment: '**AIDLC question**\n@melissa 1. CSV or XLSX? (recommend CSV)' },
          ],
          [{ docFile: { file: 'product-spec.md', content: 'v2 of the product spec (offline mode added)\n' } }],
        ],
      },
    },
  );
  const f = w.feature();
  w.mock.move(f.identifier, 'Plan', HUMAN);
  await w.settle();
  w.mock.addComment(f.id, 'CSV, and add an offline mode.', HUMAN);
  await w.settle();

  const docs = w.mock.documents.filter((d) => d.issueId === f.id && d.title === 'Product Spec — CSV export');
  assert.equal(docs.length, 1, 'the resumed run updated the existing Document, not a new one');
  assert.equal(docs[0].content, 'v2 of the product spec (offline mode added)\n');
});

test('a Document a human edited during the run is NOT overwritten — held, attached, flagged', async () => {
  w = await world({}, { script: { design: [[{ sleep: 400 }, { docFile: { file: 'tech-spec.md', content: 'the run\'s version\n' } }]] } });
  const f = w.feature();
  w.mock.saveDocument(f.id, 'Tech Spec — CSV export', 'the human\'s baseline\n');
  w.mock.move(f.identifier, 'Plan', HUMAN);
  w.mock.move(f.identifier, 'Design', HUMAN);
  await w.tick(); // dispatch: the baseline snapshot takes the current content
  w.mock.saveDocument(f.id, 'Tech Spec — CSV export', 'the human\'s edit made while the run was live\n');
  await w.settle();

  const doc = w.mock.documents.find((d) => d.title === 'Tech Spec — CSV export');
  assert.equal(doc.content, 'the human\'s edit made while the run was live\n', 'the human edit survives');
  assert.ok(w.mock.commentsOn(f.identifier).some((c) => /was NOT published/.test(c.body) && /@melissa/.test(c.body)));
  assert.ok(Object.values(w.mock.uploads).some((u) => u.filename === 'tech-spec.md'), 'the run\'s version was attached for the human to merge');
});

test('image references in a published Document are rewritten to the uploaded asset URL', async () => {
  const scorecard = [
    '# Scorecard',
    '',
    '![screenshot](shot.png)',
    '',
    '```aidlc-scorecard',
    JSON.stringify({ version: 1, passed: 1, failed: 0, humanPending: 0, total: 1, proposedReturn: '' }),
    '```',
    '',
  ].join('\n');
  w = await world(
    {},
    {
      script: {
        plan: [[]],
        design: [[]],
        build: [[{ commit: { file: 'one.txt', content: 'x\n' } }]],
        review: [[]],
        ship: [[{ evidence: { name: 'shot.png', content: 'PNGDATA' } }, { docFile: { file: 'validate-scorecard.md', content: scorecard } }]],
        learn: [[]],
      },
    },
  );
  const f = w.feature();
  w.mock.saveDocument(f.id, 'Tech Spec — CSV export', TECH_SPEC([]));
  w.mock.move(f.identifier, 'Plan', HUMAN);
  w.mock.move(f.identifier, 'Design', HUMAN);
  await w.settle();
  w.mock.move(f.identifier, 'Build+Test', HUMAN);
  await w.settle();
  const pr = w.gh.openPr(w.store.findIssue(f.identifier).branch);
  w.gh.green(pr.headSha);
  await w.settle();
  w.gh.green(w.gh.merge(pr));
  await w.settle();
  await w.settle();

  const doc = w.mock.documents.find((d) => d.title === 'Validate Scorecard — CSV export');
  assert.ok(doc, 'the scorecard was published');
  const up = Object.values(w.mock.uploads).find((u) => u.filename === 'shot.png');
  assert.ok(up, 'the screenshot was uploaded');
  assert.match(doc.content, new RegExp(`\\]\\(https://uploads\\.linear\\.app/mock/[^)]*${up.filename}`));
  assert.doesNotMatch(doc.content, /\]\(shot\.png\)/, 'the lane-relative reference was rewritten');
});
