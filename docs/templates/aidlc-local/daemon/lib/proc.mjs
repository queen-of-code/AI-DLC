// Child processes the daemon starts on behalf of untrusted code: agent runs, check re-runs, slice
// validation. All of them get an env built from scratch (secrets.mjs) and, when `runner.runAs` is set,
// run as a separate OS user so they cannot read the daemon's key file or state dir.
import { spawn } from 'node:child_process';
import fs from 'node:fs';

/** Wrap argv to run as another user. Needs a sudoers rule; see docs/OPENCODE-LOCAL.md → Separate OS user. */
export function asUser(runAs, argv, env) {
  if (!runAs) return argv;
  return ['sudo', '-n', '-u', runAs, `--preserve-env=${Object.keys(env).join(',')}`, '--', ...argv];
}

/**
 * Start a process in its own process group (so a wall-clock kill takes the whole tree).
 * Returns { child, done: Promise<{ code, signal, timedOut }>, stop(reason) }.
 */
export function startProcess({ argv, cwd, env, logFile, timeoutMs, killGraceMs = 30e3, runAs = '' }) {
  const full = asUser(runAs, argv, env);
  const out = logFile ? fs.openSync(logFile, 'a', 0o600) : 'ignore';
  const child = spawn(full[0], full.slice(1), { cwd, env, detached: true, stdio: ['ignore', out, out] });
  let timedOut = false;
  let stoppedFor = null;
  const kill = (sig) => {
    try {
      process.kill(-child.pid, sig);
    } catch {
      try {
        child.kill(sig);
      } catch {
        /* already gone */
      }
    }
  };
  const stop = (reason = 'stopped') => {
    if (stoppedFor || child.exitCode !== null) return;
    stoppedFor = reason;
    kill('SIGTERM');
    setTimeout(() => kill('SIGKILL'), killGraceMs).unref();
  };
  const timer = timeoutMs
    ? setTimeout(() => {
        timedOut = true;
        stop('timeout');
      }, timeoutMs)
    : null;
  timer?.unref?.();
  const done = new Promise((resolve) => {
    const finish = (code, signal) => {
      if (timer) clearTimeout(timer);
      if (typeof out === 'number') fs.closeSync(out);
      resolve({ code, signal, timedOut, stoppedFor });
    };
    child.on('error', (e) => {
      if (logFile) fs.appendFileSync(logFile, `\n[aidlc-daemon] failed to start ${full[0]}: ${e.message}\n`);
      finish(127, null);
    });
    child.on('exit', finish);
  });
  return { child, done, stop };
}

/** Run a shell command to completion, capturing output (bounded). */
export async function runShell({ command, cwd, env, timeoutMs, logFile, runAs = '', killGraceMs = 10e3 }) {
  const p = startProcess({ argv: ['/bin/sh', '-c', command], cwd, env, logFile, timeoutMs, killGraceMs, runAs });
  const r = await p.done;
  const output = logFile && fs.existsSync(logFile) ? fs.readFileSync(logFile, 'utf8').slice(-20000) : '';
  return { ...r, output };
}
