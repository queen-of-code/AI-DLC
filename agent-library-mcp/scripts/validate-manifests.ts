/**
 * Validates all SKILL.md files in the skills/ directory against the manifest schema.
 * Run with: npx tsx scripts/validate-manifests.ts
 */
import { readFileSync, readdirSync, statSync } from "fs";
import { join } from "path";
import { safeParseManifest } from "../src/manifest.js";

type ParseResult = {
  path: string;
  success: boolean;
  errors?: string[];
};

function parseFrontmatter(content: string): Record<string, unknown> | null {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return null;

  const yaml = match[1];
  const result: Record<string, unknown> = {};
  const lines = yaml.split("\n");
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const colonIdx = line.indexOf(":");
    if (colonIdx === -1 || line.trimStart().startsWith("-")) {
      i++;
      continue;
    }

    const key = line.slice(0, colonIdx).trim();
    const rawValue = line.slice(colonIdx + 1).trim();

    if (!key) {
      i++;
      continue;
    }

    // Inline flow sequence: [a, b, c]
    if (rawValue.startsWith("[") && rawValue.endsWith("]")) {
      result[key] = rawValue
        .slice(1, -1)
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      i++;
      continue;
    }

    // Block sequence: key:\n  - item1\n  - item2
    if (rawValue === "") {
      const items: string[] = [];
      i++;
      while (i < lines.length && lines[i].trimStart().startsWith("-")) {
        items.push(lines[i].trimStart().slice(1).trim());
        i++;
      }
      if (items.length > 0) {
        result[key] = items;
      }
      continue;
    }

    if (rawValue === "true") {
      result[key] = true;
    } else if (rawValue === "false") {
      result[key] = false;
    } else if (/^\d+$/.test(rawValue)) {
      result[key] = parseInt(rawValue, 10);
    } else {
      // Strip surrounding quotes
      result[key] = rawValue.replace(/^["']|["']$/g, "");
    }
    i++;
  }

  return result;
}

function findSkillFiles(dir: string): string[] {
  const results: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      results.push(...findSkillFiles(full));
    } else if (entry === "SKILL.md") {
      results.push(full);
    }
  }
  return results;
}

const skillsDir = join(import.meta.dirname, "../../skills");
const files = findSkillFiles(skillsDir);

const results: ParseResult[] = [];

for (const file of files.sort()) {
  const content = readFileSync(file, "utf-8");
  const frontmatter = parseFrontmatter(content);

  if (!frontmatter) {
    results.push({ path: file, success: false, errors: ["No YAML frontmatter found"] });
    continue;
  }

  const parsed = safeParseManifest(frontmatter);
  if (parsed.success) {
    results.push({ path: file, success: true });
  } else {
    results.push({
      path: file,
      success: false,
      errors: parsed.error.issues.map((i) => `  [${i.path.join(".")}] ${i.message}`),
    });
  }
}

const passed = results.filter((r) => r.success);
const failed = results.filter((r) => !r.success);

console.log("\nManifest validation results\n");

for (const r of results) {
  const status = r.success ? "✓" : "✗";
  const relative = r.path.replace(skillsDir + "/", "");
  console.log(`${status}  ${relative}`);
  if (r.errors) {
    for (const e of r.errors) console.log(`   ${e}`);
  }
}

console.log(`\n${passed.length} passed, ${failed.length} failed out of ${results.length} total\n`);

if (failed.length > 0) {
  process.exit(1);
}
