#!/usr/bin/env node
// Manual smoke test with REAL OpenCode and a REAL local model (Linear and GitHub stay mocked):
// the daemon dispatches a Plan gate through `opencode run --standalone --agent aidlc-runner
// --model local/aidlc-strong --session ses_… <prompt>` in a robot lane that carries the P1
// opencode.jsonc template. The phase prompt is overridden to a one-line task so a small model
// answers quickly; what is under test is the plumbing (flags, agent, model alias, session id,
// env, lane, cap, teardown, delegate), not the model.
//
//   AIDLC_SMOKE_BASE_URL=http://127.0.0.1:1235/v1 AIDLC_SMOKE_MODEL=qwen3.8-27b-splash \
//     node docs/templates/aidlc-local/daemon/test/real-opencode.mjs
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseJsonc } from '../lib/util.mjs';
import { HUMAN, world } from './harness.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const base = process.env.AIDLC_SMOKE_BASE_URL || 'http://127.0.0.1:1235/v1';
const model = process.env.AIDLC_SMOKE_MODEL || 'qwen3.8-27b-splash';

const w = await world({ runner: { command: 'opencode', passEnv: [] }, caps: { plan: '15m' } });
try {
  // Consumer repo: the P1 template with real model ids, minus the remote Linear MCP (mocked here).
  const tpl = parseJsonc(fs.readFileSync(path.join(HERE, '..', '..', 'opencode', 'opencode.jsonc'), 'utf8'));
  tpl.providers.local.models['aidlc-strong'].modelID = model;
  tpl.providers.local.models['aidlc-workhorse'].modelID = model;
  delete tpl.mcp;
  delete tpl.worktree;
  tpl.instructions = [];
  const git = (...a) => execFileSync('git', a, { cwd: w.human, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  fs.writeFileSync(path.join(w.human, 'opencode.jsonc'), JSON.stringify(tpl, null, 2));
  git('add', '-A');
  git('-c', 'user.name=t', '-c', 'user.email=t@example.invalid', 'commit', '-qm', 'opencode config');
  git('push', '-q', 'origin', 'HEAD:main');

  fs.mkdirSync(path.join(w.configDir, 'prompts'), { recursive: true });
  fs.writeFileSync(path.join(w.configDir, 'prompts', '_common.md'), 'AIDLC smoke test for {{identifier}}. Reply with exactly the single word OK and nothing else. Do not use any tools.\n');
  fs.writeFileSync(path.join(w.configDir, 'prompts', 'plan.md'), '\n');
  w.secrets.agent.AIDLC_LLM_BASE_URL = base;

  const f = w.feature('Smoke');
  w.mock.move(f.identifier, 'Plan', HUMAN);
  const t0 = Date.now();
  await w.tick();
  const run = [...w.engine.runner.live.values()][0];
  if (!run) throw new Error(`no run dispatched: ${JSON.stringify(w.events().slice(-5))}`);
  console.log(`dispatched: session ${run.sessionId}, lane ${run.lane.path}, delegate=${w.mock.find(f.identifier).delegateId}`);
  await w.engine.runner.idle();
  await w.tick({ full: false });
  const rec = w.store.findIssue(f.identifier);
  const log = fs.readFileSync(rec.lastRun ? w.store.runLog(f.identifier, rec.lastRun.runId) : '/dev/null', 'utf8');
  console.log(`outcome: ${rec.lastRun.outcome} (exit ${rec.lastRun.code}) after ${Math.round((Date.now() - t0) / 1000)}s`);
  console.log(`delegate after: ${w.mock.find(f.identifier).delegateId}; lane removed: ${!fs.existsSync(run.lane.path)}`);
  console.log('--- run log ---\n' + log.split('\n').filter((l) => !/^timestamp=/.test(l)).slice(0, 12).join('\n'));
  const ok = rec.lastRun.outcome === 'ok' && /\bOK\b/.test(log) && w.mock.find(f.identifier).delegateId === null && !fs.existsSync(run.lane.path);
  console.log(ok ? 'SMOKE PASS' : 'SMOKE FAIL');
  process.exitCode = ok ? 0 : 1;
} finally {
  await w.close();
}
