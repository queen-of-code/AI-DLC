// Robot lanes (plan §4): daemon-created git worktrees, isolated from the human's checkout, pinned
// to a SHA — or checked out to the slice branch for Build. Torn down after the run.
import { execFile } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { matchesAny } from './util.mjs';

export class Lanes {
  constructor(cfg) {
    this.repo = cfg.repo.path;
    this.remote = cfg.repo.remote;
    this.base = cfg.repo.base;
    this.dir = cfg.lanes.dir;
    fs.mkdirSync(this.dir, { recursive: true });
  }

  git(args, cwd = this.repo) {
    return new Promise((resolve, reject) => {
      execFile('git', args, { cwd, maxBuffer: 64 * 1024 * 1024, timeout: 300e3, env: { ...gitEnv() } }, (err, stdout, stderr) => {
        if (err) reject(new Error(`git ${args.join(' ')}: ${stderr.trim() || err.message}`));
        else resolve(stdout.trim());
      });
    });
  }

  async fetch() {
    await this.git(['fetch', this.remote, '--prune', '--quiet']);
  }

  /** Head of the integration branch on the remote (after fetch) = "merged main". */
  async baseHead() {
    return this.git(['rev-parse', `${this.remote}/${this.base}`]);
  }

  async hasCommit(sha) {
    try {
      await this.git(['cat-file', '-e', `${sha}^{commit}`]);
      return true;
    } catch {
      return false;
    }
  }

  async ensureCommit(sha, prNumber) {
    if (await this.hasCommit(sha)) return;
    if (prNumber) await this.git(['fetch', this.remote, `pull/${prNumber}/head`, '--quiet']).catch(() => {});
    if (!(await this.hasCommit(sha))) await this.git(['fetch', this.remote, sha, '--quiet']).catch(() => {});
    if (!(await this.hasCommit(sha))) throw new Error(`commit ${sha} not available from ${this.remote}`);
  }

  async remoteBranchExists(branch) {
    try {
      await this.git(['rev-parse', '--verify', '--quiet', `refs/remotes/${this.remote}/${branch}`]);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * spec: { sha, prNumber? } (detached, pinned) | { branch, startSha } (slice branch: the existing
   * remote branch on a bounce/retry, else a new branch from startSha). Returns { path, sha, branch, bounced }.
   */
  async create(name, spec) {
    const p = path.join(this.dir, name);
    if (fs.existsSync(p)) await this.remove(p);
    if (spec.branch) {
      const existing = await this.remoteBranchExists(spec.branch);
      const start = existing ? `${this.remote}/${spec.branch}` : spec.startSha;
      await this.git(['worktree', 'add', '--quiet', '-B', spec.branch, p, start]);
      const sha = await this.git(['rev-parse', 'HEAD'], p);
      return { path: p, sha, branch: spec.branch, existingBranch: existing };
    }
    await this.ensureCommit(spec.sha, spec.prNumber);
    await this.git(['worktree', 'add', '--quiet', '--detach', p, spec.sha]);
    return { path: p, sha: spec.sha, branch: null, existingBranch: false };
  }

  async remove(p) {
    try {
      await this.git(['worktree', 'remove', '--force', p]);
    } catch {
      fs.rmSync(p, { recursive: true, force: true });
    }
    await this.git(['worktree', 'prune']).catch(() => {});
  }

  list() {
    return fs.existsSync(this.dir) ? fs.readdirSync(this.dir).map((n) => path.join(this.dir, n)) : [];
  }

  async changedFiles(fromSha, toSha) {
    const out = await this.git(['diff', '--name-only', fromSha, toSha]);
    return out ? out.split('\n') : [];
  }

  /** Evaluate checks from the base-branch definition (invariant §2.7): overwrite check-definition files in the lane. */
  async useBaseDefinitions(lanePath, baseSha, globs) {
    const files = (await this.git(['ls-tree', '-r', '--name-only', baseSha])).split('\n').filter((f) => f && matchesAny(f, globs));
    for (const f of files) await this.git(['checkout', baseSha, '--', f], lanePath);
    return files;
  }
}

/** git must never inherit the daemon's secrets either. */
function gitEnv() {
  const e = {};
  for (const k of ['PATH', 'HOME', 'USER', 'LANG', 'TMPDIR', 'SSH_AUTH_SOCK', 'GIT_SSH_COMMAND']) if (process.env[k]) e[k] = process.env[k];
  e.GIT_TERMINAL_PROMPT = '0';
  return e;
}
