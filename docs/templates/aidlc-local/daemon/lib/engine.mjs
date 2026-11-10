// The event loop (plan §4, §6). Observe Linear + GitHub → validate every state move (actor check,
// revert, temporal fence) → derive events → run the matching transitions.json rows.
//
// Invariants enforced here, in code (not in the transitions file):
//   - only human-actor moves are gates; bot-actor moves the daemon did not make are reverted + flagged;
//   - the daemon never moves a Feature into a gate state (MACHINE_FORBIDDEN);
//   - the umbrella Feature never builds; slices exist only after the human's Build+Test gate;
//   - agents never move state — the daemon is the only machine actor.
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { STATE_KEYS } from './config.mjs';
import { Checks } from './checks.mjs';
import { GitHub } from './github.mjs';
import { Lanes } from './lanes.mjs';
import { renderPrompt, resumePrompt } from './prompts.mjs';
import { runShell } from './proc.mjs';
import { Runner } from './runner.mjs';
import { buildChildEnv, secretProblems } from './secrets.mjs';
import { SlicePlanError, backlogStateId, createSlices, markerKey } from './slices.mjs';
import { MACHINE_FORBIDDEN, match } from './transitions.mjs';
import { slugify, tail } from './util.mjs';

const ACTIVE_SLICE = ['build', 'review', 'staging'];
const TERMINAL = ['done', 'canceled'];
const BOUNCE_FROM = ['review', 'staging', 'ship', 'done'];
const PHASE_FOR_STATE = { plan: 'plan', design: 'design', build: 'build', review: 'review', staging: 'ship', ship: 'learn' };
const DEFAULT_LANE = { plan: 'base', design: 'base', build: 'branch', review: 'pr-head', ship: 'merged-main', learn: 'merged-main' };

const MESSAGES = {
  'review-skipped': 'the PR was merged straight from **Build+Test**: Review was skipped. Recorded (your call to make); continuing to **In Staging**.',
};

export class Engine {
  constructor({ cfg, transitions, linear, github, store, secrets, lanes, now = () => Date.now(), log = console.error }) {
    Object.assign(this, { cfg, transitions, linear, store, secrets, now, log });
    this.github = github || new GitHub({ nwo: cfg.repo.nwo, token: secrets.daemon.AIDLC_GH_READ_TOKEN });
    this.lanes = lanes || new Lanes(cfg);
    this.ticking = false;
  }

  async init() {
    this.bot = await this.linear.viewer();
    this.team = await this.linear.team(this.cfg.linear.team);
    this.stateIdByKey = {};
    this.stateKeyById = {};
    for (const key of STATE_KEYS) {
      let id = null;
      if (key === 'backlog') id = backlogStateId(this.team, this.cfg);
      else id = this.team.states.find((s) => s.name === this.cfg.states[key])?.id || null;
      if (!id && !['triage', 'canceled'].includes(key)) throw new Error(`team ${this.team.key} has no state "${this.cfg.states[key]}" (states.${key})`);
      if (id) {
        this.stateIdByKey[key] = id;
        this.stateKeyById[id] = key;
      }
    }
    this.needsHumanLabel = await this.linear.labelId(this.cfg.labels.needsHuman, this.team.id);
    if (!this.needsHumanLabel) throw new Error(`no "${this.cfg.labels.needsHuman}" label in Linear — create it (ASK-AND-HALT parking label)`);
    this.flagLabel = this.cfg.labels.flag ? await this.linear.labelId(this.cfg.labels.flag, this.team.id) : null;
    this.runner = new Runner({
      cfg: this.cfg,
      linear: this.linear,
      lanes: this.lanes,
      store: this.store,
      secrets: this.secrets,
      bot: this.bot,
      now: this.now,
      log: this.log,
      onExit: () => {},
    });
    this.checks = new Checks({ cfg: this.cfg, github: this.github, lanes: this.lanes, store: this.store, secrets: this.secrets, now: this.now });
    return this;
  }

  // ---------------------------------------------------------------- ticks

  /** full = eligible-work cadence (cursor + active states); otherwise the 30s parked/live cadence. */
  async tick({ full = false } = {}) {
    if (this.ticking) {
      this.again = this.again || (full ? 'full' : 'fast');
      return;
    }
    this.ticking = true;
    try {
      const started = this.now();
      for (const req of this.store.takeRequests()) await this.handleRequest(req).catch((e) => this.log(`request ${req.cmd}: ${e.message}`));
      const ids = new Set(this.tracked());
      if (full) {
        const since = new Date(Date.parse(this.store.data.cursor) - this.cfg.ms.overlap).toISOString();
        for (const i of await this.linear.changedIssues(this.team.key, since)) ids.add(i.id);
        for (const c of await this.linear.changedComments(this.team.key, since)) if (c.issue) ids.add(c.issue.id);
        const active = ['build', 'review', 'staging', 'ship'].map((k) => this.cfg.states[k]);
        for (const i of await this.linear.issuesInStates(this.team.key, active)) ids.add(i.id);
      }
      for (const id of ids) {
        try {
          await this.processIssue(id);
        } catch (e) {
          this.log(`process ${this.store.data.issues[id]?.identifier || id}: ${e.stack || e.message}`);
          this.store.event(this.store.data.issues[id]?.identifier, 'error', e.message);
        }
      }
      if (full) this.store.data.cursor = new Date(started).toISOString();
      this.store.save();
    } finally {
      this.ticking = false;
    }
    if (this.again) {
      const mode = this.again;
      this.again = null;
      await this.tick({ full: mode === 'full' });
    }
  }

  tracked() {
    const out = [];
    for (const r of Object.values(this.store.data.issues)) {
      if (r.closed) continue;
      if (r.run || r.parked || r.paused || r.deferred.length || r.exits.length) out.push(r.id);
    }
    for (const run of this.runner.live.values()) out.push(...run.scope);
    return out;
  }

  // ---------------------------------------------------------------- observation

  stateKeyOf(issue) {
    return this.stateKeyById[issue.state.id] || null;
  }

  kindOf(issue, rec) {
    if (issue.team.id !== this.team.id) return 'other';
    if (issue.parent) {
      if (this.store.data.knownSlices[issue.id]) return 'slice';
      return 'other';
    }
    return rec.unit ? 'unit' : 'feature';
  }

  classify(entry) {
    if (entry.botActor) return 'foreign';
    if (!entry.actor) return 'foreign';
    if (entry.actor.id === this.bot.id) return 'bot';
    const humans = this.cfg.gates.humans;
    if (humans.length && !humans.includes(entry.actor.id)) return 'foreign';
    return 'human';
  }

  isHumanComment(c) {
    if (!c.user || c.botActor || c.user.id === this.bot.id) return false;
    const humans = this.cfg.gates.humans;
    return !humans.length || humans.includes(c.user.id);
  }

  baseline(rec) {
    return Date.parse(rec.baseline || this.store.data.reconcileSince || this.store.data.installedAt);
  }

  async processIssue(id) {
    const issue = await this.linear.issue(id);
    if (!issue) return;
    const rec = this.store.issue(issue.id, issue.identifier);
    const kind = this.kindOf(issue, rec);
    rec.kind = kind;
    Object.assign(rec, { state: issue.state.name, title: issue.title, parent: issue.parent?.identifier || null, seenAt: new Date(this.now()).toISOString() });
    if (kind === 'other' && issue.parent) {
      const k = markerKey(issue.description, issue.parent.identifier);
      if (k) await this.flagOnce(issue, rec, 'unknown-slice', `${issue.identifier} carries the slice marker \`${issue.parent.identifier}/${k}\` but the daemon did not create it, so it is **not** treated as a slice and will not be dispatched. Slices are created only after the human's Build+Test gate. If you made it with \`aidlc-slices.sh\`, run \`aidlc slices ${issue.parent.identifier} --adopt\`.`);
    }
    if (kind === 'other' || rec.closed) return;
    const baseline = this.baseline(rec);

    // 1. Every state move gets an actor check — even while paused (an agent could keep moving).
    const changes = issue.history.filter((h) => h.toStateId && h.fromStateId !== h.toStateId);
    const latest = changes[changes.length - 1];
    for (const h of changes) {
      if (this.store.isProcessed(rec, h.id)) continue;
      if (Date.parse(h.createdAt) < baseline) {
        this.store.markProcessed(rec, h.id);
        continue;
      }
      const r = await this.onStateChange(issue, rec, kind, h, h === latest);
      if (r === 'hold') continue; // paused: leave it for after `aidlc gate confirm`
      this.store.markProcessed(rec, h.id);
    }
    if (rec.paused) return;

    // 2. Run exits (built-ins: park, retry), then run.exited rows.
    while (rec.exits.length) await this.onRunExit(issue, rec, kind, rec.exits.shift());

    // 3. Deferred events whose time has come (capacity, pending checks, retry backoff, global pause).
    const due = rec.deferred.filter((d) => !d.notBefore || Date.parse(d.notBefore) <= this.now());
    rec.deferred = rec.deferred.filter((d) => !due.includes(d));
    for (const d of due) {
      if (d.stateKey && d.stateKey !== this.stateKeyOf(issue)) {
        this.store.event(issue.identifier, 'drop', `deferred ${d.ev.type} dropped: issue left ${d.stateKey}`);
        continue;
      }
      try {
        await this.emit(issue, rec, this.kindOf(issue, rec), d.ev);
      } catch (e) {
        rec.deferred.push({ ...d, why: `error: ${e.message}`, notBefore: new Date(this.now() + 300e3).toISOString() });
        throw e;
      }
    }

    // 4. Comments: answer to a parked question, or resume of an ended run.
    if (rec.parked && this.cfg.ms.park && this.now() - Date.parse(rec.parked.since) > this.cfg.ms.park) await this.parkExpired(issue, rec);
    for (const c of issue.comments) {
      if (this.store.isProcessed(rec, c.id)) continue;
      if (Date.parse(c.createdAt) < baseline || !this.isHumanComment(c)) {
        this.store.markProcessed(rec, c.id);
        continue;
      }
      if (this.runner.isLive(issue.id)) break; // the comment waits for the run to end
      if (rec.parked) {
        if (Date.parse(c.createdAt) > Date.parse(rec.parked.questionAt)) {
          this.store.markProcessed(rec, c.id);
          await this.emit(issue, rec, kind, { type: 'answer', id: c.id, comment: c.body });
          continue;
        }
      } else if (rec.lastRun && Date.parse(c.createdAt) > Date.parse(rec.lastRun.startedAt)) {
        this.store.markProcessed(rec, c.id);
        await this.emit(issue, rec, kind, { type: 'comment', id: c.id, comment: c.body });
        continue;
      }
      this.store.markProcessed(rec, c.id);
    }

    // 5. GitHub: PR ready / merged for slices (and 1-slice units).
    const sk = this.stateKeyOf(issue);
    if ((kind === 'slice' || kind === 'unit') && ['build', 'review'].includes(sk) && rec.branch && !this.runner.isLive(issue.id) && !rec.parked) {
      const pr = await this.github.findPr(rec.branch);
      if (pr) {
        rec.pr = { number: pr.number, url: pr.url };
        if (pr.state === 'MERGED') {
          const ev = { type: 'pr.merged', id: `pr:${pr.number}:merged`, pr };
          if (!this.store.isProcessed(rec, ev.id)) {
            if (this.cfg.github?.botLogin && pr.mergedBy === this.cfg.github.botLogin && rec.acceptedBotMerge !== pr.number) {
              // Not marked processed: after `aidlc gate confirm` (the human accepts the merge) it advances.
              await this.pause(issue, rec, { kind: 'bot-merge', prNumber: pr.number });
              await this.flagOnce(issue, rec, `botmerge:${pr.number}`, `PR #${pr.number} was merged by the **bot account** (${pr.mergedBy}). Self-merge must be impossible (branch protection: required human review). Not advancing; issue paused. Fix branch protection, review the merge, then \`aidlc gate confirm ${issue.identifier}\` to accept it.`);
            } else {
              this.store.markProcessed(rec, ev.id);
              await this.emit(issue, rec, kind, ev);
            }
          }
        } else if (pr.state === 'OPEN' && !pr.isDraft && sk === 'build' && rec.lastRun?.phase === 'build' && rec.lastRun.outcome === 'ok') {
          const ev = { type: 'pr.ready', id: `pr:${pr.number}:ready:${rec.lastRun.runId}`, pr };
          if (!this.store.isProcessed(rec, ev.id)) {
            this.store.markProcessed(rec, ev.id);
            await this.emit(issue, rec, kind, ev);
          }
        }
      }
    }
  }

  // ---------------------------------------------------------------- gate validation (plan §3)

  async onStateChange(issue, rec, kind, h, isLatest) {
    const fromKey = this.stateKeyById[h.fromStateId] || null;
    const toKey = this.stateKeyById[h.toStateId] || null;
    const who = this.classify(h);
    if (who === 'bot') {
      if (this.store.consumeAuthorizedMove(issue.id, h.toStateId, h.createdAt)) return 'done';
      await this.unauthorized(issue, rec, h, 'bot');
      return 'done';
    }
    if (who === 'foreign' && toKey === 'canceled') {
      // Canceled is never a gate (e.g. Linear's auto-close): recorded, not reverted.
      await this.flagOnce(issue, rec, `foreign-cancel:${h.id}`, `moved to **${this.stateName(h.toStateId)}** by ${h.botActor ? `an integration (${h.botActor.name || h.botActor.type})` : 'a non-human actor'}. Canceled is not a gate, so this stands; the daemon stops working this issue.`);
      if (isLatest && issue.state.id === h.toStateId) await this.emit(issue, rec, kind, { type: 'enter', id: h.id, from: fromKey });
      return 'done';
    }
    if (who === 'foreign') {
      await this.unauthorized(issue, rec, h, 'foreign');
      return 'done';
    }
    // Human. Tier 2 temporal fence: a move observed while a run covering this issue is alive.
    const covering = this.runner.runCovering(issue.id);
    if (covering && this.cfg.gates.fence && Date.parse(h.createdAt) >= Date.parse(covering.startedAt) - 1000) {
      await this.fence(issue, rec, h, covering);
      return 'done';
    }
    if (rec.paused) return 'hold';
    if (rec.parked) await this.unpark(issue, rec, 'a human changed the state');
    if (isLatest && issue.state.id === h.toStateId) {
      this.store.event(issue.identifier, 'gate', `${fromKey ?? '?'} → ${toKey ?? issue.state.name} by ${h.actor.name}`);
      await this.emit(issue, rec, kind, { type: 'enter', id: h.id, actor: 'human', from: fromKey });
    }
    return 'done';
  }

  async unauthorized(issue, rec, h, who) {
    const covering = this.runner.runCovering(issue.id);
    if (covering) this.runner.stop(covering.issueId, 'unauthorized state move');
    const reverted = await this.revert(issue, h);
    const actor = who === 'bot' ? `the bot member (${this.bot.name}) — not by the daemon` : h.botActor ? `an integration (${h.botActor.name || h.botActor.type})` : 'an unknown actor';
    await this.pause(issue, rec, { kind: who === 'bot' ? 'unauthorized' : 'foreign', historyId: h.id, from: h.fromStateId, to: h.toStateId, stoppedRun: covering?.issueId || null });
    await this.flag(
      issue,
      `**Unauthorized state move ${reverted ? 'reverted' : 'detected'}**: ${this.stateName(h.fromStateId)} → ${this.stateName(h.toStateId)} at ${h.createdAt}, made by ${actor}. Only a human's move is a gate; machine moves are the daemon's alone.${covering ? ` The live \`${covering.phase}\` run on ${covering.identifier} was stopped.` : ''}${who === 'bot' ? ' If an agent did this, revoke the agent key.' : ' If this is Linear\'s GitHub automation, turn it off for this team — the daemon makes those moves after verifying them.'}\n\nThe issue is paused. \`aidlc gate confirm ${issue.identifier}\` resumes dispatch (it does not re-apply this move).`,
    );
  }

  async fence(issue, rec, h, covering) {
    this.runner.stop(covering.issueId, `temporal fence: ${issue.identifier} moved during the run`);
    const reverted = await this.revert(issue, h);
    await this.pause(issue, rec, { kind: 'fence', historyId: h.id, from: h.fromStateId, to: h.toStateId, actorId: h.actor.id, stoppedRun: covering.issueId });
    if (covering.issueId !== issue.id) {
      const crec = this.store.issue(covering.issueId);
      crec.fenceStopped = { by: issue.id, at: new Date(this.now()).toISOString() };
    }
    await this.flag(
      issue,
      `**Temporal fence**: ${this.stateName(h.fromStateId)} → ${this.stateName(h.toStateId)} by ${h.actor.name} at ${h.createdAt} while a \`${covering.phase}\` run was live on ${covering.identifier}. A gate cannot be taken while an agent is working the issue, so the run was stopped and the move ${reverted ? 'reverted' : 'flagged'}.\n\nIf you made this move, run \`aidlc gate confirm ${issue.identifier}\`: the daemon re-applies your move as a confirmed gate.`,
    );
  }

  async revert(issue, h) {
    if (issue.state.id !== h.toStateId) return false;
    await this.machineMove(issue, this.stateKeyById[h.fromStateId], { silent: true, stateId: h.fromStateId, reason: 'revert' });
    return true;
  }

  async pause(issue, rec, info) {
    rec.paused = { ...info, at: new Date(this.now()).toISOString() };
    this.store.event(issue.identifier, 'pause', `paused (${info.kind})`, info);
  }

  async confirmGate(idOrIdentifier) {
    const rec = this.store.findIssue(idOrIdentifier);
    if (!rec?.paused) return `${idOrIdentifier}: not paused`;
    const p = rec.paused;
    const issue = await this.linear.issue(rec.id);
    rec.paused = null;
    let note = 'dispatch resumed';
    if (p.kind === 'bot-merge') {
      rec.acceptedBotMerge = p.prNumber;
      note = `bot merge of PR #${p.prNumber} accepted by a human`;
    }
    if (p.kind === 'fence' && p.to && issue.state.id === p.from) {
      // The reverted move was made by a human (Linear's history says so); restore it as a confirmed gate.
      this.store.markProcessed(rec, p.historyId);
      await this.machineMove(issue, this.stateKeyById[p.to], { stateId: p.to, reason: 'gate confirm', actor: 'human', eventId: `confirm:${p.historyId}` });
      note = `re-applied ${this.stateName(p.from)} → ${this.stateName(p.to)} as a confirmed gate`;
    }
    // Re-dispatch the run the fence/revert stopped — unless the confirmed move itself moved that issue on.
    if (p.stoppedRun && !(p.kind === 'fence' && p.stoppedRun === rec.id)) {
      const srec = this.store.issue(p.stoppedRun);
      if (srec.lastDispatch) srec.deferred.push({ ev: { ...srec.lastDispatch.ev, id: `${srec.lastDispatch.ev.id}:confirm` }, stateKey: srec.lastDispatch.stateKey });
    }
    this.store.event(issue.identifier, 'confirm', note);
    this.store.save();
    return `${issue.identifier}: ${note}`;
  }

  // ---------------------------------------------------------------- transitions

  async emit(issue, rec, kind, ev) {
    const state = this.stateKeyOf(issue);
    const rows = match(this.transitions, { kind, state, event: ev.type, actor: ev.actor, from: ev.from, outcome: ev.outcome });
    if (!rows.length) {
      this.store.event(issue.identifier, 'event', `${kind}/${state}/${ev.type}${ev.actor ? `/${ev.actor}` : ''}: no transition`);
      return 'ok';
    }
    if (this.store.isPaused()) return this.defer(issue, rec, ev, 'daemon paused (PAUSE file)');
    this.store.event(issue.identifier, 'event', `${kind}/${state}/${ev.type}${ev.actor ? `/${ev.actor}` : ''}${ev.from ? ` from ${ev.from}` : ''}`);
    const ctx = { ev };
    for (const row of rows) {
      for (const action of row.do) {
        const res = await this.act(issue, rec, kind, ev, action, ctx);
        if (res === 'defer') return 'defer';
        if (res === 'stop') return 'ok';
      }
    }
    return 'ok';
  }

  defer(issue, rec, ev, why, delayMs = 0) {
    if (!rec.deferred.some((d) => d.ev.id === ev.id)) {
      rec.deferred.push({ ev, stateKey: this.stateKeyOf(issue), why, notBefore: delayMs ? new Date(this.now() + delayMs).toISOString() : null });
      this.store.event(issue.identifier, 'defer', `${ev.type}: ${why}`);
    }
    return 'defer';
  }

  async act(issue, rec, kind, ev, a, ctx) {
    if ('dispatch' in a) return this.dispatch(issue, rec, kind, ev, a.dispatch, a.lane || DEFAULT_LANE[a.dispatch], ctx);
    if ('resume' in a) return a.resume === 'session' ? this.resumeSession(issue, rec, kind, ev) : this.resumeFresh(issue, rec, kind, ev, ctx);
    if ('move' in a) return this.move(issue, rec, kind, a.move);
    if ('verifyChecks' in a) return this.verifyChecks(issue, rec, kind, ev, a.verifyChecks, a.require || 'green', ctx);
    if ('createSlices' in a) return this.createSlicesAction(issue, rec, ev);
    if ('releaseNext' in a) return this.releaseNext(issue, kind);
    if ('validateSlice' in a) return this.validateSlice(issue, rec, ctx);
    if ('bounce' in a) return this.bounce(issue, rec, ev, ctx);
    if ('requireScorecard' in a) return this.requireScorecard(issue, rec);
    if ('learnGate' in a) return this.learnGate(issue, rec, kind, ev, ctx);
    if ('flag' in a) {
      await this.flagOnce(issue, rec, `${ev.id}:${a.flag}`, MESSAGES[a.flag] || a.flag);
      return 'ok';
    }
    if ('comment' in a) {
      await this.linear.comment(issue.id, MESSAGES[a.comment] || a.comment);
      return 'ok';
    }
    if ('cleanup' in a) return this.cleanup(issue, rec);
    throw new Error(`unknown action ${JSON.stringify(a)}`);
  }

  // ---------------------------------------------------------------- machine moves

  /** The only code path that moves state. Ceiling rule enforced here, whatever the transitions file says. */
  async machineMove(issue, toKey, { silent = false, stateId = null, reason = '', actor = 'daemon', eventId = null, release = false } = {}) {
    const kind = this.store.data.issues[issue.id]?.kind || 'feature';
    const target = stateId || this.stateIdByKey[toKey];
    if (!target) throw new Error(`no state for ${toKey}`);
    if (reason !== 'revert' && reason !== 'gate confirm' && !(release && kind === 'slice' && toKey === 'build') && MACHINE_FORBIDDEN[kind]?.includes(toKey)) {
      await this.flag(issue, `Ceiling rule: refused to move ${issue.identifier} (${kind}) into **${this.cfg.states[toKey]}** — that is a human gate. Check transitions.json.`);
      return 'stop';
    }
    if (issue.state.id === target) return 'ok';
    const from = this.stateKeyOf(issue);
    this.store.authorizeMove(issue.id, target, { silent, reason });
    this.store.save(); // the authorization must outlive a crash between the write and the next poll
    const updated = await this.linear.updateIssue(issue.id, { stateId: target });
    issue.state = { ...issue.state, ...updated.state, id: target };
    this.store.event(issue.identifier, 'move', `${from ?? '?'} → ${toKey ?? updated.state.name}${reason ? ` (${reason})` : ''}`);
    if (silent) return 'ok';
    const rec = this.store.issue(issue.id);
    const ev = { type: 'enter', id: eventId || `move:${issue.id}:${target}:${this.now()}`, actor, from };
    await this.emit(issue, rec, this.kindOf(issue, rec), ev);
    return 'ok';
  }

  async move(issue, rec, kind, toKey) {
    if (this.stateKeyOf(issue) === toKey) return 'ok';
    const r = await this.machineMove(issue, toKey);
    return r === 'stop' ? 'stop' : 'stop'; // the synthetic enter event already ran the next rows
  }

  // ---------------------------------------------------------------- dispatch

  async dispatch(issue, rec, kind, ev, phase, lane, ctx, extra = {}) {
    if (phase === 'build' && kind === 'feature') {
      await this.flag(issue, `Refused to build ${issue.identifier}: an umbrella Feature never builds; its slices do.`);
      return 'stop';
    }
    if (rec.parked && !extra.sessionId) return 'stop';
    if (this.runner.isLive(issue.id)) return this.defer(issue, rec, ev, 'a run is live on this issue');
    rec.dispatched = rec.dispatched || {};
    if (ev.type === 'comment' && !ctx.resumeComment) ctx.resumeComment = ev.comment;
    if (rec.dispatched[ev.id] && !extra.sessionId) return 'ok';
    if (rec.retryAfter && Date.parse(rec.retryAfter) > this.now()) return this.defer(issue, rec, ev, `retry backoff until ${rec.retryAfter}`, Date.parse(rec.retryAfter) - this.now());
    if (this.runner.capacity < 1) return this.defer(issue, rec, ev, 'runner at capacity');
    const secretErrs = secretProblems(this.secrets);
    if (secretErrs.length) {
      await this.flagOnce(issue, rec, 'secrets', `Not dispatching: ${secretErrs.join('; ')}`);
      return 'stop';
    }

    const prep = extra.reuseLane ? { laneSpec: null, vars: extra.vars || {} } : await this.prepare(issue, rec, kind, phase, lane, ctx);
    if (prep === 'defer') return this.defer(issue, rec, ev, `${lane} lane not ready`, 60e3);
    if (prep === 'stop') return 'stop';
    const parent = issue.parent ? issue.parent.identifier : null;
    const scopeIds = [issue.id, ...(issue.parent ? [issue.parent.id] : []), ...issue.children.map((c) => c.id)];
    const res = await this.runner.start({
      issue,
      rec,
      phase,
      laneSpec: prep.laneSpec,
      reuseLane: extra.reuseLane,
      sessionId: extra.sessionId,
      scopeIds,
      buildPrompt: (laneInfo, rctx) =>
        extra.prompt ||
        renderPrompt(this.cfg.configDir, phase, {
          identifier: issue.identifier,
          title: issue.title,
          featureLine: parent ? ` (slice of ${parent})` : '',
          lanePath: laneInfo.path,
          laneLine: laneInfo.branch ? `branch \`${laneInfo.branch}\` at \`${laneInfo.sha.slice(0, 10)}\`` : `detached at \`${laneInfo.sha}\``,
          laneSha: laneInfo.sha,
          portOffset: rctx.portOffset,
          evidenceDir: rctx.evidenceDir,
          ownerMention: this.cfg.owner.mention || 'the assignee',
          ...prep.vars,
        }),
    });
    if (!res.started) {
      if (res.retry) return this.defer(issue, rec, ev, res.why);
      this.store.event(issue.identifier, 'claim', `not dispatched: ${res.why}`);
      return 'stop';
    }
    rec.dispatched[ev.id] = res.runId;
    rec.lastDispatch = { ev, phase, lane, stateKey: this.stateKeyOf(issue) };
    return 'ok';
  }

  /** Lane spec + phase prompt variables. */
  async prepare(issue, rec, kind, phase, lane, ctx) {
    await this.lanes.fetch();
    const base = await this.lanes.baseHead();
    const vars = { resumeBlock: ctx.resumeComment ? `\n### The human's new comment (why this run was re-dispatched)\n\n> ${ctx.resumeComment.split('\n').join('\n> ')}\n` : '' };
    let laneSpec = { sha: base };
    if (lane === 'branch') {
      rec.branch = rec.branch || `${issue.identifier.toLowerCase()}-${slugify(issue.title, 30)}`;
      laneSpec = { branch: rec.branch, startSha: base };
      vars.branch = rec.branch;
      const bounceLines = [];
      if (ctx.bounce) bounceLines.push(`**This is bounce ${ctx.bounce} of ${this.cfg.breaker.bounces}** (the breaker trips at ${this.cfg.breaker.bounces}). The branch and PR already exist — continue on them and resolve every review thread.`);
      if (rec.pr?.number && ctx.bounce) {
        const findings = await this.github.reviewFindings(rec.pr.number).catch(() => []);
        if (findings.length) bounceLines.push('Review findings on the PR:\n\n' + findings.map((f) => tail(f, 60)).join('\n\n---\n\n'));
      }
      if (rec.lastFailure && ctx.bounce) bounceLines.push(`Last failure the daemon recorded: ${rec.lastFailure}`);
      vars.bounceBlock = bounceLines.join('\n\n');
    } else if (lane === 'pr-head' || lane === 'merge-sha') {
      const pr = rec.branch ? await this.github.findPr(rec.branch) : null;
      if (!pr) return 'defer';
      if (lane === 'pr-head') {
        if (pr.state !== 'OPEN') return 'stop';
        laneSpec = { sha: pr.headSha, prNumber: pr.number };
        const chk = ctx.checks || this.store.data.checks[`${pr.headSha}:${this.cfg.ci.mode}`];
        Object.assign(vars, {
          prNumber: pr.number,
          prUrl: pr.url,
          baseSha: pr.baseSha,
          headSha: pr.headSha,
          checkStatus: chk?.status?.toUpperCase() || 'NOT VERIFIED',
          checkSummary: chk?.summary || 'the daemon has no result for this SHA',
          tamperLine: chk?.tampered?.length ? `- **Check definitions changed in this PR** (${chk.tampered.join(', ')}): blocking DevOps finding, a human decides (invariant §2.7).` : '',
          concurrency: this.cfg.review.concurrency > 1 ? `up to ${this.cfg.review.concurrency} in parallel` : 'one at a time (sequential)',
        });
      } else {
        if (!pr.mergeSha) return 'defer';
        laneSpec = { sha: pr.mergeSha };
      }
    }
    if (phase === 'ship') {
      const sha = laneSpec.sha;
      const chk = ctx.checks || this.store.data.checks[`${sha}:${this.cfg.ci.mode}`];
      Object.assign(vars, {
        surface: this.cfg.surface.type,
        checkStatus: chk?.status?.toUpperCase() || 'NOT VERIFIED',
        checkSummary: chk?.summary || 'the daemon has no result for this SHA',
        surfaceLine: this.cfg.surface.type === 'macos-app' ? '- Your simulator device is `$AIDLC_SIM_DEVICE` (created for this lane; deleted at teardown). Never use another device.' : this.cfg.surface.type === 'web' ? '- Start the stack on ports offset by `$AIDLC_PORT_OFFSET` so concurrent lanes never collide.' : '',
      });
    }
    if (phase === 'learn') {
      vars.learnBranch = `${issue.identifier.toLowerCase()}-learn`;
      const s = rec.scorecard;
      vars.scorecardLine = s ? `${s.passed}/${s.total} passed (${Math.round(s.score * 100)}%), ${s.humanPending} human-pending${s.humanPending && ctx.ev?.type === 'comment' ? ' — the human-pending rows were confirmed by the human comment below' : ''}` : 'not parsed by the daemon';
    }
    return { laneSpec, vars };
  }

  async resumeSession(issue, rec, kind, ev) {
    const p = rec.parked;
    if (!p) return 'stop';
    if (this.runner.isLive(issue.id)) return this.defer(issue, rec, ev, 'a run is live on this issue');
    if (!p.lane?.path || !fs.existsSync(p.lane.path)) {
      await this.unpark(issue, rec, 'parked lane is gone');
      await this.flag(issue, `Your answer arrived, but the parked \`${p.phase}\` lane is gone, so the session cannot resume. Move the issue (or comment again after a fresh run) to re-run the phase.`);
      return 'stop';
    }
    if (this.runner.capacity < 1) return this.defer(issue, rec, ev, 'runner at capacity');
    await this.linear.removeLabel(issue.id, this.needsHumanLabel).catch(() => {});
    const res = await this.dispatch(issue, rec, kind, ev, p.phase, null, {}, {
      sessionId: p.sessionId,
      reuseLane: p.lane,
      prompt: resumePrompt(ev.comment, this.cfg.owner.mention || 'the assignee'),
    });
    if (res === 'ok') {
      rec.parked = null;
      this.store.event(issue.identifier, 'resume', `answer received; resumed session ${p.sessionId}`);
    }
    return res;
  }

  async resumeFresh(issue, rec, kind, ev, ctx) {
    if (!rec.lastRun || this.runner.isLive(issue.id) || rec.parked) return 'stop';
    const phase = PHASE_FOR_STATE[this.stateKeyOf(issue)];
    if (!phase) return 'stop';
    ctx.resumeComment = ev.comment;
    const lane = kind === 'unit' && phase === 'ship' ? 'merge-sha' : DEFAULT_LANE[phase];
    this.store.event(issue.identifier, 'resume', `human comment after the ${rec.lastRun.phase} run ended → re-dispatch ${phase}`);
    return this.dispatch(issue, rec, kind, ev, phase, lane, ctx);
  }

  async onRunExit(issue, rec, kind, r) {
    if (r.outcome === 'question') {
      await this.linear.addLabel(issue.id, this.needsHumanLabel);
      rec.parked = { phase: r.phase, sessionId: r.sessionId, lane: r.lane, simDevice: r.simDevice, questionId: r.questionId, questionAt: r.questionAt, since: r.endedAt };
      this.store.event(issue.identifier, 'park', `${r.phase} parked on a question (needs-a-human); session ${r.sessionId} kept`);
      return;
    }
    if (r.outcome === 'stopped') return;
    if (r.outcome === 'failed' || r.outcome === 'timeout') {
      const n = (rec.retries[r.phase] || 0) + 1;
      rec.retries[r.phase] = n;
      rec.lastFailure = `${r.phase} ${r.outcome} (exit ${r.code})`;
      if (n <= this.cfg.runner.retries && rec.lastDispatch) {
        const wait = this.cfg.ms.backoff * 2 ** (n - 1);
        rec.retryAfter = new Date(this.now() + wait).toISOString();
        rec.deferred.push({ ev: { ...rec.lastDispatch.ev, id: `${rec.lastDispatch.ev.id}:retry${n}` }, stateKey: rec.lastDispatch.stateKey, why: `retry ${n}`, notBefore: rec.retryAfter });
        this.store.event(issue.identifier, 'retry', `${r.phase} ${r.outcome}; retry ${n}/${this.cfg.runner.retries} after ${Math.round(wait / 1000)}s`);
      } else {
        await this.flag(issue, `The \`${r.phase}\` run ${r.outcome === 'timeout' ? `hit its wall-clock cap (${this.cfg.caps[r.phase]})` : `failed (exit ${r.code})`} ${n} time(s). Not retrying — over to you. Logs: \`aidlc status ${issue.identifier}\`.`);
      }
      return;
    }
    rec.retries[r.phase] = 0;
    rec.retryAfter = null;
    await this.emit(issue, rec, kind, { type: 'run.exited', id: `exit:${r.runId}`, outcome: r.outcome, phase: r.phase });
  }

  async unpark(issue, rec, why) {
    const p = rec.parked;
    rec.parked = null;
    await this.linear.removeLabel(issue.id, this.needsHumanLabel).catch(() => {});
    if (p?.lane) await this.lanes.remove(p.lane.path).catch(() => {});
    if (p?.simDevice) this.runner.deleteSimulator(p.simDevice);
    this.store.event(issue.identifier, 'unpark', why);
  }

  async parkExpired(issue, rec) {
    const p = rec.parked;
    await this.flag(issue, `The \`${p.phase}\` run has been parked on its question since ${p.since} (park timeout ${this.cfg.park.timeout}). Its lane is removed; the question stays open — answer it and move the issue to re-run the phase.`);
    rec.parked = null;
    if (p.lane) await this.lanes.remove(p.lane.path).catch(() => {});
  }

  // ---------------------------------------------------------------- check evidence

  async verifyChecks(issue, rec, kind, ev, at, require, ctx) {
    let sha;
    let baseSha = null;
    let prNumber = null;
    if (at === 'merged-main') {
      await this.lanes.fetch();
      sha = await this.lanes.baseHead();
    } else {
      const pr = ev.pr || (rec.branch ? await this.github.findPr(rec.branch) : null);
      if (!pr) return this.defer(issue, rec, ev, 'no PR found for the slice branch', 60e3);
      prNumber = pr.number;
      if (at === 'pr-head') {
        sha = pr.headSha;
        baseSha = pr.baseSha;
      } else {
        if (!pr.mergeSha) return this.defer(issue, rec, ev, 'merge SHA not available yet', 60e3);
        sha = pr.mergeSha;
      }
    }
    const result = await this.checks.verify({ at, sha, baseSha, prNumber });
    ctx.checks = result;
    rec.lastChecks = { at, sha, status: result.status, summary: result.summary };
    if (result.tampered.length) {
      await this.flagOnce(issue, rec, `tamper:${sha}`, `**Check definitions changed** at \`${sha.slice(0, 10)}\`: ${result.tampered.map((f) => `\`${f}\``).join(', ')}. An agent must not redefine the checks that gate it (invariant §2.7): this is a blocking DevOps finding for a human.${this.cfg.ci.mode !== 'actions-cloud' && this.cfg.ci.useBaseDefinitions ? ' The daemon re-ran the suite with the base branch definitions.' : ' Actions ran the definitions from this change — read them before you merge.'}`);
    }
    if (result.status === 'pending') return this.defer(issue, rec, ev, result.summary, 60e3);
    this.store.event(issue.identifier, 'checks', result.summary);
    if (result.status === 'red' && require === 'green') {
      rec.lastFailure = result.summary;
      await this.flag(issue, `${result.summary}.\n\nProposed return phase: **Build+Test** for ${issue.identifier}. The daemon does not bounce — move it if you agree (the breaker counts it).`);
      return 'stop';
    }
    return 'ok';
  }

  async validateSlice(issue, rec, ctx) {
    const cmd = this.cfg.validation.sliceCommand;
    if (!cmd) {
      this.store.event(issue.identifier, 'validate', 'no validation.sliceCommand configured: checks at the merge SHA are the slice evidence');
      return 'ok';
    }
    const sha = ctx.checks?.sha;
    const lane = await this.lanes.create(`${issue.identifier}-validate-${this.now()}`, { sha });
    try {
      const acceptance = (issue.description.split('## Acceptance criteria')[1] || '').split('\n').filter((l) => l.startsWith('- ')).map((l) => l.slice(2));
      const env = buildChildEnv({ secrets: this.secrets, withAgentSecrets: false, context: { AIDLC_ISSUE: issue.identifier, AIDLC_ACCEPTANCE: JSON.stringify(acceptance), AIDLC_PORT_OFFSET: 0, AIDLC_VERIFY_SHA: sha } });
      const logFile = path.join(this.store.dir, 'runs', `${issue.identifier}-validate-${this.now()}.log`);
      const r = await runShell({ command: cmd, cwd: lane.path, env, timeoutMs: this.cfg.ms.validation, logFile, runAs: this.cfg.runner.runAs });
      if (r.code === 0 && !r.timedOut) {
        this.store.event(issue.identifier, 'validate', 'slice validation green');
        return 'ok';
      }
      rec.lastFailure = `slice validation ${r.timedOut ? 'timed out' : `exit ${r.code}`}`;
      await this.flag(issue, `Slice validation **failed** at \`${sha.slice(0, 10)}\` (${rec.lastFailure}).\n\n\`\`\`\n${tail(r.output, 30)}\n\`\`\`\n\nProposed return phase: **Build+Test** for ${issue.identifier}. Move it if you agree (the breaker counts it).`);
      return 'stop';
    } finally {
      await this.lanes.remove(lane.path);
    }
  }

  // ---------------------------------------------------------------- slices

  async createSlicesAction(issue, rec, ev) {
    let res;
    try {
      res = await createSlices({
        linear: this.linear,
        issue,
        team: this.team,
        cfg: this.cfg,
        known: (id) => !!this.store.data.knownSlices[id],
        remember: (id, v) => {
          this.store.data.knownSlices[id] = v;
          this.store.save();
        },
        log: (m) => this.store.event(issue.identifier, 'slices', m),
      });
    } catch (e) {
      if (!(e instanceof SlicePlanError)) throw e;
      await this.flag(issue, `Could not create slices from the Tech Spec: ${e.message}\n\nFix the \`aidlc-slices\` block (or ask Design to), then move ${issue.identifier} back to **Design** and forward to **Build+Test** again.`);
      return 'stop';
    }
    if (res.unit) {
      rec.unit = true;
      rec.kind = 'unit';
      this.store.event(issue.identifier, 'slices', '1-slice Feature: the Feature itself is the unit');
      await this.emit(issue, rec, 'unit', { ...ev, id: `${ev.id}:unit` });
      return 'stop';
    }
    const made = res.slices.filter((s) => s.created);
    this.store.event(issue.identifier, 'slices', `${res.slices.length} slices (${made.length} created): ${res.slices.map((s) => `${s.identifier} ${s.key}`).join(', ')}`);
    if (made.length) await this.linear.comment(issue.id, `**AIDLC daemon** — created ${made.length} slice(s) from the Tech Spec after your Build+Test gate:\n\n${res.slices.map((s) => `- ${s.identifier} — \`${s.key}\``).join('\n')}\n\nThe umbrella waits; slices build one at a time in chain order.`);
    const fresh = await this.linear.issue(issue.id);
    issue.children = fresh.children;
    return 'ok';
  }

  /** Release the next unblocked backlog slice; when every slice is terminal, tell the Feature. */
  async releaseNext(issue, kind) {
    const feature = kind === 'slice' ? await this.linear.issue(issue.parent.id) : await this.linear.issue(issue.id);
    const frec = this.store.issue(feature.id, feature.identifier);
    if (frec.chainStopped) {
      this.store.event(feature.identifier, 'chain', `chain stopped (${frec.chainStopped}); not releasing`);
      return 'ok';
    }
    const slices = feature.children.filter((c) => this.store.data.knownSlices[c.id]).sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
    if (!slices.length) return 'ok';
    const key = (c) => this.stateKeyById[c.state.id];
    if (slices.some((c) => ACTIVE_SLICE.includes(key(c)))) return 'ok'; // one slice in flight at a time
    for (const c of slices.filter((s) => key(s) === 'backlog' || s.state.type === 'backlog' || s.state.type === 'unstarted')) {
      const full = await this.linear.issue(c.id);
      const blockers = full.inverseRelations.filter((r) => r.type === 'blocks').map((r) => r.issue);
      if (blockers.every((b) => TERMINAL.includes(this.stateKeyById[b.state.id]))) {
        this.store.issue(full.id, full.identifier).kind = 'slice';
        this.store.event(feature.identifier, 'release', `releasing ${full.identifier}`);
        await this.machineMove(full, 'build', { release: true, reason: 'release' });
        return 'ok';
      }
    }
    if (slices.every((c) => TERMINAL.includes(key(c))) && slices.some((c) => key(c) === 'done')) {
      const id = `children.done:${createHash('sha1').update(slices.map((c) => `${c.id}:${c.state.id}`).join(',')).digest('hex').slice(0, 12)}`;
      if (!this.store.isProcessed(frec, id)) {
        this.store.markProcessed(frec, id);
        await this.emit(feature, frec, this.kindOf(feature, frec), { type: 'children.done', id });
      }
    }
    return 'ok';
  }

  /** Breaker (plan §4): count failure re-entries into Build+Test per slice, from Linear's own history. */
  async bounce(issue, rec, ev, ctx) {
    const since = Date.parse(rec.breakerResetAt || 0);
    const bounces = issue.history.filter(
      (h) => h.toStateId === this.stateIdByKey.build && BOUNCE_FROM.includes(this.stateKeyById[h.fromStateId]) && Date.parse(h.createdAt) > since,
    ).length;
    ctx.bounce = bounces;
    this.store.event(issue.identifier, 'bounce', `bounce ${bounces}/${this.cfg.breaker.bounces}`);
    if (bounces < this.cfg.breaker.bounces) return 'ok';
    const featureId = issue.parent?.id || issue.id;
    const frec = this.store.issue(featureId);
    frec.chainStopped = `breaker tripped on ${issue.identifier}`;
    rec.breaker = { trippedAt: new Date(this.now()).toISOString(), bounces };
    const lead = this.cfg.owner.leadUserId;
    if (lead) await this.linear.updateIssue(issue.id, { assigneeId: lead });
    await this.flagOnce(issue, rec, `${ev.id}:breaker`, `**Circuit breaker tripped**: ${issue.identifier} has bounced back to Build+Test ${bounces} times (limit ${this.cfg.breaker.bounces}). A run loop is not a fix — no build dispatched, the slice chain is stopped${lead ? ', and the slice is reassigned to the lead' : ''}. Your call: fix the root cause (spec, design, or code) or cancel. \`aidlc breaker reset ${issue.identifier}\` re-arms it.`);
    return 'stop';
  }

  // ---------------------------------------------------------------- validate + learn

  async requireScorecard(issue, rec) {
    const runStart = Date.parse(rec.lastRun?.startedAt || 0) - 5000;
    const doc = issue.documents.filter((d) => d.title.startsWith('Validate Scorecard') && Date.parse(d.updatedAt) >= runStart).sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))[0];
    const block = doc && String(doc.content).match(/```aidlc-scorecard\s*\n([\s\S]*?)\n\s*```/);
    let s = null;
    try {
      s = block ? JSON.parse(block[1]) : null;
    } catch {
      s = null;
    }
    if (!s || !(s.total > 0)) {
      await this.flag(issue, `The \`ship\` run ended without a readable \`Validate Scorecard — …\` Document (an \`aidlc-scorecard\` block with counts). Nothing advanced. Comment here to re-run Validate.`);
      return 'stop';
    }
    s.score = s.passed / s.total;
    rec.scorecard = s;
    const pct = Math.round(s.score * 100);
    this.store.event(issue.identifier, 'scorecard', `${s.passed}/${s.total} (${pct}%), ${s.humanPending || 0} human-pending`);
    if (s.score < this.cfg.learn.threshold) {
      await this.flag(issue, `Validate scorecard: **${pct}%** (${s.passed}/${s.total}) — below the ${Math.round(this.cfg.learn.threshold * 100)}% threshold. The daemon does nothing further.${s.proposedReturn ? ` Proposed return: ${s.proposedReturn}.` : ''} Move the root-cause issue to its phase (usually a slice → Build+Test).`);
      return 'stop';
    }
    return 'ok';
  }

  async learnGate(issue, rec, kind, ev, ctx) {
    const s = rec.scorecard;
    if (!this.cfg.learn.auto) {
      await this.linear.comment(issue.id, `**AIDLC daemon** — scorecard passed. Auto-Learn is off: comment on this issue to start Learn. ${this.cfg.owner.mention}`);
      return 'stop';
    }
    if (s?.humanPending > 0) {
      await this.flagOnce(issue, rec, `${ev.id}:held`, `Scorecard passed, but **${s.humanPending} evidence row(s) are human-pending** (e.g. screenshots without a vision model). Auto-Learn is **held** (ceiling rule): check those rows in the scorecard, then comment here to confirm — your comment starts Learn.`);
      return 'stop';
    }
    return this.dispatch(issue, rec, kind, ev, 'learn', 'merged-main', ctx);
  }

  async cleanup(issue, rec) {
    const ids = [issue.id, ...issue.children.map((c) => c.id)];
    for (const id of ids) {
      const r = this.store.data.issues[id];
      if (!r) continue;
      if (this.runner.isLive(id)) this.runner.stop(id, 'feature closed');
      if (r.parked?.lane) await this.lanes.remove(r.parked.lane.path).catch(() => {});
      await this.runner.releaseClaim(id).catch(() => {});
      r.parked = null;
      r.deferred = [];
      r.closed = true;
    }
    this.store.event(issue.identifier, 'cleanup', 'closed: lanes torn down, claims cleared');
    return 'ok';
  }

  // ---------------------------------------------------------------- flags + requests

  stateName(stateId) {
    return this.team.states.find((s) => s.id === stateId)?.name || stateId;
  }

  async flag(issue, text) {
    const body = `${this.cfg.owner.mention ? `${this.cfg.owner.mention} ` : ''}**AIDLC daemon flag** — ${text}`;
    await this.linear.comment(issue.id, body);
    if (this.flagLabel) await this.linear.addLabel(issue.id, this.flagLabel).catch(() => {});
    this.store.event(issue.identifier, 'flag', text.split('\n')[0].slice(0, 200));
  }

  async flagOnce(issue, rec, key, text) {
    if (rec.flags.includes(key)) return true;
    rec.flags.push(key);
    await this.flag(issue, text);
    return true;
  }

  async handleRequest(req) {
    if (req.cmd === 'gate-confirm') this.store.event(req.issue, 'cli', await this.confirmGate(req.issue));
    else if (req.cmd === 'breaker-reset') this.store.event(req.issue, 'cli', this.resetBreaker(req.issue));
    else if (req.cmd === 'reconcile') this.store.event(null, 'cli', JSON.stringify(await this.reconcile(req)));
    else if (req.cmd === 'stop-runs') for (const id of [...this.runner.live.keys()]) this.runner.stop(id, 'aidlc pause --stop-runs');
  }

  resetBreaker(idOrIdentifier) {
    const rec = this.store.findIssue(idOrIdentifier);
    if (!rec) return `${idOrIdentifier}: unknown`;
    rec.breakerResetAt = new Date(this.now()).toISOString();
    rec.breaker = null;
    const parent = Object.values(this.store.data.knownSlices).length ? this.store.data.knownSlices[rec.id]?.featureId : null;
    const frec = this.store.data.issues[parent || rec.id];
    if (frec) frec.chainStopped = null;
    return `${rec.identifier}: breaker re-armed`;
  }

  /**
   * After the machine was off (or crashed): clear stale claims and lanes, then re-scan every issue in
   * an AIDLC state. Dedupe by event id means nothing already handled runs twice.
   */
  async reconcile({ since = null, scan = true } = {}) {
    const report = { staleRuns: 0, delegatesCleared: 0, lanesRemoved: 0, scanned: 0 };
    for (const r of Object.values(this.store.data.issues)) {
      if (r.run && !this.runner.isLive(r.id)) {
        report.staleRuns++;
        if (r.run.lane?.path) await this.lanes.remove(r.run.lane.path).catch(() => {});
        r.exits.push({ runId: r.run.runId, phase: r.run.phase, outcome: 'failed', code: null, startedAt: r.run.startedAt, endedAt: new Date(this.now()).toISOString(), sessionId: r.run.sessionId, lane: null, reason: 'daemon restarted mid-run' });
        r.lastRun = { ...r.run, outcome: 'failed' };
        r.run = null;
      }
    }
    for (const i of await this.linear.delegatedTo(this.team.key, this.bot.id)) {
      if (!this.runner.isLive(i.id)) {
        await this.linear.updateIssue(i.id, { delegateId: null });
        report.delegatesCleared++;
      }
    }
    const keep = new Set([...this.runner.live.values()].map((r) => r.lane.path));
    for (const r of Object.values(this.store.data.issues)) if (r.parked?.lane?.path) keep.add(r.parked.lane.path);
    for (const p of this.lanes.list()) {
      if (!keep.has(p)) {
        await this.lanes.remove(p).catch(() => {});
        report.lanesRemoved++;
      }
    }
    if (since) this.store.data.reconcileSince = since;
    if (!scan) {
      this.store.save();
      return report;
    }
    const states = ['plan', 'design', 'build', 'review', 'staging', 'ship', 'backlog'].map((k) => this.cfg.states[k]).filter(Boolean);
    const issues = await this.linear.issuesInStates(this.team.key, states);
    for (const i of issues) {
      try {
        await this.processIssue(i.id);
        report.scanned++;
      } catch (e) {
        this.log(`reconcile ${i.identifier}: ${e.message}`);
      }
    }
    this.store.save();
    return report;
  }
}
