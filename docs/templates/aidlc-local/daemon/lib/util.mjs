// Small helpers shared by the daemon modules. No dependencies.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

/** "10m" | "30s" | "2h" | "1d" | 1500 (ms) → milliseconds. */
export function parseDuration(v, fallbackMs) {
  if (v === undefined || v === null || v === '') return fallbackMs;
  if (typeof v === 'number') return v;
  const m = String(v).trim().match(/^(\d+(?:\.\d+)?)\s*(ms|s|m|h|d)?$/);
  if (!m) throw new Error(`bad duration: ${v} (use 30s, 10m, 2h)`);
  const n = Number(m[1]);
  const unit = { ms: 1, s: 1e3, m: 60e3, h: 3600e3, d: 86400e3 }[m[2] || 'ms'];
  return Math.round(n * unit);
}

export function expandHome(p) {
  if (!p) return p;
  return p === '~' ? os.homedir() : p.startsWith('~/') ? path.join(os.homedir(), p.slice(2)) : p;
}

/** Parse JSON that may contain full-line // comments (same rule as opencode.jsonc + aidlc-doctor.sh). */
export function parseJsonc(text, where = 'JSON') {
  const stripped = text.split('\n').filter((l) => !/^\s*\/\//.test(l)).join('\n');
  try {
    return JSON.parse(stripped);
  } catch (e) {
    throw new Error(`${where} does not parse (full-line // comments only, no trailing commas): ${e.message}`);
  }
}

export function readJsonc(file) {
  return parseJsonc(fs.readFileSync(file, 'utf8'), file);
}

/** Write via temp file + rename so a crash never leaves half a state file. */
export function writeFileAtomic(file, data, mode = 0o600) {
  fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
  const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tmp, data, { mode });
  fs.renameSync(tmp, file);
}

/** Minimal glob → RegExp: `**` spans directories, `*` and `?` do not. */
export function globToRegExp(glob) {
  let re = '';
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === '*' && glob[i + 1] === '*') {
      re += '.*';
      i++;
      if (glob[i + 1] === '/') i++;
    } else if (c === '*') re += '[^/]*';
    else if (c === '?') re += '[^/]';
    else re += c.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  }
  return new RegExp(`^${re}$`);
}

export function matchesAny(file, globs) {
  return globs.some((g) => globToRegExp(g).test(file));
}

/** Replace every secret value in text. Used on anything the daemon posts or logs. */
export function redact(text, secrets) {
  let out = String(text ?? '');
  for (const s of secrets) {
    if (s && s.length >= 6) out = out.split(s).join('[REDACTED]');
  }
  return out;
}

export function slugify(s, max = 40) {
  return String(s)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, max)
    .replace(/-+$/, '');
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function isoNow(now = Date.now()) {
  return new Date(now).toISOString();
}

/** Private / loopback addresses only — the manual kick must never listen on a public interface. */
export function isPrivateBind(host) {
  if (!host) return false;
  if (host === 'localhost' || host === '::1') return true;
  if (host === '0.0.0.0' || host === '::' || host === '*') return false;
  const v4 = host.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (v4) {
    const [a, b] = [Number(v4[1]), Number(v4[2])];
    return (
      a === 127 ||
      a === 10 ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 100 && b >= 64 && b <= 127) // CGNAT range used by mesh VPNs (Tailscale)
    );
  }
  return /^f[cd][0-9a-f]{2}:/i.test(host); // IPv6 unique-local
}

/** Parse a KEY=VALUE env file (no interpolation; quotes stripped; # comments). */
export function parseEnvFile(text) {
  const out = {};
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const m = line.match(/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!m) continue;
    let v = m[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    out[m[1]] = v;
  }
  return out;
}

export function tail(text, lines = 30) {
  const all = String(text ?? '').split('\n');
  return all.slice(Math.max(0, all.length - lines)).join('\n');
}
