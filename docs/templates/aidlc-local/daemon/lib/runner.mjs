// The runner (plan §6): claim (delegate compare-and-set — moves NO state) → robot lane → `opencode run`
// with the phase prompt → wall-clock cap → evidence uploaded → lane torn down → delegate cleared.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { buildChildEnv, allSecretValues } from './secrets.mjs';
import { startProcess } from './proc.mjs';
import { redact, tail } from './util.mjs';

export const QUESTION_MARKER = /^\s*\*\*AIDLC question\*\*/i;

const CONTENT_TYPES = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp', '.txt': 'text/plain', '.log': 'text/plain', '.json': 'application/json', '.md': 'text/markdown', '.html': 'text/html' };

export class Runner {
  constructor({ cfg, linear, lanes, store, secrets, bot, now = () => Date.now(), onExit = () => {}, log = () => {} }) {
    Object.assign(this, { cfg, linear, lanes, store, secrets, bot, now, onExit, log });
    this.live = new Map();
  }

  get capacity() {
    return this.cfg.runner.maxConcurrent - this.live.size;
  }

  isLive(issueId) {
    return this.live.has(issueId);
  }

  /** The live run whose scope (its issue, parent, children) contains `issueId` — for the temporal fence. */
  runCovering(issueId) {
    for (const r of this.live.values()) if (r.scope.has(issueId)) return r;
    return null;
  }

  /** Claim = delegate compare-and-set. Re-read after the write; anyone else's delegate wins. */
  async claim(issueId) {
    const before = await this.linear.issue(issueId);
    if (before.delegate && before.delegate.id !== this.bot.id) return { ok: false, why: 'delegated to someone else' };
    if (!before.delegate) await this.linear.updateIssue(issueId, { delegateId: this.bot.id });
    const after = await this.linear.issue(issueId);
    if (after.delegate?.id !== this.bot.id) return { ok: false, why: 'lost the claim (delegate changed after our write)' };
    return { ok: true };
  }

  async releaseClaim(issueId) {
    const cur = await this.linear.issue(issueId);
    if (cur?.delegate?.id === this.bot.id) await this.linear.updateIssue(issueId, { delegateId: null });
  }

  slot() {
    const used = new Set([...this.live.values()].map((r) => r.slot));
    let s = 0;
    while (used.has(s)) s++;
    return s;
  }

  /**
   * Start a phase run. opts: { issue, rec, phase, laneSpec | reuseLane, buildPrompt(lane, ctx), sessionId?, scopeIds }
   * Returns { started: true, runId } or { started: false, why }.
   */
  async start(opts) {
    const { issue, rec, phase } = opts;
    if (this.live.has(issue.id)) return { started: false, why: 'a run is already live on this issue' };
    if (this.capacity < 1) return { started: false, why: 'at capacity', retry: true };
    const claim = await this.claim(issue.id);
    if (!claim.ok) return { started: false, why: claim.why };

    const runId = `${phase}-${new Date(this.now()).toISOString().replace(/[-:.TZ]/g, '').slice(0, 14)}-${Math.random().toString(36).slice(2, 6)}`;
    let lane;
    try {
      lane = opts.reuseLane && fs.existsSync(opts.reuseLane.path) ? opts.reuseLane : await this.lanes.create(`${issue.identifier}-${runId}`, opts.laneSpec);
    } catch (e) {
      await this.releaseClaim(issue.id);
      throw e;
    }
    const slot = this.slot();
    const portOffset = slot * this.cfg.lanes.portStride;
    const simDevice = phase === 'ship' ? this.createSimulator(runId) : null;
    const evidenceDir = path.join(lane.path, this.cfg.lanes.evidenceDir);
    fs.mkdirSync(evidenceDir, { recursive: true });

    // OpenCode v2.2.5 requires session IDs to start with "ses" (a bad ID errors, then the process hangs).
    // `--session` creates the session when it does not exist, so the daemon names it and can resume it.
    const sessionId = opts.sessionId || `ses_aidlc-${issue.identifier.toLowerCase()}-${runId}`;
    const ctx = { lane, portOffset, simDevice, evidenceDir: this.cfg.lanes.evidenceDir, sessionId };
    const prompt = opts.buildPrompt(lane, ctx);
    const model = `${this.cfg.modelProvider}/${this.cfg.models[phase]}`;
    const argv = [this.cfg.runner.command, ...this.cfg.runner.args, '--agent', this.cfg.runner.agent, '--model', model, '--session', sessionId, '--title', `AIDLC ${phase} ${issue.identifier}`, prompt];
    const env = buildChildEnv({
      secrets: this.secrets,
      passEnv: this.cfg.runner.passEnv,
      context: {
        AIDLC_ISSUE: issue.identifier,
        AIDLC_PHASE: phase,
        AIDLC_RUN_ID: runId,
        AIDLC_LANE: lane.path,
        AIDLC_PORT_OFFSET: portOffset,
        AIDLC_EVIDENCE_DIR: evidenceDir,
        AIDLC_SIM_DEVICE: simDevice,
      },
    });
    const logFile = this.store.runLog(issue.identifier, runId);
    fs.writeFileSync(logFile, `[aidlc-daemon] ${new Date(this.now()).toISOString()} ${phase} ${issue.identifier} lane=${lane.path} sha=${lane.sha} model=${model} session=${sessionId}\n`, { mode: 0o600 });
    const proc = startProcess({ argv, cwd: lane.path, env, logFile, timeoutMs: this.cfg.ms.caps[phase], killGraceMs: this.cfg.ms.killGrace, runAs: this.cfg.runner.runAs });

    const run = {
      runId,
      phase,
      issueId: issue.id,
      identifier: issue.identifier,
      scope: new Set(opts.scopeIds || [issue.id]),
      lane,
      slot,
      simDevice,
      sessionId,
      logFile,
      pid: proc.child.pid,
      startedAt: new Date(this.now()).toISOString(),
      proc,
    };
    this.live.set(issue.id, run);
    rec.run = { runId, phase, pid: run.pid, startedAt: run.startedAt, lane, sessionId, logFile, simDevice };
    this.store.event(issue.identifier, 'run.start', `${phase} started (${model}) in ${lane.path} @ ${lane.sha.slice(0, 10)}`, { runId, sessionId });
    run.finished = proc.done.then((r) => this.finalize(run, r)).catch((e) => this.log(`finalize ${issue.identifier}: ${e.stack || e}`));
    return { started: true, runId };
  }

  stop(issueId, reason) {
    const r = this.live.get(issueId);
    if (r) {
      r.stopReason = reason;
      r.proc.stop(reason);
    }
    return r;
  }

  async idle() {
    while (this.live.size) await Promise.all([...this.live.values()].map((r) => r.finished));
  }

  async finalize(run, r) {
    const issueId = run.issueId;
    let outcome = r.timedOut ? 'timeout' : r.stoppedFor ? 'stopped' : r.code === 0 ? 'ok' : 'failed';
    let question = null;
    try {
      const issue = await this.linear.issue(issueId);
      const seen = new Set(this.store.issue(issueId).questions || []);
      // Only a question this run posted: created during the run, by the bot, never one parked before.
      question =
        [...issue.comments]
          .reverse()
          .find((c) => c.user?.id === this.bot.id && !seen.has(c.id) && Date.parse(c.createdAt) >= Date.parse(run.startedAt) && QUESTION_MARKER.test(c.body)) || null;
      if (question) this.store.issue(issueId).questions = [...seen, question.id].slice(-50);
      if (question && outcome === 'ok') outcome = 'question';
    } catch (e) {
      this.log(`finalize ${run.identifier}: could not read issue: ${e.message}`);
    }

    const evidence = await this.collectEvidence(run).catch((e) => ({ links: [], error: e.message }));
    const logTail = redact(tail(fs.existsSync(run.logFile) ? fs.readFileSync(run.logFile, 'utf8') : '', 25), allSecretValues(this.secrets));
    const keepLane = outcome === 'question';
    const body = [
      `**AIDLC daemon** — \`${run.phase}\` run ${outcome === 'ok' ? 'ended' : outcome === 'question' ? 'parked on a question' : outcome}`,
      '',
      `- run \`${run.runId}\`, ${Math.round((this.now() - Date.parse(run.startedAt)) / 1000)}s, exit ${r.code ?? r.signal}${run.stopReason ? `, stopped: ${run.stopReason}` : ''}`,
      `- lane \`${run.lane.sha.slice(0, 10)}\`${run.lane.branch ? ` on \`${run.lane.branch}\`` : ''}${keepLane ? ' (kept for the resume)' : ' (removed)'}`,
      evidence.links.length ? `- evidence: ${evidence.links.join(' · ')}` : null,
      evidence.error ? `- evidence upload failed: ${evidence.error} (kept locally)` : null,
      '',
      '<details><summary>log tail</summary>',
      '',
      '```',
      logTail,
      '```',
      '</details>',
    ]
      .filter((x) => x !== null)
      .join('\n');
    await this.statusComment(issueId, body).catch((e) => this.log(`status comment ${run.identifier}: ${e.message}`));

    if (!keepLane) await this.lanes.remove(run.lane.path).catch((e) => this.log(`teardown ${run.lane.path}: ${e.message}`));
    if (run.simDevice && !keepLane) this.deleteSimulator(run.simDevice);
    await this.releaseClaim(issueId).catch((e) => this.log(`clear delegate ${run.identifier}: ${e.message}`));

    this.live.delete(issueId);
    const rec = this.store.issue(issueId);
    const result = {
      runId: run.runId,
      phase: run.phase,
      outcome,
      code: r.code,
      startedAt: run.startedAt,
      endedAt: new Date(this.now()).toISOString(),
      sessionId: run.sessionId,
      lane: keepLane ? run.lane : null,
      simDevice: keepLane ? run.simDevice : null,
      questionId: question?.id || null,
      questionAt: question?.createdAt || null,
    };
    rec.run = null;
    rec.lastRun = result;
    rec.exits.push(result);
    this.store.event(run.identifier, 'run.exit', `${run.phase} ${outcome}`, { runId: run.runId, code: r.code });
    this.store.save();
    await this.onExit(issueId, result);
  }

  /** One daemon status comment per issue, edited in place (no comment spam). */
  async statusComment(issueId, body) {
    const rec = this.store.issue(issueId);
    if (rec.statusCommentId) {
      try {
        await this.linear.editComment(rec.statusCommentId, body);
        return;
      } catch {
        /* deleted by a human: post a new one */
      }
    }
    rec.statusCommentId = await this.linear.comment(issueId, body);
  }

  /** Copy the lane's evidence dir to local state, then upload each file to Linear — before teardown. */
  async collectEvidence(run) {
    const src = path.join(run.lane.path, this.cfg.lanes.evidenceDir);
    if (!fs.existsSync(src)) return { links: [] };
    const files = fs
      .readdirSync(src)
      .filter((f) => fs.statSync(path.join(src, f)).isFile())
      .slice(0, this.cfg.lanes.maxEvidenceFiles);
    if (!files.length) return { links: [] };
    const dest = this.store.evidenceDir(run.identifier, run.runId);
    fs.mkdirSync(dest, { recursive: true, mode: 0o700 });
    const links = [];
    const errors = [];
    for (const f of files) {
      const full = path.join(src, f);
      fs.copyFileSync(full, path.join(dest, f));
      const bytes = fs.readFileSync(full);
      if (bytes.length > this.cfg.lanes.maxEvidenceBytes) {
        errors.push(`${f} too large`);
        continue;
      }
      const type = CONTENT_TYPES[path.extname(f).toLowerCase()] || 'application/octet-stream';
      const payload = type.startsWith('text/') ? Buffer.from(redact(bytes.toString('utf8'), allSecretValues(this.secrets))) : bytes;
      try {
        const url = await this.linear.upload(f, type, payload);
        links.push(type.startsWith('image/') ? `![${f}](${url})` : `[${f}](${url})`);
      } catch (e) {
        errors.push(`${f}: ${e.message}`);
      }
    }
    return { links, error: errors.length ? errors.join('; ') : null };
  }

  /** Ephemeral simulator per lane (macos-app surfaces): two lanes never share a device. */
  createSimulator(runId) {
    const { type, simulator } = this.cfg.surface;
    if (type !== 'macos-app' || !simulator.deviceType || !simulator.runtime) return null;
    try {
      return execFileSync('xcrun', ['simctl', 'create', `aidlc-${runId}`, simulator.deviceType, simulator.runtime], { encoding: 'utf8' }).trim();
    } catch (e) {
      this.log(`simctl create failed: ${e.message}`);
      return null;
    }
  }

  deleteSimulator(udid) {
    try {
      execFileSync('xcrun', ['simctl', 'delete', udid]);
    } catch (e) {
      this.log(`simctl delete ${udid}: ${e.message}`);
    }
  }
}
