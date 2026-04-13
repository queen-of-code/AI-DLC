import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { Store } from "./store.js";
import { Indexer } from "./indexer.js";
import { libraryList, librarySearch, libraryResolve } from "./tools.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeTempDb(): string {
  return path.join(os.tmpdir(), `test-agent-lib-${Date.now()}.db`);
}

function makeTempSkillsDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "skills-tools-test-"));
}

const SKILL_BLOG = `---
name: blog-writing
description: Write blog posts in a personal voice.
type: skill
aidlc_phases:
  - plan
tags:
  - writing
  - content
requires: []
---
`;

const SKILL_GIT = `---
name: git-workflow
description: Git commit and branch management standards.
type: skill
aidlc_phases:
  - build
  - review
tags:
  - git
  - workflow
requires: []
---
`;

const SKILL_ARCH = `---
name: architecture
description: Software architecture best practices and design patterns.
type: skill
aidlc_phases:
  - design
  - build
  - review
tags:
  - architecture
  - patterns
requires: []
---
`;

const AGENT_RESEARCHER = `---
name: agent-researcher
description: Explores codebases and external sources to answer questions.
type: agent
aidlc_phases:
  - build
  - review
tags:
  - research
  - exploration
skills:
  - architecture
  - git-workflow
requires: []
max_turns: 10
timeout_seconds: 60
---
`;

const AGENT_WRITER = `---
name: agent-writer
description: Produces documents and structured text output.
type: agent
aidlc_phases:
  - plan
tags:
  - writing
  - documentation
skills:
  - blog-writing
requires: []
max_turns: 20
timeout_seconds: 120
---
`;

function writeFile(dir: string, ...parts: string[]): string {
  const file = path.join(dir, ...parts);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  return file;
}

// ---------------------------------------------------------------------------
// Shared setup: build a Store from fixture skill/agent SKILL.md files
// ---------------------------------------------------------------------------

async function buildFixtureStore(tmpDir: string, dbPath: string): Promise<Store> {
  fs.writeFileSync(writeFile(tmpDir, "blog-writing", "SKILL.md"), SKILL_BLOG);
  fs.writeFileSync(writeFile(tmpDir, "git-workflow", "SKILL.md"), SKILL_GIT);
  fs.writeFileSync(writeFile(tmpDir, "architecture", "SKILL.md"), SKILL_ARCH);
  fs.writeFileSync(
    writeFile(tmpDir, "agents", "agent-researcher", "SKILL.md"),
    AGENT_RESEARCHER
  );
  fs.writeFileSync(
    writeFile(tmpDir, "agents", "agent-writer", "SKILL.md"),
    AGENT_WRITER
  );

  const indexer = new Indexer(tmpDir);
  indexer.index();

  // Use ":memory:" equivalent: a temp file path. Ollama URL set to
  // unreachable endpoint so tests do not depend on a running Ollama instance.
  const store = new Store(dbPath, "http://localhost:99999", "nomic-embed-text");
  await store.bulkUpsert(indexer.getAll());
  return store;
}

// ---------------------------------------------------------------------------
// libraryList
// ---------------------------------------------------------------------------

describe("libraryList", () => {
  let tmpDir: string;
  let dbPath: string;
  let store: Store;

  beforeEach(async () => {
    tmpDir = makeTempSkillsDir();
    dbPath = makeTempDb();
    store = await buildFixtureStore(tmpDir, dbPath);
  });

  afterEach(() => {
    store.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
    if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
  });

  it("returns all fixture entries with no filter", () => {
    const results = libraryList(store);
    expect(results.length).toBe(5);
    const ids = results.map((r) => r.id);
    expect(ids).toContain("blog-writing");
    expect(ids).toContain("git-workflow");
    expect(ids).toContain("architecture");
    expect(ids).toContain("agents/agent-researcher");
    expect(ids).toContain("agents/agent-writer");
  });

  it("filters to only skills when type=skill", () => {
    const results = libraryList(store, { type: "skill" });
    expect(results.every((r) => r.type === "skill")).toBe(true);
    expect(results.length).toBe(3);
  });

  it("filters to only agents when type=agent", () => {
    const results = libraryList(store, { type: "agent" });
    expect(results.every((r) => r.type === "agent")).toBe(true);
    expect(results.length).toBe(2);
  });

  it("filters by aidlc_phase", () => {
    const results = libraryList(store, { aidlc_phase: "plan" });
    const ids = results.map((r) => r.id);
    expect(ids).toContain("blog-writing");
    expect(ids).toContain("agents/agent-writer");
    expect(ids).not.toContain("git-workflow");
  });

  it("filters by tags (OR match)", () => {
    const results = libraryList(store, { tags: ["writing"] });
    const ids = results.map((r) => r.id);
    expect(ids).toContain("blog-writing");
    expect(ids).toContain("agents/agent-writer");
  });

  it("result objects contain expected metadata fields", () => {
    const results = libraryList(store, { type: "skill" });
    const skill = results.find((r) => r.id === "blog-writing")!;
    expect(skill).toBeDefined();
    expect(skill.name).toBe("blog-writing");
    expect(skill.description).toBeTruthy();
    expect(Array.isArray(skill.tags)).toBe(true);
    expect(Array.isArray(skill.aidlc_phases)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// libraryResolve
// ---------------------------------------------------------------------------

describe("libraryResolve", () => {
  let tmpDir: string;
  let dbPath: string;
  let store: Store;

  beforeEach(async () => {
    tmpDir = makeTempSkillsDir();
    dbPath = makeTempDb();
    store = await buildFixtureStore(tmpDir, dbPath);
  });

  afterEach(() => {
    store.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
    if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
  });

  it("returns the agent id and its declared skills", () => {
    const result = libraryResolve(store, "agents/agent-researcher");
    expect(result).not.toBeNull();
    expect(result!.agent).toBe("agents/agent-researcher");
    expect(result!.skills).toContain("architecture");
    expect(result!.skills).toContain("git-workflow");
  });

  it("returns null for a non-existent ID", () => {
    expect(libraryResolve(store, "does-not-exist")).toBeNull();
  });

  it("returns null when given a skill ID (not an agent)", () => {
    expect(libraryResolve(store, "blog-writing")).toBeNull();
  });

  it("returns unique skill IDs (no duplicates)", () => {
    const result = libraryResolve(store, "agents/agent-researcher");
    expect(result).not.toBeNull();
    const unique = new Set(result!.skills);
    expect(unique.size).toBe(result!.skills.length);
  });
});

// ---------------------------------------------------------------------------
// librarySearch (with mocked Ollama)
// ---------------------------------------------------------------------------

describe("librarySearch", () => {
  let tmpDir: string;
  let dbPath: string;
  let store: Store;

  beforeEach(async () => {
    tmpDir = makeTempSkillsDir();
    dbPath = makeTempDb();
    store = await buildFixtureStore(tmpDir, dbPath);
  });

  afterEach(() => {
    store.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
    if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
  });

  it("falls back to substring match when Ollama is unreachable and returns results for 'writing'", async () => {
    const results = await librarySearch(store, "writing");
    expect(results.length).toBeGreaterThan(0);
    const ids = results.map((r) => r.id);
    expect(ids).toContain("blog-writing");
  });

  it("returns empty array when no entries match the query", async () => {
    const results = await librarySearch(store, "zzz-no-match-xyz");
    expect(results.length).toBe(0);
  });

  it("respects top_k limit", async () => {
    const results = await librarySearch(store, "skill", undefined, 2);
    expect(results.length).toBeLessThanOrEqual(2);
  });

  it("applies type filter in conjunction with search", async () => {
    const results = await librarySearch(store, "agent", { type: "agent" });
    expect(results.every((r) => r.type === "agent")).toBe(true);
  });

  it("result objects include score field", async () => {
    const results = await librarySearch(store, "writing");
    for (const r of results) {
      expect(typeof r.score).toBe("number");
    }
  });
});
