import * as fs from "fs";
import * as path from "path";
import yaml from "js-yaml";
const parseYaml = yaml.load.bind(yaml);
import { watch } from "chokidar";
import { safeParseManifest, type Manifest } from "./manifest.js";

export interface IndexedEntry {
  id: string;
  path: string;
  manifest: Manifest;
}

export type ChangeEvent =
  | { type: "added"; entry: IndexedEntry }
  | { type: "updated"; entry: IndexedEntry }
  | { type: "removed"; id: string };

export type ChangeListener = (event: ChangeEvent) => void;

/**
 * Extracts the YAML frontmatter block from a markdown file's string content.
 * Returns null if no frontmatter delimiters are found.
 */
export function extractFrontmatter(content: string): unknown | null {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return null;
  return parseYaml(match[1]);
}

/**
 * Derives a stable ID for a skill, agent, or orchestrator from its manifest path
 * relative to the skills root. Examples:
 *   skills/blog-writing/SKILL.md        → "blog-writing"
 *   skills/agents/agent-writer/SKILL.md → "agents/agent-writer"
 *   orchestrators/plan/ORCHESTRATOR.md  → "orchestrators/plan"
 */
export function deriveId(skillsRoot: string, skillMdPath: string): string {
  const rel = path.relative(skillsRoot, path.dirname(skillMdPath));
  return rel.replace(/\\/g, "/");
}

/** File names that are treated as manifest files. */
const MANIFEST_FILE_NAMES = new Set(["SKILL.md", "ORCHESTRATOR.md"]);

/**
 * Parses a single SKILL.md file and returns an IndexedEntry, or null if the
 * file does not exist, contains no valid frontmatter, or the manifest is
 * invalid per the Zod schema.
 */
export function parseSkillFile(
  skillsRoot: string,
  skillMdPath: string
): IndexedEntry | null {
  let content: string;
  try {
    content = fs.readFileSync(skillMdPath, "utf-8");
  } catch {
    return null;
  }

  const raw = extractFrontmatter(content);
  if (raw === null) return null;

  const result = safeParseManifest(raw);
  if (!result.success) return null;

  return {
    id: deriveId(skillsRoot, skillMdPath),
    path: skillMdPath,
    manifest: result.data,
  };
}

/**
 * Walks the skills directory tree synchronously and returns all valid entries.
 * Recurses into all subdirectories looking for SKILL.md files.
 */
export function walkSkillsDir(skillsRoot: string): IndexedEntry[] {
  const entries: IndexedEntry[] = [];

  function walk(dir: string): void {
    let items: fs.Dirent[];
    try {
      items = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const item of items) {
      const full = path.join(dir, item.name);
      if (item.isDirectory()) {
        walk(full);
      } else if (item.isFile() && MANIFEST_FILE_NAMES.has(item.name)) {
        const entry = parseSkillFile(skillsRoot, full);
        if (entry) entries.push(entry);
      }
    }
  }

  walk(skillsRoot);
  return entries;
}

/**
 * The Indexer maintains an in-memory map of all valid skill/agent entries
 * found in the skills directory. It can optionally watch for filesystem
 * changes and notify listeners.
 */
export class Indexer {
  private readonly skillsRoot: string;
  private entries: Map<string, IndexedEntry> = new Map();
  private listeners: ChangeListener[] = [];
  private watcher: ReturnType<typeof watch> | null = null;

  constructor(skillsRoot: string) {
    this.skillsRoot = path.resolve(skillsRoot);
  }

  /** Performs the initial scan of the skills directory. */
  index(): void {
    const found = walkSkillsDir(this.skillsRoot);
    this.entries.clear();
    for (const entry of found) {
      this.entries.set(entry.id, entry);
    }
  }

  /** Returns all currently indexed entries. */
  getAll(): IndexedEntry[] {
    return Array.from(this.entries.values());
  }

  /** Returns a single entry by ID, or undefined if not found. */
  getById(id: string): IndexedEntry | undefined {
    return this.entries.get(id);
  }

  /** Registers a listener that is notified on add/update/remove events. */
  onChange(listener: ChangeListener): void {
    this.listeners.push(listener);
  }

  private emit(event: ChangeEvent): void {
    for (const l of this.listeners) l(event);
  }

  /**
   * Starts a filesystem watcher. Only call after `index()`.
   * Re-parses SKILL.md files when they change and emits structured events.
   */
  watch(): void {
    if (this.watcher) return;

    const patterns = [
      path.join(this.skillsRoot, "**/SKILL.md"),
      path.join(this.skillsRoot, "**/ORCHESTRATOR.md"),
    ];
    this.watcher = watch(patterns, { ignoreInitial: true, persistent: false });

    const handleAddOrChange = (filePath: string) => {
      const entry = parseSkillFile(this.skillsRoot, filePath);
      if (!entry) return;
      const existing = this.entries.get(entry.id);
      this.entries.set(entry.id, entry);
      this.emit(existing ? { type: "updated", entry } : { type: "added", entry });
    };

    const handleRemove = (filePath: string) => {
      const id = deriveId(this.skillsRoot, filePath);
      if (this.entries.has(id)) {
        this.entries.delete(id);
        this.emit({ type: "removed", id });
      }
    };

    this.watcher.on("add", handleAddOrChange);
    this.watcher.on("change", handleAddOrChange);
    this.watcher.on("unlink", handleRemove);
  }

  /** Stops the filesystem watcher. */
  async close(): Promise<void> {
    if (this.watcher) {
      await this.watcher.close();
      this.watcher = null;
    }
  }
}
