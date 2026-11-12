// Local operational state: ~/.config/aidlc/<owner>/<repo>/ (plan §6). Operational only — never
// spec content. state.json is the persisted cursor, per-issue records, the daemon's own move log
// and per-SHA check results; events.log is an append-only JSONL feed for `aidlc tail`/`status`.
import fs from 'node:fs';
import path from 'node:path';
import { writeFileAtomic } from './util.mjs';

const MAX_PROCESSED = 400;
const MOVE_LOG_TTL_MS = 3 * 86400e3;

export class Store {
  constructor(dir, { now = () => Date.now() } = {}) {
    this.dir = dir;
    this.now = now;
    this.file = path.join(dir, 'state.json');
    this.eventsFile = path.join(dir, 'events.log');
    fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
    for (const d of ['runs', 'evidence', 'docs', 'requests']) fs.mkdirSync(path.join(dir, d), { recursive: true, mode: 0o700 });
    this.load();
  }

  load() {
    const empty = { version: 1, installedAt: null, cursor: null, issues: {}, authorizedMoves: [], knownSlices: {}, checks: {} };
    this.data = fs.existsSync(this.file) ? { ...empty, ...JSON.parse(fs.readFileSync(this.file, 'utf8')) } : empty;
    if (!this.data.installedAt) this.data.installedAt = new Date(this.now()).toISOString();
    if (!this.data.cursor) this.data.cursor = this.data.installedAt;
  }

  save() {
    const cutoff = this.now() - MOVE_LOG_TTL_MS;
    this.data.authorizedMoves = this.data.authorizedMoves.filter((m) => Date.parse(m.at) > cutoff);
    writeFileAtomic(this.file, JSON.stringify(this.data, null, 2));
  }

  issue(id, identifier) {
    let rec = this.data.issues[id];
    if (!rec) {
      rec = this.data.issues[id] = {
        id,
        identifier,
        firstSeen: new Date(this.now()).toISOString(),
        processed: [],
        deferred: [],
        exits: [],
        retries: {},
        run: null,
        lastRun: null,
        parked: null,
        paused: null,
        flags: [],
      };
    }
    if (identifier) rec.identifier = identifier;
    return rec;
  }

  findIssue(idOrIdentifier) {
    return Object.values(this.data.issues).find((r) => r.id === idOrIdentifier || r.identifier === idOrIdentifier) || null;
  }

  isProcessed(rec, eventId) {
    return rec.processed.includes(eventId);
  }

  markProcessed(rec, eventId) {
    if (rec.processed.includes(eventId)) return;
    rec.processed.push(eventId);
    if (rec.processed.length > MAX_PROCESSED) rec.processed.splice(0, rec.processed.length - MAX_PROCESSED);
  }

  /** Record that the daemon itself is about to make this move (before the mutation). */
  authorizeMove(issueId, toStateId, { silent = false, reason = '' } = {}) {
    const m = { issueId, toStateId, at: new Date(this.now()).toISOString(), silent, reason, consumed: false };
    this.data.authorizedMoves.push(m);
    return m;
  }

  /** Match a history entry made by the bot actor to one of the daemon's own moves. */
  consumeAuthorizedMove(issueId, toStateId, historyAt) {
    const t = Date.parse(historyAt);
    const m = this.data.authorizedMoves.find(
      (x) => !x.consumed && x.issueId === issueId && x.toStateId === toStateId && Date.parse(x.at) <= t + 120e3,
    );
    if (m) m.consumed = true;
    return m || null;
  }

  event(issue, type, msg, data) {
    const line = { at: new Date(this.now()).toISOString(), issue: issue || null, type, msg, ...(data ? { data } : {}) };
    fs.appendFileSync(this.eventsFile, JSON.stringify(line) + '\n', { mode: 0o600 });
    return line;
  }

  readEvents({ issue, limit = 50 } = {}) {
    if (!fs.existsSync(this.eventsFile)) return [];
    const lines = fs.readFileSync(this.eventsFile, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l));
    const filtered = issue ? lines.filter((e) => e.issue === issue) : lines;
    return filtered.slice(-limit);
  }

  runLog(identifier, runId) {
    const d = path.join(this.dir, 'runs', identifier);
    fs.mkdirSync(d, { recursive: true, mode: 0o700 });
    return path.join(d, `${runId}.log`);
  }

  evidenceDir(identifier, runId) {
    return path.join(this.dir, 'evidence', identifier, runId);
  }

  /** Local audit copy of the documents the daemon published for a run (the Document in Linear is the state). */
  docsDir(identifier, runId) {
    const d = path.join(this.dir, 'docs', identifier, runId);
    fs.mkdirSync(d, { recursive: true, mode: 0o700 });
    return d;
  }

  get pauseFile() {
    return path.join(this.dir, 'PAUSE');
  }

  isPaused() {
    return fs.existsSync(this.pauseFile);
  }

  /** CLI → daemon requests (gate confirm, reconcile, breaker reset), consumed on the next fast tick. */
  addRequest(req) {
    const f = path.join(this.dir, 'requests', `${Date.now()}-${process.pid}.json`);
    writeFileAtomic(f, JSON.stringify({ ...req, at: new Date(this.now()).toISOString() }));
    return f;
  }

  takeRequests() {
    const d = path.join(this.dir, 'requests');
    const out = [];
    for (const f of fs.readdirSync(d).filter((x) => x.endsWith('.json')).sort()) {
      try {
        out.push(JSON.parse(fs.readFileSync(path.join(d, f), 'utf8')));
      } catch {
        /* half-written: skip, it will be retried */
        continue;
      }
      fs.unlinkSync(path.join(d, f));
    }
    return out;
  }
}
