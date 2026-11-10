// Slice plan → sub-issues. Same block rules, marker and idempotency as aidlc-slices.sh (P1); the
// daemon runs this on the human's Design → Build+Test move. Slices are born inert by construction:
// they do not exist before the gate, and they are created in the backlog state.

const KEBAB = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const FENCE_OPEN = /^\s*```aidlc-slices\s*$/;
const FENCE_CLOSE = /^\s*```\s*$/;

export class SlicePlanError extends Error {}

/** Extract and validate the single ```aidlc-slices block. Returns { version, slices }. */
export function extractPlan(markdown) {
  const lines = String(markdown ?? '').split('\n');
  const opens = lines.filter((l) => FENCE_OPEN.test(l)).length;
  if (opens !== 1) throw new SlicePlanError(`expected exactly one \`\`\`aidlc-slices block in the Tech Spec, found ${opens}`);
  const start = lines.findIndex((l) => FENCE_OPEN.test(l));
  const body = [];
  for (let i = start + 1; i < lines.length && !FENCE_CLOSE.test(lines[i]); i++) body.push(lines[i]);
  let plan;
  try {
    plan = JSON.parse(body.join('\n'));
  } catch {
    throw new SlicePlanError('the aidlc-slices block is not valid JSON');
  }
  const errs = [];
  if (plan?.version !== 1) errs.push('version must be 1');
  else if (!Array.isArray(plan.slices)) errs.push('slices must be an array');
  else if (plan.slices.some((s) => typeof s !== 'object' || s === null || Array.isArray(s))) errs.push('every slice must be an object');
  else {
    if (plan.slices.length > 9) errs.push('more than 9 slices: split the Feature');
    const keys = plan.slices.map((s) => s.key);
    if (new Set(keys).size !== keys.length) errs.push('duplicate slice keys');
    plan.slices.forEach((s, i) => {
      if (typeof s.key !== 'string' || !KEBAB.test(s.key)) errs.push(`slice ${i}: key must be lowercase kebab-case`);
      if (typeof s.title !== 'string' || !s.title) errs.push(`slice ${i} (${s.key}): title required`);
      if (!Array.isArray(s.acceptance) || !s.acceptance.length || s.acceptance.some((a) => typeof a !== 'string'))
        errs.push(`slice ${i} (${s.key}): acceptance must be a non-empty list of strings`);
      const b = s.blockedBy ?? [];
      if (!Array.isArray(b)) errs.push(`slice ${i} (${s.key}): blockedBy must be a list`);
      else {
        const earlier = plan.slices.slice(0, i).map((x) => x.key);
        for (const k of b) if (!earlier.includes(k)) errs.push(`slice ${i} (${s.key}): blockedBy "${k}" is not an earlier slice key (build order, no cycles)`);
      }
    });
  }
  if (errs.length) throw new SlicePlanError(`invalid slice plan:\n${errs.join('\n')}`);
  return plan;
}

export const sliceMarker = (feature, key) => `aidlc-slice: ${feature}/${key}`;

export function markerKey(description, featureIdentifier) {
  const esc = featureIdentifier.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const m = String(description ?? '').match(new RegExp(`aidlc-slice: ${esc}/([a-z0-9-]+)`));
  return m ? m[1] : null;
}

export function sliceDescription(feature, s) {
  return (
    `Slice of ${feature}` +
    (s.section ? ` — Tech Spec section: ${s.section}` : '') +
    `\n\n## Acceptance criteria\n${s.acceptance.map((a) => `- ${a}`).join('\n')}` +
    `\n\n\`${sliceMarker(feature, s.key)}\``
  );
}

export function techSpecOf(issue) {
  const docs = issue.documents.filter((d) => d.title.startsWith('Tech Spec'));
  if (docs.length !== 1) throw new SlicePlanError(`expected one "Tech Spec — …" Document on ${issue.identifier}, found ${docs.length}`);
  return docs[0];
}

export function backlogStateId(team, cfg) {
  if (cfg.states.backlog) {
    const s = team.states.find((x) => x.name === cfg.states.backlog);
    if (!s) throw new SlicePlanError(`team has no state named "${cfg.states.backlog}"`);
    return s.id;
  }
  const s = team.states.filter((x) => x.type === 'backlog').sort((a, b) => a.position - b.position)[0];
  if (!s) throw new SlicePlanError('team has no backlog-type state; set states.backlog');
  return s.id;
}

/**
 * Create the Feature's slices. `known(id)` tells whether the daemon created/adopted a slice before;
 * existing marker children it does not know are refused unless `adopt` (human-run CLI only) — an
 * issue carrying a marker is not proof the daemon made it.
 * Returns { unit: boolean, plan, slices: [{key, id, identifier, created}] }.
 */
export async function createSlices({ linear, issue, team, cfg, known, remember, adopt = false, log = () => {} }) {
  const plan = extractPlan(techSpecOf(issue).content);
  if (plan.slices.length === 0) return { unit: true, plan, slices: [] };
  const feature = issue.identifier;
  const backlog = backlogStateId(team, cfg);

  const existing = {};
  for (const c of issue.children) {
    const k = markerKey(c.description, feature);
    if (!k) continue;
    if (!known(c.id)) {
      if (!adopt) throw new SlicePlanError(`${c.identifier} carries the slice marker ${feature}/${k} but the daemon did not create it — not adopted. If you created it with aidlc-slices.sh, run: aidlc slices ${feature} --adopt`);
      if (c.state.id !== backlog) throw new SlicePlanError(`${c.identifier} (${k}) is not in the backlog state; refusing to adopt a slice that is already active`);
      remember(c.id, { featureId: issue.id, key: k });
    }
    existing[k] = { id: c.id, identifier: c.identifier };
  }
  for (const k of Object.keys(existing)) if (!plan.slices.some((s) => s.key === k)) log(`warning: ${existing[k].identifier} (${k}) is no longer in the slice plan — left as is`);

  const out = [];
  for (const s of plan.slices) {
    if (existing[s.key]) {
      out.push({ key: s.key, ...existing[s.key], created: false });
      continue;
    }
    const input = { teamId: team.id, parentId: issue.id, stateId: backlog, title: s.title, description: sliceDescription(feature, s) };
    if (issue.project?.id) input.projectId = issue.project.id;
    const created = await linear.createIssue(input);
    remember(created.id, { featureId: issue.id, key: s.key });
    existing[s.key] = created;
    out.push({ key: s.key, id: created.id, identifier: created.identifier, created: true });
  }

  // blockedBy chain: "<blocker> blocks <slice>". Re-read relations so a re-run adds only what is missing.
  const have = new Set();
  for (const c of out) {
    if (!c.created) {
      const full = await linear.issue(c.id);
      for (const r of full.relations) if (r.type === 'blocks') have.add(`${c.id}>${r.relatedIssue.id}`);
    }
  }
  for (const s of plan.slices) {
    for (const b of s.blockedBy ?? []) {
      const pair = `${existing[b].id}>${existing[s.key].id}`;
      if (have.has(pair)) continue;
      await linear.relate(existing[b].id, existing[s.key].id, 'blocks');
      have.add(pair);
    }
  }
  return { unit: false, plan, slices: out };
}
