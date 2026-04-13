import type { Store, StoredEntry, SearchResult } from "./store.js";

export interface LibrarySearchFilters {
  type?: string;
  aidlc_phase?: string;
  tags?: string[];
}

export interface LibrarySearchResult {
  id: string;
  name: string;
  description: string;
  type: string;
  tags: string[];
  aidlc_phases: string[];
  score?: number;
}

export interface LibraryResolveResult {
  agent: string;
  skills: string[];
}

/**
 * Searches the library by semantic similarity (or substring fallback).
 * Returns ranked metadata — never file content.
 */
export async function librarySearch(
  store: Store,
  query: string,
  filters?: LibrarySearchFilters,
  topK = 10
): Promise<LibrarySearchResult[]> {
  const results: SearchResult[] = await store.search(query, filters, topK);
  return results.map(toSearchResult);
}

/**
 * Lists all skills/agents in the library, with optional filtering by type,
 * aidlc_phase, or tags.
 */
export function libraryList(
  store: Store,
  filters?: LibrarySearchFilters
): LibrarySearchResult[] {
  return store.list(filters).map(toSearchResult);
}

/**
 * Resolves an agent ID to its full transitive skill set (depth-2 max).
 *
 * Depth-2 rule: if a required skill itself has `requires`, those are included
 * (one level deep). We do not recurse further to avoid unbounded resolution,
 * consistent with the AIDLC system spec constraint.
 */
export function libraryResolve(
  store: Store,
  agentId: string
): LibraryResolveResult | null {
  const agent = store.getById(agentId);
  if (!agent || agent.type !== "agent") return null;

  const skillSet = new Set<string>();

  // Depth-1: skills declared directly on the agent
  for (const skillId of agent.skills) {
    skillSet.add(skillId);

    // Depth-2: skills declared as `requires` on each of the agent's skills
    const skill = store.getById(skillId);
    if (skill) {
      for (const req of skill.requires) {
        skillSet.add(req);
      }
    }
  }

  return {
    agent: agentId,
    skills: Array.from(skillSet),
  };
}

function toSearchResult(entry: StoredEntry & { score?: number }): LibrarySearchResult {
  return {
    id: entry.id,
    name: entry.name,
    description: entry.description,
    type: entry.type,
    tags: entry.tags,
    aidlc_phases: entry.aidlc_phases,
    ...(entry.score !== undefined ? { score: entry.score } : {}),
  };
}
