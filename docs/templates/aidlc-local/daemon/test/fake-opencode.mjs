#!/usr/bin/env node
// Stand-in for `opencode run` in the daemon tests. Records argv + env + cwd, then plays the next
// scripted step list for its phase from $FAKE_OC_DIR/script.json. Steps use only what a real agent
// has: its own env (the agent key), its lane, git.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const dir = process.env.FAKE_OC_DIR;
const phase = process.env.AIDLC_PHASE;
const issue = process.env.AIDLC_ISSUE;
fs.appendFileSync(path.join(dir, 'calls.jsonl'), JSON.stringify({ argv: process.argv.slice(2), env: process.env, cwd: process.cwd() }) + '\n');

const scriptFile = path.join(dir, 'script.json');
const script = fs.existsSync(scriptFile) ? JSON.parse(fs.readFileSync(scriptFile, 'utf8')) : {};
const queue = script[phase] || [];
const steps = queue.length ? queue.shift() : [];
fs.writeFileSync(scriptFile, JSON.stringify(script));

async function gql(op, query, variables, asKey) {
  const r = await fetch(process.env.FAKE_LINEAR_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: asKey || process.env.AIDLC_LINEAR_AGENT_KEY },
    body: JSON.stringify({ query: `mutation ${op} { x }`, variables, operationName: op }),
  });
  const b = await r.json();
  if (b.errors) throw new Error(b.errors[0].message);
  return b.data;
}
const git = (...a) => execFileSync('git', a, { cwd: process.cwd(), encoding: 'utf8' }).trim();

let code = 0;
for (const s of steps) {
  if (s.sleep) await new Promise((r) => setTimeout(r, s.sleep));
  if (s.comment) await gql('AidlcCommentCreate', '', { input: { issueId: s.issue || issue, body: s.comment } });
  // Decision B: the agent's own token is read + comments only, so a state move or Document write
  // with it is refused by Linear — non-fatal, like a real agent would log and move on. `as` plays
  // the backstop story: the run misuses a credential that does have write (a leaked daemon key).
  if (s.moveTo) {
    try {
      await gql('AidlcIssueUpdate', '', { id: s.issue || issue, input: { stateId: s.moveTo } }, s.as);
    } catch (e) {
      console.error(`fake opencode: Linear refused the state move (${e.message})`);
    }
  }
  if (s.document) {
    try {
      await gql('TestSaveDocument', '', { issue: s.issue || issue, ...s.document }, s.as);
    } catch (e) {
      console.error(`fake opencode: Linear refused the Document write (${e.message})`);
    }
  }
  // The Decision B way of producing a Document: a file the daemon publishes after the run.
  if (s.docFile) fs.writeFileSync(path.join(process.env.AIDLC_DOCS_DIR, s.docFile.file), s.docFile.content);
  if (s.evidence) fs.writeFileSync(path.join(process.env.AIDLC_EVIDENCE_DIR, s.evidence.name), s.evidence.content);
  if (s.commit) {
    fs.writeFileSync(s.commit.file, s.commit.content);
    git('add', s.commit.file);
    git('-c', 'user.name=bot', '-c', 'user.email=bot@example.invalid', 'commit', '-qm', s.commit.message || `${issue} work`);
    git('push', '-q', 'origin', `HEAD:refs/heads/${git('rev-parse', '--abbrev-ref', 'HEAD')}`);
  }
  if (s.print) console.log(s.print);
  if (s.printEnv) console.log(`${s.printEnv}=${process.env[s.printEnv]}`);
  if (s.exit !== undefined) code = s.exit;
}
console.log(`fake opencode ${phase} ${issue} done`);
process.exit(code);
