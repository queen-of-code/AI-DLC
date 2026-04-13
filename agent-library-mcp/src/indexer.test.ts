import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import {
  extractFrontmatter,
  deriveId,
  parseSkillFile,
  walkSkillsDir,
  Indexer,
} from "./indexer.js";

// ---------------------------------------------------------------------------
// extractFrontmatter
// ---------------------------------------------------------------------------

describe("extractFrontmatter", () => {
  it("returns parsed YAML for valid frontmatter", () => {
    const content = `---
name: test-skill
type: skill
---
# Body text`;
    const result = extractFrontmatter(content);
    expect(result).toMatchObject({ name: "test-skill", type: "skill" });
  });

  it("returns null when there are no frontmatter delimiters", () => {
    expect(extractFrontmatter("No frontmatter here")).toBeNull();
  });

  it("returns null for an empty file", () => {
    expect(extractFrontmatter("")).toBeNull();
  });

  it("handles CRLF line endings", () => {
    const content = "---\r\nname: crlf-skill\r\ntype: skill\r\n---\r\n";
    const result = extractFrontmatter(content);
    expect(result).toMatchObject({ name: "crlf-skill" });
  });
});

// ---------------------------------------------------------------------------
// deriveId
// ---------------------------------------------------------------------------

describe("deriveId", () => {
  it("returns a bare name for a top-level skill", () => {
    const root = "/repo/skills";
    const file = "/repo/skills/blog-writing/SKILL.md";
    expect(deriveId(root, file)).toBe("blog-writing");
  });

  it("returns a path for a nested agent", () => {
    const root = "/repo/skills";
    const file = "/repo/skills/agents/agent-researcher/SKILL.md";
    expect(deriveId(root, file)).toBe("agents/agent-researcher");
  });
});

// ---------------------------------------------------------------------------
// Fixture-based tests using a temporary directory
// ---------------------------------------------------------------------------

function makeTempSkillsDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "skills-test-"));
}

function writeFile(dir: string, ...parts: string[]): string {
  const file = path.join(dir, ...parts);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  return file;
}

const VALID_SKILL_MD = `---
name: blog-writing
description: Write blog posts in Melissa's voice.
type: skill
aidlc_phases:
  - plan
tags:
  - writing
requires: []
---
# Instructions
`;

const VALID_AGENT_MD = `---
name: agent-researcher
description: Explores sources to answer questions.
type: agent
aidlc_phases:
  - build
tags:
  - research
skills:
  - blog-writing
requires: []
max_turns: 10
timeout_seconds: 60
---
`;

const VALID_ORCHESTRATOR_MD = `---
name: plan-orchestrator
description: Owns the Plan phase of the AIDLC.
type: orchestrator
aidlc_phases:
  - plan
aidlc_phase: plan
tags:
  - planning
agents:
  - agent-researcher
  - agent-product-manager
skills:
  - spec-management
requires: []
max_turns: 120
timeout_seconds: 900
---
`;

const INVALID_MANIFEST_MD = `---
type: skill
---
# Missing name and description
`;

// ---------------------------------------------------------------------------
// parseSkillFile
// ---------------------------------------------------------------------------

describe("parseSkillFile", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = makeTempSkillsDir();
  });
  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("parses a valid skill SKILL.md", () => {
    const file = writeFile(tmpDir, "blog-writing", "SKILL.md");
    fs.writeFileSync(file, VALID_SKILL_MD);
    const entry = parseSkillFile(tmpDir, file);
    expect(entry).not.toBeNull();
    expect(entry!.id).toBe("blog-writing");
    expect(entry!.manifest.type).toBe("skill");
    expect(entry!.manifest.name).toBe("blog-writing");
  });

  it("parses a valid agent SKILL.md under agents/", () => {
    const file = writeFile(tmpDir, "agents", "agent-researcher", "SKILL.md");
    fs.writeFileSync(file, VALID_AGENT_MD);
    const entry = parseSkillFile(tmpDir, file);
    expect(entry).not.toBeNull();
    expect(entry!.id).toBe("agents/agent-researcher");
    expect(entry!.manifest.type).toBe("agent");
  });

  it("returns null for a file with an invalid manifest", () => {
    const file = writeFile(tmpDir, "bad-skill", "SKILL.md");
    fs.writeFileSync(file, INVALID_MANIFEST_MD);
    expect(parseSkillFile(tmpDir, file)).toBeNull();
  });

  it("returns null for a non-existent file", () => {
    expect(parseSkillFile(tmpDir, path.join(tmpDir, "nonexistent", "SKILL.md"))).toBeNull();
  });

  it("returns null for a file with no frontmatter", () => {
    const file = writeFile(tmpDir, "no-fm", "SKILL.md");
    fs.writeFileSync(file, "# Just a heading\n\nNo YAML.");
    expect(parseSkillFile(tmpDir, file)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// walkSkillsDir
// ---------------------------------------------------------------------------

describe("walkSkillsDir", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = makeTempSkillsDir();
  });
  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("finds both a top-level skill and a nested agent", () => {
    fs.writeFileSync(writeFile(tmpDir, "blog-writing", "SKILL.md"), VALID_SKILL_MD);
    fs.writeFileSync(
      writeFile(tmpDir, "agents", "agent-researcher", "SKILL.md"),
      VALID_AGENT_MD
    );
    const entries = walkSkillsDir(tmpDir);
    const ids = entries.map((e) => e.id);
    expect(ids).toContain("blog-writing");
    expect(ids).toContain("agents/agent-researcher");
  });

  it("skips invalid manifests and continues walking", () => {
    fs.writeFileSync(writeFile(tmpDir, "bad-skill", "SKILL.md"), INVALID_MANIFEST_MD);
    fs.writeFileSync(writeFile(tmpDir, "blog-writing", "SKILL.md"), VALID_SKILL_MD);
    const entries = walkSkillsDir(tmpDir);
    expect(entries.map((e) => e.id)).toEqual(["blog-writing"]);
  });

  it("returns an empty array for an empty directory", () => {
    expect(walkSkillsDir(tmpDir)).toEqual([]);
  });

  it("ignores files that are not named SKILL.md or ORCHESTRATOR.md", () => {
    fs.writeFileSync(writeFile(tmpDir, "blog-writing", "README.md"), VALID_SKILL_MD);
    expect(walkSkillsDir(tmpDir)).toEqual([]);
  });

  it("indexes ORCHESTRATOR.md files in addition to SKILL.md files", () => {
    fs.writeFileSync(writeFile(tmpDir, "blog-writing", "SKILL.md"), VALID_SKILL_MD);
    fs.writeFileSync(
      writeFile(tmpDir, "orchestrators", "plan", "ORCHESTRATOR.md"),
      VALID_ORCHESTRATOR_MD
    );
    const entries = walkSkillsDir(tmpDir);
    const ids = entries.map((e) => e.id);
    expect(ids).toContain("blog-writing");
    expect(ids).toContain("orchestrators/plan");
    const orchEntry = entries.find((e) => e.id === "orchestrators/plan");
    expect(orchEntry?.manifest.type).toBe("orchestrator");
  });
});

// ---------------------------------------------------------------------------
// Indexer
// ---------------------------------------------------------------------------

describe("Indexer", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = makeTempSkillsDir();
  });
  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("indexes all valid entries on initial scan", () => {
    fs.writeFileSync(writeFile(tmpDir, "blog-writing", "SKILL.md"), VALID_SKILL_MD);
    fs.writeFileSync(
      writeFile(tmpDir, "agents", "agent-researcher", "SKILL.md"),
      VALID_AGENT_MD
    );
    const indexer = new Indexer(tmpDir);
    indexer.index();
    const all = indexer.getAll();
    expect(all.length).toBe(2);
    expect(all.map((e) => e.id)).toContain("blog-writing");
    expect(all.map((e) => e.id)).toContain("agents/agent-researcher");
  });

  it("getById returns the correct entry", () => {
    fs.writeFileSync(writeFile(tmpDir, "blog-writing", "SKILL.md"), VALID_SKILL_MD);
    const indexer = new Indexer(tmpDir);
    indexer.index();
    const entry = indexer.getById("blog-writing");
    expect(entry).not.toBeUndefined();
    expect(entry!.manifest.name).toBe("blog-writing");
  });

  it("getById returns undefined for unknown id", () => {
    const indexer = new Indexer(tmpDir);
    indexer.index();
    expect(indexer.getById("does-not-exist")).toBeUndefined();
  });
});
