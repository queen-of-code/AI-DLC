// Check evidence (plan §11): the configured source at a SHA, re-verified by the daemon itself.
//   actions-cloud        GitHub check runs at the SHA (independent machine — strongest evidence)
//   actions-self-hosted  check runs AND a local re-run (the runner shares a machine with the agent)
//   hooks-only           the daemon's local re-run IS the evidence (hooks are skippable via --no-verify)
// One result per SHA. Tamper flag: the change under test touched a check definition (invariant §2.7).
import path from 'node:path';
import { buildChildEnv } from './secrets.mjs';
import { runShell } from './proc.mjs';
import { matchesAny, tail } from './util.mjs';

const OK = new Set(['success', 'neutral', 'skipped']);

export class Checks {
  constructor({ cfg, github, lanes, store, secrets, now = () => Date.now() }) {
    Object.assign(this, { cfg, github, lanes, store, secrets, now });
  }

  /**
   * at: pr-head | merge-sha | merged-main. Returns
   * { status: green|red|pending, sha, sources: [...], failed: [...], tampered: [...], summary }.
   */
  async verify({ at, sha, baseSha = null, prNumber = null }) {
    const key = `${sha}:${this.cfg.ci.mode}`;
    const cached = this.store.data.checks[key];
    if (cached && cached.status !== 'pending') return cached;
    const firstSeen = cached?.firstSeen || new Date(this.now()).toISOString();

    const tampered = await this.tamper({ at, sha, baseSha, prNumber });
    const sources = [];
    const failed = [];
    let status = 'green';

    if (this.cfg.ci.mode !== 'hooks-only') {
      const runs = await this.github.checks(sha);
      const want = this.cfg.ci.requiredChecks;
      const relevant = want.length ? runs.filter((r) => want.includes(r.name)) : runs;
      const missing = want.filter((n) => !runs.some((r) => r.name === n));
      if (!relevant.length || missing.length || relevant.some((r) => r.status !== 'completed')) status = 'pending';
      else for (const r of relevant) if (!OK.has(r.conclusion)) failed.push(`${r.name}: ${r.conclusion}`);
      sources.push(`actions (${relevant.length} check${relevant.length === 1 ? '' : 's'}${missing.length ? `, waiting for ${missing.join(', ')}` : ''})`);
      if (status === 'pending' && this.now() - Date.parse(firstSeen) > this.cfg.ms.ciPending) {
        status = 'red';
        failed.push(`no completed check results at ${sha.slice(0, 10)} after ${this.cfg.ci.pendingTimeout}`);
      }
    }

    if (status !== 'pending' && this.cfg.ci.mode !== 'actions-cloud') {
      const local = await this.rerun({ sha, baseSha, prNumber });
      sources.push(`local re-run (${this.cfg.ci.command})${local.baseDefinitions.length ? `, base definitions: ${local.baseDefinitions.join(', ')}` : ''}`);
      if (!local.ok) failed.push(`local re-run: ${local.why}`);
    }
    if (status !== 'pending' && failed.length) status = 'red';

    const result = {
      status,
      sha,
      at,
      mode: this.cfg.ci.mode,
      sources,
      failed,
      tampered,
      firstSeen,
      checkedAt: new Date(this.now()).toISOString(),
      summary:
        status === 'pending'
          ? `checks pending at ${sha.slice(0, 10)}`
          : `checks ${status} at ${sha.slice(0, 10)} (${sources.join('; ')})${failed.length ? ` — ${failed.join('; ')}` : ''}`,
    };
    this.store.data.checks[key] = result;
    return result;
  }

  async tamper({ at, sha, baseSha, prNumber }) {
    let files = [];
    if (at === 'pr-head' && prNumber) files = await this.github.changedFiles(prNumber);
    else if (at === 'merge-sha' && sha) files = await this.lanes.changedFiles(`${sha}^1`, sha).catch(() => []);
    else if (baseSha && sha) files = await this.lanes.changedFiles(baseSha, sha).catch(() => []);
    return files.filter((f) => matchesAny(f, this.cfg.ci.definitionPaths));
  }

  /** Re-run the suite in a throwaway lane at the SHA, with the base branch's check definitions. */
  async rerun({ sha, baseSha, prNumber }) {
    const name = `verify-${sha.slice(0, 12)}-${this.now()}`;
    const lane = await this.lanes.create(name, { sha, prNumber });
    try {
      const definitionBase = baseSha || `${sha}^1`;
      const baseDefinitions = this.cfg.ci.useBaseDefinitions
        ? await this.lanes.useBaseDefinitions(lane.path, definitionBase, this.cfg.ci.definitionPaths).catch(() => [])
        : [];
      // Code under test is untrusted: no agent or daemon secrets at all.
      const env = buildChildEnv({ secrets: this.secrets, withAgentSecrets: false, context: { CI: 'true', AIDLC_VERIFY_SHA: sha } });
      const logFile = path.join(this.store.dir, 'runs', `${name}.log`);
      const r = await runShell({ command: this.cfg.ci.command, cwd: lane.path, env, timeoutMs: this.cfg.ms.ciTimeout, logFile, runAs: this.cfg.runner.runAs });
      return {
        ok: r.code === 0 && !r.timedOut,
        why: r.timedOut ? `timed out after ${this.cfg.ci.timeout}` : `exit ${r.code}\n${tail(r.output, 15)}`,
        baseDefinitions,
      };
    } finally {
      await this.lanes.remove(lane.path);
    }
  }
}
