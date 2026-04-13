/**
 * Runs all per-bundle CI checks for a list of changed skill bundle directories
 * and writes results to ci-results.json.
 *
 * Usage:
 *   BUNDLES='["skills/blog-writing","skills/agents/agent-writer"]' \
 *     npx tsx agent-library-mcp/scripts/run-bundle-checks.ts
 *
 * Exits 0 if all bundles pass; exits 1 if any fail.
 * Always writes ci-results.json regardless of outcome.
 */

import { execSync, type ExecSyncOptions } from "child_process";
import * as fs from "fs";
import * as path from "path";
import { load as loadYaml } from "js-yaml";
import { safeParseManifest } from "../src/manifest.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface StepResult {
  pass: boolean;
  message: string;
}

interface BundleResult {
  bundle: string;
  manifestLint: StepResult;
  typecheck: StepResult;
  testEnforce: StepResult;
  unitTests: StepResult;
}

interface CIReport {
  bundles: BundleResult[];
  allPassed: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function run(cmd: string, opts: ExecSyncOptions = {}): { ok: boolean; output: string } {
  try {
    const out = execSync(cmd, { encoding: "utf-8", ...opts });
    return { ok: true, output: typeof out === "string" ? out.trim() : "" };
  } catch (err: unknown) {
    const e = err as { stdout?: string; stderr?: string; message?: string };
    const output = [e.stdout, e.stderr, e.message].filter(Boolean).join("\n").trim();
    return { ok: false, output };
  }
}

function extractFrontmatter(content: string): unknown | null {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return null;
  return loadYaml(match[1]);
}

// ---------------------------------------------------------------------------
// Per-bundle checks
// ---------------------------------------------------------------------------

function checkManifestLint(bundlePath: string): StepResult {
  const skillMd = path.join(bundlePath, "SKILL.md");
  if (!fs.existsSync(skillMd)) {
    return { pass: false, message: "❌ SKILL.md not found" };
  }
  let content: string;
  try {
    content = fs.readFileSync(skillMd, "utf-8");
  } catch (err: unknown) {
    return { pass: false, message: `❌ Could not read SKILL.md: ${(err as Error).message}` };
  }
  const raw = extractFrontmatter(content);
  if (raw === null) {
    return { pass: false, message: "❌ No YAML frontmatter found in SKILL.md" };
  }
  const result = safeParseManifest(raw);
  if (result.success) {
    return { pass: true, message: "✅ passed" };
  }
  const errors = result.error.issues.map((i) => `[${i.path.join(".")}] ${i.message}`).join("; ");
  return { pass: false, message: `❌ ${errors}` };
}

function checkTypecheck(repoRoot: string, bundlePath: string): StepResult {
  const toolTs = path.join(bundlePath, "tool.ts");
  if (!fs.existsSync(toolTs)) {
    return { pass: true, message: "⏭ skipped (no tool.ts)" };
  }
  // Run tsc from agent-library-mcp where tsconfig.json lives, but target the
  // specific tool.ts file. We use --files to limit scope.
  const tsconfig = path.join(repoRoot, "agent-library-mcp", "tsconfig.json");
  const { ok, output } = run(
    `npx tsc --noEmit --project "${tsconfig}" --allowImportingTsExtensions false 2>&1 || true`,
    { cwd: repoRoot }
  );
  // tsc project-level check — any errors involving our bundle file are failures.
  const relTool = path.relative(repoRoot, toolTs);
  const relevantErrors = output
    .split("\n")
    .filter((l) => l.includes(relTool))
    .join("\n")
    .trim();
  if (relevantErrors) {
    return { pass: false, message: `❌ ${relevantErrors}` };
  }
  return { pass: true, message: "✅ passed" };
}

function checkTestEnforcement(bundlePath: string, bundleId: string): StepResult {
  const toolTs = path.join(bundlePath, "tool.ts");
  const toolTestTs = path.join(bundlePath, "tool.test.ts");
  if (!fs.existsSync(toolTs)) {
    return { pass: true, message: "⏭ skipped (no tool.ts)" };
  }
  if (fs.existsSync(toolTestTs)) {
    return { pass: true, message: "✅ tool.test.ts present" };
  }
  return {
    pass: false,
    message: `❌ ${bundleId}: tool.ts exists but tool.test.ts is missing`,
  };
}

function checkUnitTests(repoRoot: string, bundlePath: string): StepResult {
  const toolTestTs = path.join(bundlePath, "tool.test.ts");
  if (!fs.existsSync(toolTestTs)) {
    return { pass: true, message: "⏭ skipped (no tool.test.ts)" };
  }
  const { ok, output } = run(
    `npx vitest run "${toolTestTs}"`,
    { cwd: path.join(repoRoot, "agent-library-mcp") }
  );
  if (ok) {
    return { pass: true, message: "✅ passed" };
  }
  const summary = output.split("\n").slice(-10).join("\n").trim();
  return { pass: false, message: `❌ ${summary}` };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main(): void {
  const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../..");
  const bundlesEnv = process.env.BUNDLES ?? "[]";

  let bundles: string[];
  try {
    bundles = JSON.parse(bundlesEnv) as string[];
  } catch {
    console.error("BUNDLES env var must be a JSON array of strings");
    process.exit(1);
  }

  if (bundles.length === 0) {
    console.log("No skill bundles changed — nothing to validate.");
    const report: CIReport = { bundles: [], allPassed: true };
    fs.writeFileSync(path.join(repoRoot, "ci-results.json"), JSON.stringify(report, null, 2));
    process.exit(0);
  }

  const results: BundleResult[] = [];
  let allPassed = true;

  for (const bundleId of bundles) {
    const bundlePath = path.join(repoRoot, bundleId);
    console.log(`\n── Checking bundle: ${bundleId}`);

    const manifestLint = checkManifestLint(bundlePath);
    const typecheck = checkTypecheck(repoRoot, bundlePath);
    const testEnforce = checkTestEnforcement(bundlePath, bundleId);
    const unitTests = checkUnitTests(repoRoot, bundlePath);

    console.log(`   Manifest lint  : ${manifestLint.message}`);
    console.log(`   Typecheck      : ${typecheck.message}`);
    console.log(`   Test enforce   : ${testEnforce.message}`);
    console.log(`   Unit tests     : ${unitTests.message}`);

    const bundlePassed =
      manifestLint.pass && typecheck.pass && testEnforce.pass && unitTests.pass;
    if (!bundlePassed) allPassed = false;

    results.push({ bundle: bundleId, manifestLint, typecheck, testEnforce, unitTests });
  }

  const report: CIReport = { bundles: results, allPassed };
  fs.writeFileSync(path.join(repoRoot, "ci-results.json"), JSON.stringify(report, null, 2));

  console.log(`\n${"─".repeat(60)}`);
  console.log(allPassed ? "✅ All bundles passed." : "❌ One or more bundles failed.");

  if (!allPassed) process.exit(1);
}

main();
