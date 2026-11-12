// Phase prompts (local variants of scripts/prompts/). `opencode run` has no --command flag, so the
// daemon sends the phase prompt as the message and binds agent + model on the command line.
// Override any template by dropping <configDir>/prompts/<name>.md next to config.jsonc.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const BUILTIN = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'prompts');
const NAMES = { plan: 'Plan', design: 'Design', build: 'Build + Test', review: 'Review', ship: 'Validate (/ship)', learn: 'Learn' };

function template(configDir, name) {
  const custom = configDir && path.join(configDir, 'prompts', `${name}.md`);
  return fs.readFileSync(custom && fs.existsSync(custom) ? custom : path.join(BUILTIN, `${name}.md`), 'utf8');
}

const fill = (t, vars) => t.replace(/\{\{(\w+)\}\}/g, (_, k) => (vars[k] === undefined || vars[k] === null ? '' : String(vars[k])));

/** `name` picks a variant template (e.g. `ship-slice`); it defaults to the phase. */
export function renderPrompt(configDir, phase, vars, name = phase) {
  const v = { phase, phaseName: NAMES[phase], ...vars };
  const body = fill(template(configDir, name), v).replace(/\n{3,}/g, '\n\n').trim();
  return fill(template(configDir, '_common'), { ...v, context: `\n## This phase\n\n${body}\n` }).replace(/\n{3,}/g, '\n\n').trim() + '\n';
}

export function resumePrompt(answer, ownerMention) {
  return [
    'A human answered your **AIDLC question** on the issue. Their reply:',
    '',
    '> ' + String(answer).split('\n').join('\n> '),
    '',
    `Read it, then continue the same phase from where you halted. The hard stops still apply. If you need to ask again, post one new \`**AIDLC question**\` comment @mentioning ${ownerMention} and stop.`,
  ].join('\n');
}
