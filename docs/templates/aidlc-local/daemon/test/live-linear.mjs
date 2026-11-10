#!/usr/bin/env node
// Live probe of the Linear behaviours the daemon depends on. Manual, never run by CI.
//
//   AIDLC_LIVE_ENV=~/.config/aidlc/live-test.env AIDLC_LIVE_TEAM=QUE AIDLC_LIVE_SCRATCH=QUE-16 \
//     node docs/templates/aidlc-local/daemon/test/live-linear.mjs
//
// live-test.env (chmod 600): AIDLC_LIVE_LINEAR_KEY=<a Linear API key>. The key is never printed.
// READ-ONLY across the team (history actors of recent issues). WRITES only to the scratch issue:
// two state moves (and back), one comment + edit, one 40-byte upload, one refused delegate write.
import fs from 'node:fs';
import { Linear } from '../lib/linear.mjs';
import { expandHome, parseEnvFile } from '../lib/util.mjs';

const envFile = expandHome(process.env.AIDLC_LIVE_ENV || '~/.config/aidlc/live-test.env');
const st = fs.statSync(envFile);
if (st.mode & 0o077) throw new Error(`${envFile} must be chmod 600`);
const key = parseEnvFile(fs.readFileSync(envFile, 'utf8')).AIDLC_LIVE_LINEAR_KEY;
if (!key) throw new Error(`AIDLC_LIVE_LINEAR_KEY missing in ${envFile}`);
const team = process.env.AIDLC_LIVE_TEAM || 'QUE';
const scratch = process.env.AIDLC_LIVE_SCRATCH;
const L = new Linear({ apiUrl: 'https://api.linear.app/graphql', key });
const out = (k, v) => console.log(`${k.padEnd(34)} ${typeof v === 'string' ? v : JSON.stringify(v)}`);

const me = await L.viewer();
out('viewer', `${me.name} (${me.id})`);
const t = await L.team(team);
const sname = (id) => t.states.find((s) => s.id === id)?.name || id;

// 1. How existing moves are attributed (UI, integrations, apps) — read only.
const issues = await L.issuesInStates(team, t.states.map((s) => s.name));
const combos = {};
let orderAsc = 0;
let orderDesc = 0;
let maxHist = 0;
for (const i of issues.slice(0, 25)) {
  const raw = (await L.gql('AidlcIssue', { id: i.id })).issue;
  const nodes = raw.history.nodes;
  maxHist = Math.max(maxHist, nodes.length);
  for (let k = 1; k < nodes.length; k++) Date.parse(nodes[k].createdAt) >= Date.parse(nodes[k - 1].createdAt) ? orderAsc++ : orderDesc++;
  for (const h of nodes.filter((x) => x.toStateId && x.fromStateId !== x.toStateId)) {
    const c = `actor=${h.actor ? `${h.actor.name}${h.actor.id === me.id ? ' (viewer)' : ''}` : 'null'} botActor=${h.botActor ? `${h.botActor.type}/${h.botActor.name}` : 'null'}`;
    (combos[c] ||= []).push(`${i.identifier}:${sname(h.fromStateId)}→${sname(h.toStateId)}`);
  }
}
out('issues sampled', Math.min(25, issues.length));
out('history order (pairs asc/desc)', `${orderAsc}/${orderDesc}`);
out('largest history returned', maxHist);
for (const [c, ex] of Object.entries(combos)) out(`state moves: ${c}`, `${ex.length} e.g. ${ex.slice(0, 3).join(', ')}`);

if (!scratch) {
  console.log('\n(no AIDLC_LIVE_SCRATCH: skipping writes)');
  process.exit(0);
}

// 2. Writes on the scratch issue only.
const s0 = await L.issue(scratch);
if (!/\[aidlc-daemon test\]/.test(s0.title)) throw new Error(`${scratch} is not the aidlc-daemon scratch issue — refusing to write`);
const home = s0.state.id;
const triage = t.states.find((s) => s.name === 'Triage' && s.id !== home) || t.states.find((s) => s.type === 'backlog' && s.id !== home);
await L.updateIssue(s0.id, { stateId: triage.id });
await L.updateIssue(s0.id, { stateId: home });
const s1 = await L.issue(s0.id);
const mine = s1.history.filter((h) => h.toStateId && Date.parse(h.createdAt) > Date.now() - 120e3);
for (const h of mine) out('API-key move attribution', `${sname(h.fromStateId)}→${sname(h.toStateId)} actor=${h.actor?.name ?? null}${h.actor?.id === me.id ? ' (viewer)' : ''} botActor=${h.botActor ? JSON.stringify(h.botActor) : null}`);

const cid = await L.comment(s0.id, 'aidlc-daemon live probe: comment via API key (will be edited)');
await L.editComment(cid, 'aidlc-daemon live probe: comment via API key — edited in place');
const s2 = await L.issue(s0.id);
const c = s2.comments.find((x) => x.id === cid);
out('comment author / botActor', `${c.user?.name} / ${JSON.stringify(c.botActor)}`);
out('comment edited in place', c.body.endsWith('edited in place'));
out('comment bumps issue.updatedAt', s2.updatedAt !== s1.updatedAt);

try {
  const url = await L.upload('aidlc-probe.txt', 'text/plain', Buffer.from('aidlc-daemon live probe upload\n'));
  out('fileUpload + PUT', `ok → ${url.replace(/\/[^/]+$/, '/…')}`);
  const anon = await fetch(url).then((r) => r.status).catch((e) => e.message);
  out('asset fetch without auth', anon);
} catch (e) {
  out('fileUpload + PUT', `FAILED: ${e.message}`);
}

try {
  await L.updateIssue(s0.id, { delegateId: me.id });
  out('delegate = viewer (member)', 'ACCEPTED');
  await L.updateIssue(s0.id, { delegateId: null });
} catch (e) {
  out('delegate = viewer (member)', `refused: ${e.message}`);
}
