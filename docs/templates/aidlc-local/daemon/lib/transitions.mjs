// transitions.json — the plan §4 table, mechanized. Rows are keyed on (issue kind, state, event).
// The file chooses WHICH built-in action runs; it cannot invent actions, and the ceiling rule below is
// enforced in code, so no edit to the file can make the daemon satisfy a human gate.
import fs from 'node:fs';
import { PHASES, STATE_KEYS } from './config.mjs';
import { parseJsonc } from './util.mjs';

export const KINDS = ['feature', 'unit', 'slice'];
export const EVENTS = ['enter', 'comment', 'answer', 'pr.ready', 'pr.merged', 'run.exited', 'children.done'];
export const ACTORS = ['human', 'daemon', 'any'];
export const LANES = ['base', 'branch', 'pr-head', 'merge-sha', 'merged-main'];
export const OUTCOMES = ['ok', 'failed', 'timeout', 'question', 'stopped'];

/**
 * Ceiling rule (invariants §2.2, §2.4): states a machine move may never enter, per kind.
 * Feature/unit gates (Plan, Design, Build+Test, Done) are human state moves. A slice's
 * Build+Test entry is a release (`releaseNext`) or a human bounce — never a plain `move`.
 */
export const MACHINE_FORBIDDEN = {
  feature: ['triage', 'plan', 'design', 'build', 'done', 'canceled'],
  unit: ['triage', 'plan', 'design', 'build', 'done', 'canceled'],
  slice: ['triage', 'plan', 'design', 'build', 'canceled'],
};

const ACTIONS = {
  dispatch: (v, a) => (PHASES.includes(v) ? (a.lane && !LANES.includes(a.lane) ? `lane must be one of ${LANES.join(', ')}` : null) : `dispatch: unknown phase ${v}`),
  resume: (v) => (['session', 'fresh'].includes(v) ? null : 'resume must be "session" or "fresh"'),
  move: (v) => (STATE_KEYS.includes(v) ? null : `move: unknown state key ${v}`),
  verifyChecks: (v, a) =>
    ['pr-head', 'merge-sha', 'merged-main'].includes(v)
      ? a.require && !['green', 'completed'].includes(a.require)
        ? 'verifyChecks.require must be green or completed'
        : null
      : 'verifyChecks must be pr-head, merge-sha or merged-main',
  createSlices: () => null,
  releaseNext: () => null,
  validateSlice: () => null,
  bounce: () => null,
  requireScorecard: () => null,
  learnGate: () => null,
  flag: (v) => (typeof v === 'string' ? null : 'flag takes a message template'),
  comment: (v) => (typeof v === 'string' ? null : 'comment takes a message template'),
  cleanup: () => null,
};

const asList = (v) => (v === undefined || v === '*' ? null : Array.isArray(v) ? v : [v]);

export function validateTransitions(doc) {
  const errs = [];
  if (doc?.version !== 1) errs.push('version must be 1');
  if (!Array.isArray(doc?.rows)) return [...errs, 'rows must be a list'];
  doc.rows.forEach((r, i) => {
    const at = `row ${i} (${[r.kind, r.state, r.event].join(', ')})`;
    for (const k of asList(r.kind) ?? []) if (!KINDS.includes(k)) errs.push(`${at}: unknown kind ${k}`);
    for (const s of asList(r.state) ?? []) if (!STATE_KEYS.includes(s)) errs.push(`${at}: unknown state ${s}`);
    for (const s of asList(r.from) ?? []) if (!STATE_KEYS.includes(s)) errs.push(`${at}: unknown from-state ${s}`);
    if (!EVENTS.includes(r.event)) errs.push(`${at}: unknown event ${r.event}`);
    if (r.actor && !ACTORS.includes(r.actor)) errs.push(`${at}: actor must be human, daemon or any`);
    for (const o of asList(r.outcome) ?? []) if (!OUTCOMES.includes(o)) errs.push(`${at}: unknown outcome ${o}`);
    if (!Array.isArray(r.do) || !r.do.length) errs.push(`${at}: "do" must be a non-empty list`);
    for (const a of r.do ?? []) {
      const names = Object.keys(a).filter((k) => k in ACTIONS);
      if (names.length !== 1) {
        errs.push(`${at}: each action needs exactly one of ${Object.keys(ACTIONS).join(', ')} (got ${Object.keys(a).join(', ') || 'nothing'})`);
        continue;
      }
      const e = ACTIONS[names[0]](a[names[0]], a);
      if (e) errs.push(`${at}: ${e}`);
      if (names[0] === 'move') {
        for (const k of asList(r.kind) ?? KINDS) {
          if (MACHINE_FORBIDDEN[k]?.includes(a.move)) errs.push(`${at}: ceiling rule — the daemon may never move a ${k} into ${a.move} (a human gate)`);
        }
      }
      if (names[0] === 'dispatch' && a.dispatch === 'build' && (asList(r.kind) ?? KINDS).includes('feature')) {
        errs.push(`${at}: an umbrella Feature never builds — dispatch build only for slice or unit`);
      }
    }
  });
  return errs;
}

export function loadTransitions(file) {
  const doc = parseJsonc(fs.readFileSync(file, 'utf8'), file);
  const errs = validateTransitions(doc);
  if (errs.length) throw new Error(`${file} is invalid:\n  ${errs.join('\n  ')}`);
  return doc;
}

const hit = (list, v) => list === null || list.includes(v);

/** All rows matching the event, in file order. */
export function match(doc, { kind, state, event, actor, from, outcome }) {
  return doc.rows.filter(
    (r) =>
      r.event === event &&
      hit(asList(r.kind), kind) &&
      hit(asList(r.state), state) &&
      (!r.actor || r.actor === 'any' || r.actor === actor) &&
      (r.from === undefined || hit(asList(r.from), from)) &&
      (r.outcome === undefined || hit(asList(r.outcome), outcome)),
  );
}
