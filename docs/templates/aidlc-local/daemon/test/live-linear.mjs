#!/usr/bin/env node
// Live probe of the Linear behaviours the daemon depends on. Manual, never run by CI.
//
//   AIDLC_LIVE_ENV=~/.config/aidlc/live-test.env AIDLC_LIVE_TEAM=QUE AIDLC_LIVE_SCRATCH=QUE-16 \
//     node docs/templates/aidlc-local/daemon/test/live-linear.mjs
//
// live-test.env (chmod 600): AIDLC_LIVE_LINEAR_KEY=<a Linear API key>. The key is never printed.
// READ-ONLY across the team (history actors of recent issues). WRITES only to the scratch issue:
// two state moves (and back), one comment + edit, one 40-byte upload, one refused delegate write,
// a Document create/update/renamed lifecycle (daemon token), and the Decision B proofs that the
// agent token (read + comments) cannot move state or create Documents.
import fs from 'node:fs';
import { Linear } from '../lib/linear.mjs';
import { ClientCredentials } from '../lib/oauth.mjs';
import { expandHome, parseEnvFile } from '../lib/util.mjs';

const envFile = expandHome(process.env.AIDLC_LIVE_ENV || '~/.config/aidlc/live-test.env');
const st = fs.statSync(envFile);
if (st.mode & 0o077) throw new Error(`${envFile} must be chmod 600`);
const ENV = parseEnvFile(fs.readFileSync(envFile, 'utf8'));
const key = ENV.AIDLC_LIVE_LINEAR_KEY;
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

// 3. The two OAuth apps (OPENCODE-LOCAL.md → Linear apps), if their client credentials are in the env file.
// Decision B: the agent app is read + comments ONLY — its state moves and Document writes must be
// refused by Linear itself. The daemon is the only Document writer (create/update lifecycle below).
if (ENV.AIDLC_LINEAR_DAEMON_CLIENT_ID && ENV.AIDLC_LINEAR_AGENT_CLIENT_ID) {
  const oauthUrl = 'https://api.linear.app/oauth';
  const dcc = new ClientCredentials({ oauthUrl, clientId: ENV.AIDLC_LINEAR_DAEMON_CLIENT_ID, clientSecret: ENV.AIDLC_LINEAR_DAEMON_CLIENT_SECRET, scopes: 'read,write,issues:create,comments:create,app:assignable' });
  const acc = new ClientCredentials({ oauthUrl, clientId: ENV.AIDLC_LINEAR_AGENT_CLIENT_ID, clientSecret: ENV.AIDLC_LINEAR_AGENT_CLIENT_SECRET, scopes: 'read,comments:create' });
  const dt = await dcc.mint();
  out('daemon app token', `ok, scope=${dt.scope}, expires in ${Math.round((dt.expiresAt - Date.now()) / 86400e3)}d`);
  const D = new Linear({ apiUrl: 'https://api.linear.app/graphql', key: dt.token });
  const dme = await D.viewer();
  out('daemon app viewer', `${dme.name} (${dme.id})`);
  try {
    await D.updateIssue(s0.id, { delegateId: dme.id });
    const back = await D.issue(s0.id);
    out('delegate = daemon app user', back.delegate?.id === dme.id ? 'ACCEPTED (claim works)' : `not set: ${JSON.stringify(back.delegate)}`);
    await D.updateIssue(s0.id, { delegateId: null });
    out('delegate cleared', (await D.issue(s0.id)).delegate === null);
  } catch (e) {
    out('delegate = daemon app user', `refused: ${e.message}`);
  }

  // The daemon's Document lifecycle (what the publisher does), on the scratch issue.
  // Leaves a probe document behind; the owner deletes it in the UI.
  await D.updateIssue(s0.id, { stateId: triage.id });
  await D.updateIssue(s0.id, { stateId: home });
  let docId = null;
  try {
    const dc = await D.documentCreate({ title: '[aidlc-daemon test] probe document', content: 'v1', issueId: s0.id });
    docId = dc.id;
    out('daemon documentCreate', `ok ${docId.slice(0, 8)}…`);
    const before = (await L.issue(s0.id)).documents.find((d) => d.id === docId);
    await D.documentUpdate(docId, { content: 'v2' });
    const after = (await L.issue(s0.id)).documents.find((d) => d.id === docId);
    out('daemon documentUpdate (content)', after && after.content === 'v2' ? 'ok, same id, in place' : `unexpected: ${JSON.stringify(after)}`);
    out('content-only edit bumps updatedAt', before && after ? String(after.updatedAt !== before.updatedAt) : 'n/a');
    await D.documentUpdate(docId, { title: '[aidlc-daemon test] probe document (renamed)' });
    const after2 = (await L.issue(s0.id)).documents.find((d) => d.id === docId);
    out('title edit bumps updatedAt', after && after2 ? String(after2.updatedAt !== after.updatedAt) : 'n/a');
  } catch (e) {
    out('daemon documentCreate/Update', `FAILED: ${e.message}`);
  }

  const at = await acc.mint();
  out('agent app token', `ok, scope=${at.scope}`);
  const A = new Linear({ apiUrl: 'https://api.linear.app/graphql', key: at.token });
  const ame = await A.viewer();
  out('agent app viewer', `${ame.name} (${ame.id})${ame.id === dme.id ? ' — SAME as daemon!' : ''}`);
  const tryRefused = async (name, fn) => {
    try {
      await fn();
      out(name, 'ACCEPTED — the agent holds more than read+comments; tier 1 is BROKEN');
    } catch (e) {
      out(name, `refused as designed: ${String(e.message).slice(0, 90)}`);
    }
  };
  await D.updateIssue(s0.id, { stateId: triage.id });
  await tryRefused('agent app state move', () => A.updateIssue(s0.id, { stateId: home }));
  await D.updateIssue(s0.id, { stateId: home });
  await tryRefused('agent app documentCreate', () => A.documentCreate({ title: '[aidlc-daemon test] agent doc (should not exist)', content: 'x', issueId: s0.id }));
  const cA = await A.comment(s0.id, 'aidlc-daemon live probe: comment by the agent app');
  const s3 = await L.issue(s0.id);
  const ca = s3.comments.find((x) => x.id === cA);
  out('agent comment author / botActor', `${ca.user?.id === ame.id ? 'AGENT APP' : ca.user?.name} / ${JSON.stringify(ca.botActor)}`);
  out('no agent Document left behind', !(await L.issue(s0.id)).documents.some((d) => /agent doc/.test(d.title)));
  out('revoke agent token', await acc.revoke(at.token));
  const dead = await A.viewer().then(() => 'STILL WORKS').catch((e) => `rejected (${e.message.slice(0, 60)})`);
  out('revoked token afterwards', dead);
  await dcc.revoke(dt.token);
}

