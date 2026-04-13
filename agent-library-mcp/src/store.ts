import Database from "better-sqlite3";
import type { IndexedEntry } from "./indexer.js";
import type { Manifest } from "./manifest.js";

export interface StoredEntry {
  id: string;
  name: string;
  description: string;
  type: "skill" | "agent" | "orchestrator";
  aidlc_phases: string[];
  tags: string[];
  requires: string[];
  skills: string[];
}

export interface SearchResult extends StoredEntry {
  score: number;
}

/**
 * Calls the local Ollama HTTP API to produce a float32 embedding for the
 * given text. Returns null if Ollama is unreachable or returns an error.
 */
export async function fetchEmbedding(
  text: string,
  ollamaBaseUrl = "http://localhost:11434",
  model = "nomic-embed-text"
): Promise<number[] | null> {
  try {
    const res = await fetch(`${ollamaBaseUrl}/api/embed`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model, input: text }),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { embeddings?: number[][] };
    return json.embeddings?.[0] ?? null;
  } catch {
    return null;
  }
}

/** Serialises a float array to a raw binary Buffer for SQLite BLOB storage. */
export function float32ToBuffer(values: number[]): Buffer {
  const buf = Buffer.allocUnsafe(values.length * 4);
  for (let i = 0; i < values.length; i++) {
    buf.writeFloatLE(values[i], i * 4);
  }
  return buf;
}

/** Deserialises a raw binary Buffer back to a float32 array. */
export function bufferToFloat32(buf: Buffer): number[] {
  const len = buf.byteLength / 4;
  const result: number[] = new Array(len);
  for (let i = 0; i < len; i++) {
    result[i] = buf.readFloatLE(i * 4);
  }
  return result;
}

/** Cosine similarity between two equal-length vectors. */
export function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let magA = 0;
  let magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  const denom = Math.sqrt(magA) * Math.sqrt(magB);
  return denom === 0 ? 0 : dot / denom;
}

function manifestToStored(id: string, manifest: Manifest): StoredEntry {
  return {
    id,
    name: manifest.name,
    description: manifest.description,
    type: manifest.type,
    aidlc_phases: manifest.aidlc_phases,
    tags: manifest.tags,
    requires: manifest.requires,
    skills:
      manifest.type === "agent"
        ? manifest.skills
        : manifest.type === "orchestrator"
          ? manifest.skills
          : [],
  };
}

/**
 * SQLite-backed metadata store for the skill library.
 *
 * Embeddings are stored as BLOB columns and used for cosine-similarity search
 * when Ollama is available. If Ollama is unavailable the store degrades
 * gracefully: upsert still succeeds (embedding column is left NULL) and
 * `search` falls back to substring matching on name + description + tags.
 */
export class Store {
  private db: Database.Database;
  private readonly ollamaBaseUrl: string;
  private readonly ollamaModel: string;

  constructor(
    dbPath: string,
    ollamaBaseUrl = "http://localhost:11434",
    ollamaModel = "nomic-embed-text"
  ) {
    this.db = new Database(dbPath);
    this.ollamaBaseUrl = ollamaBaseUrl;
    this.ollamaModel = ollamaModel;
    this.migrate();
  }

  private migrate(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS entries (
        id            TEXT PRIMARY KEY,
        name          TEXT NOT NULL,
        description   TEXT NOT NULL,
        type          TEXT NOT NULL,
        aidlc_phases  TEXT NOT NULL,
        tags          TEXT NOT NULL,
        requires      TEXT NOT NULL,
        skills        TEXT NOT NULL,
        embedding     BLOB
      );
    `);
  }

  /** Inserts or replaces a single entry, optionally with an Ollama embedding. */
  async upsert(entry: IndexedEntry): Promise<void> {
    const stored = manifestToStored(entry.id, entry.manifest);
    const embedding = await fetchEmbedding(
      `${stored.name} ${stored.description} ${stored.tags.join(" ")}`,
      this.ollamaBaseUrl,
      this.ollamaModel
    );

    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO entries
        (id, name, description, type, aidlc_phases, tags, requires, skills, embedding)
      VALUES
        (@id, @name, @description, @type, @aidlc_phases, @tags, @requires, @skills, @embedding)
    `);

    stmt.run({
      id: stored.id,
      name: stored.name,
      description: stored.description,
      type: stored.type,
      aidlc_phases: JSON.stringify(stored.aidlc_phases),
      tags: JSON.stringify(stored.tags),
      requires: JSON.stringify(stored.requires),
      skills: JSON.stringify(stored.skills),
      embedding: embedding ? float32ToBuffer(embedding) : null,
    });
  }

  /** Removes an entry by ID. */
  remove(id: string): void {
    this.db.prepare("DELETE FROM entries WHERE id = ?").run(id);
  }

  /** Returns all entries, optionally filtered. */
  list(filters?: {
    type?: string;
    aidlc_phase?: string;
    tags?: string[];
  }): StoredEntry[] {
    const rows = this.db
      .prepare("SELECT * FROM entries")
      .all() as RawRow[];
    return rows.map(rowToStored).filter((e) => matchesFilters(e, filters));
  }

  /** Returns an entry by ID, or null. */
  getById(id: string): StoredEntry | null {
    const row = this.db
      .prepare("SELECT * FROM entries WHERE id = ?")
      .get(id) as RawRow | undefined;
    return row ? rowToStored(row) : null;
  }

  /**
   * Semantic search over the library.
   *
   * If Ollama is available, ranks results by cosine similarity of the query
   * embedding against stored embeddings. Entries without an embedding are
   * ranked below all embedding-ranked entries.
   *
   * Falls back to case-insensitive substring matching on name, description,
   * and tags when Ollama is unavailable or the query embedding cannot be
   * fetched.
   */
  async search(
    query: string,
    filters?: { type?: string; aidlc_phase?: string; tags?: string[] },
    topK = 10
  ): Promise<SearchResult[]> {
    const allEntries = this.list(filters);

    const queryEmbedding = await fetchEmbedding(
      query,
      this.ollamaBaseUrl,
      this.ollamaModel
    );

    if (queryEmbedding) {
      const rows = this.db
        .prepare("SELECT id, embedding FROM entries")
        .all() as { id: string; embedding: Buffer | null }[];

      const scoreMap = new Map<string, number>();
      for (const row of rows) {
        if (!row.embedding) continue;
        const vec = bufferToFloat32(row.embedding);
        scoreMap.set(row.id, cosineSimilarity(queryEmbedding, vec));
      }

      const scored: SearchResult[] = allEntries.map((e) => ({
        ...e,
        score: scoreMap.get(e.id) ?? -1,
      }));
      scored.sort((a, b) => b.score - a.score);
      return scored.slice(0, topK);
    }

    // Fallback: substring match
    const q = query.toLowerCase();
    const matched = allEntries.filter(
      (e) =>
        e.name.toLowerCase().includes(q) ||
        e.description.toLowerCase().includes(q) ||
        e.tags.some((t) => t.toLowerCase().includes(q))
    );
    return matched.slice(0, topK).map((e) => ({ ...e, score: 0 }));
  }

  /** Bulk-upserts all entries from the indexer. */
  async bulkUpsert(entries: IndexedEntry[]): Promise<void> {
    for (const entry of entries) {
      await this.upsert(entry);
    }
  }

  close(): void {
    this.db.close();
  }
}

interface RawRow {
  id: string;
  name: string;
  description: string;
  type: string;
  aidlc_phases: string;
  tags: string;
  requires: string;
  skills: string;
  embedding: Buffer | null;
}

function rowToStored(row: RawRow): StoredEntry {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    type: row.type as "skill" | "agent",
    aidlc_phases: JSON.parse(row.aidlc_phases) as string[],
    tags: JSON.parse(row.tags) as string[],
    requires: JSON.parse(row.requires) as string[],
    skills: JSON.parse(row.skills) as string[],
  };
}

function matchesFilters(
  entry: StoredEntry,
  filters?: { type?: string; aidlc_phase?: string; tags?: string[] }
): boolean {
  if (!filters) return true;
  if (filters.type && entry.type !== filters.type) return false;
  if (filters.aidlc_phase && !entry.aidlc_phases.includes(filters.aidlc_phase))
    return false;
  if (
    filters.tags &&
    filters.tags.length > 0 &&
    !filters.tags.some((t) => entry.tags.includes(t))
  )
    return false;
  return true;
}
