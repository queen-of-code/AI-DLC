// Decision B (owner, 2026-11-09): the agent's Linear token is **read + comments only**. Linear
// has no permission set that can write Documents without also moving issues, so the agent is
// given no Document write at all — it writes the documents it produces as markdown files in the
// lane's docs dir, and the daemon (which holds write) publishes them here, after the run.
//
// Clobber protection: the engine snapshots a hash of every Document on the issue at dispatch.
// At publish time, a Document whose content changed after that snapshot (a human edited it in
// the UI while the run was live) is NOT overwritten — the run's file is attached and a human is
// asked to merge. Nothing an agent writes can destroy a human edit.
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';

export const contentHash = (s) => createHash('sha256').update(String(s ?? '')).digest('hex');

/** Lane filename → Document title. The phase prompts name these exact files. */
export const DOC_SLOTS = {
  'product-spec.md': (t) => `Product Spec — ${t}`,
  'tech-spec.md': (t) => `Tech Spec — ${t}`,
  'validate-scorecard.md': (t) => `Validate Scorecard — ${t}`,
};

/**
 * Publish the run's documents to the issue.
 *  - linear: the daemon client (write scope)
 *  - issue: a fresh snapshot from linear.issue() (documents included)
 *  - rec: the store record (published doc ids are persisted in rec.docs)
 *  - docsDir: the lane's docs directory (absolute)
 *  - baseline: docId → content hash taken at dispatch (engine)
 *  - evidenceUrls: evidence filename → uploaded asset URL (image reference rewrite)
 *  - secrets: values to redact from the content before it is published
 * Returns { published, unchanged, held, errors }.
 */
export async function publishDocuments({ linear, issue, rec, docsDir, baseline = {}, evidenceUrls = {}, secrets = [], ownerMention = '', log = () => {} }) {
  const out = { published: [], unchanged: [], held: [], errors: [] };
  if (!fs.existsSync(docsDir)) return out;
  rec.docs = rec.docs || {};
  for (const file of fs.readdirSync(docsDir).filter((f) => f.endsWith('.md'))) {
    const slot = DOC_SLOTS[file];
    if (!slot) {
      out.errors.push(`${file}: not a known document (the prompts name ${Object.keys(DOC_SLOTS).join(', ')})`);
      continue;
    }
    const title = slot(issue.title);
    let content = fs.readFileSync(path.join(docsDir, file), 'utf8');
    for (const s of secrets) if (s) content = content.split(s).join('[REDACTED]');
    for (const [name, url] of Object.entries(evidenceUrls)) content = content.split(`](${name})`).join(`](${url})`);
    const hash = contentHash(content);

    const existing = issue.documents.filter((d) => d.title === title);
    const doc = (rec.docs[file]?.docId && issue.documents.find((d) => d.id === rec.docs[file].docId)) || existing[0] || null;

    if (!doc) {
      const created = await linear.documentCreate({ title, content, issueId: issue.id });
      rec.docs[file] = { docId: created.id, title, hash };
      out.published.push(title);
      continue;
    }
    if (contentHash(doc.content) === hash) {
      out.unchanged.push(title); // same content already published — idempotent, no API write
      continue;
    }
    const current = contentHash(doc.content);
    const untouched = baseline[doc.id] !== undefined && baseline[doc.id] === current;
    if (!untouched) {
      // A human edited the Document after dispatch: refuse to clobber, attach the run's version.
      let attach = '';
      try {
        const url = await linear.upload(file, 'text/markdown', Buffer.from(content));
        attach = `\n\nThe run's version: [${file}](${url})`;
      } catch (e) {
        log(`attach ${file}: ${e.message}`);
      }
      out.held.push(title);
      rec.docs[file] = { docId: doc.id, title, hash: current, heldAt: new Date().toISOString() };
      await linear
        .comment(
          issue.id,
          `${ownerMention} **AIDLC daemon flag** — you edited **${title}** while the run was active, so the run's version was NOT published over your edit. ${attach} Merge the run's changes into the Document, then comment to continue.`,
        )
        .catch((e) => log(`held-doc comment: ${e.message}`));
      continue;
    }
    await linear.documentUpdate(doc.id, { title, content });
    rec.docs[file] = { docId: doc.id, title, hash };
    out.published.push(title);
  }
  return out;
}
