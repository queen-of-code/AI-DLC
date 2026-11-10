// Read-only GitHub adapter (plan §3: the daemon's `gh` is read-only — PR state, merge SHA, check
// conclusions). One adapter on purpose: a Gitea/Forgejo variant replaces this file, nothing else.
import { execFile } from 'node:child_process';

export class GitHub {
  constructor({ nwo, token, ghPath = 'gh', env = process.env }) {
    this.nwo = nwo;
    this.gh = ghPath;
    this.env = { PATH: env.PATH, HOME: env.HOME, GH_PROMPT_DISABLED: '1', NO_COLOR: '1' };
    if (token) this.env.GH_TOKEN = token;
  }

  run(args) {
    return new Promise((resolve, reject) => {
      execFile(this.gh, args, { env: this.env, maxBuffer: 32 * 1024 * 1024, timeout: 60e3 }, (err, stdout, stderr) => {
        if (err) reject(new Error(`gh ${args.slice(0, 3).join(' ')}: ${stderr.trim() || err.message}`));
        else resolve(stdout);
      });
    });
  }

  async json(args) {
    const out = await this.run(args);
    return out.trim() ? JSON.parse(out) : null;
  }

  /** Most recent PR whose head is `branch`. Normalized shape used by the engine. */
  async findPr(branch) {
    const prs = await this.json([
      'pr', 'list', '--repo', this.nwo, '--head', branch, '--state', 'all', '--limit', '5',
      '--json', 'number,state,isDraft,headRefOid,baseRefOid,baseRefName,mergeCommit,mergedBy,mergedAt,title,url',
    ]);
    if (!prs?.length) return null;
    const p = prs.sort((a, b) => b.number - a.number)[0];
    return {
      number: p.number,
      state: p.state, // OPEN | MERGED | CLOSED
      isDraft: p.isDraft,
      headSha: p.headRefOid,
      baseSha: p.baseRefOid,
      baseRef: p.baseRefName,
      mergeSha: p.mergeCommit?.oid || null,
      mergedBy: p.mergedBy?.login || null,
      title: p.title,
      url: p.url,
    };
  }

  async changedFiles(number) {
    const v = await this.json(['pr', 'view', String(number), '--repo', this.nwo, '--json', 'files']);
    return (v?.files || []).map((f) => f.path);
  }

  /** Bodies of the `AIDLC Review — …` comments, for the bounce prompt. */
  async reviewFindings(number) {
    const v = await this.json(['pr', 'view', String(number), '--repo', this.nwo, '--json', 'comments,reviews']);
    const bodies = [...(v?.comments || []), ...(v?.reviews || [])].map((c) => c.body || '');
    return bodies.filter((b) => b.includes('AIDLC Review'));
  }

  /** Check runs + legacy commit statuses at a SHA → [{ name, status, conclusion }]. */
  async checks(sha) {
    const runs = await this.json(['api', `repos/${this.nwo}/commits/${sha}/check-runs?per_page=100`]);
    const status = await this.json(['api', `repos/${this.nwo}/commits/${sha}/status`]);
    const out = (runs?.check_runs || []).map((r) => ({ name: r.name, status: r.status, conclusion: r.conclusion }));
    for (const s of status?.statuses || []) {
      out.push({
        name: s.context,
        status: s.state === 'pending' ? 'in_progress' : 'completed',
        conclusion: s.state === 'success' ? 'success' : s.state === 'pending' ? null : 'failure',
      });
    }
    return out;
  }
}
