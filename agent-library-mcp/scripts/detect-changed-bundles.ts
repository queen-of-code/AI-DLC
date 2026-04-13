/**
 * Detects which skill/agent bundle directories have changed files in the
 * current pull request.
 *
 * Reads the list of changed files from stdin (one path per line, as produced
 * by `git diff --name-only`) and emits a newline-separated list of unique
 * bundle directory paths relative to the repo root.
 *
 * A "bundle" is the immediate parent directory of a SKILL.md file under
 * skills/. For example:
 *   skills/blog-writing/SKILL.md  → skills/blog-writing
 *   skills/agents/agent-writer/tool.ts → skills/agents/agent-writer
 *
 * Usage (in CI):
 *   git diff --name-only origin/main...HEAD | npx tsx scripts/detect-changed-bundles.ts
 *
 * Outputs the result as a JSON array to stdout (for easy shell consumption):
 *   ["skills/blog-writing","skills/agents/agent-writer"]
 *
 * Exits 0 always — an empty array is valid (no skills/ files changed).
 */

import * as fs from "fs";
import * as path from "path";
import * as readline from "readline";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const SKILLS_PREFIX = "skills/";

async function main(): Promise<void> {
  const rl = readline.createInterface({ input: process.stdin });

  const bundleDirs = new Set<string>();

  for await (const line of rl) {
    const trimmed = line.trim();
    if (!trimmed.startsWith(SKILLS_PREFIX)) continue;

    // Strip the skills/ prefix and find the bundle root.
    // The bundle root is the first 1-2 path segments under skills/:
    //   skills/blog-writing/SKILL.md          → skills/blog-writing
    //   skills/agents/agent-writer/tool.ts    → skills/agents/agent-writer
    //   skills/external/pptx/SKILL.md         → skills/external/pptx
    //
    // Strategy: walk up from the changed file's directory until we find the
    // directory that directly contains a SKILL.md (or is at depth ≤ 2 under skills/).
    const repoRoot = path.resolve(__dirname, "../..");
    const absPath = path.join(repoRoot, trimmed);
    const dir = path.dirname(absPath);

    const bundleDir = findBundleDir(repoRoot, dir);
    if (bundleDir) {
      bundleDirs.add(bundleDir);
    }
  }

  const result = Array.from(bundleDirs).sort();
  process.stdout.write(JSON.stringify(result) + "\n");
}

/**
 * Walks up from `dir` toward `repoRoot/skills/` and returns the bundle
 * directory (the one that contains or should contain SKILL.md), relative to
 * `repoRoot`. Returns null if the path is not under skills/ or is the
 * skills/ root itself.
 */
function findBundleDir(repoRoot: string, dir: string): string | null {
  const skillsRoot = path.join(repoRoot, "skills");
  const rel = path.relative(skillsRoot, dir);

  // Must be under skills/ and not be skills/ itself
  if (rel.startsWith("..") || rel === "") return null;

  const parts = rel.split(path.sep).filter(Boolean);
  if (parts.length === 0) return null;

  // If a SKILL.md exists in `dir`, that is the bundle root.
  if (fs.existsSync(path.join(dir, "SKILL.md"))) {
    return path.relative(repoRoot, dir).replace(/\\/g, "/");
  }

  // Otherwise, check if we're inside a known bundle (parent has SKILL.md).
  let current = dir;
  while (current !== skillsRoot && current.startsWith(skillsRoot)) {
    if (fs.existsSync(path.join(current, "SKILL.md"))) {
      return path.relative(repoRoot, current).replace(/\\/g, "/");
    }
    current = path.dirname(current);
  }

  // Fall back: use the first 1-2 segment path under skills/.
  // (handles new bundles whose SKILL.md doesn't exist yet in the checkout)
  if (parts.length >= 2 && parts[0] === "agents") {
    // skills/agents/agent-name → 2 segments
    return `skills/${parts[0]}/${parts[1]}`;
  }
  return `skills/${parts[0]}`;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
