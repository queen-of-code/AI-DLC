# agent-library-mcp

MCP discovery index for the **AI-DLC** skill and agent library. Returns IDs and metadata — never file content, never executes code. Consumers that embed this library keep a local cache and resolve content from it.

## Tools

| Tool | Description |
|------|-------------|
| `library_search` | Semantic search by task description. Returns ranked metadata. |
| `library_list` | List all skills/agents, filterable by `type`, `aidlc_phase`, `tags`. |
| `library_resolve` | Given an agent ID, return its full transitive skill set (depth-2 max). |

## Quickstart (Docker Compose)

```bash
# From the repo root — starts agent-library-mcp
# Ollama is expected on the host machine at port 11434
docker compose up -d agent-library-mcp

# Health check
curl http://localhost:3740/health
# → {"status":"ok","entries":21}
```

The compose file defaults `OLLAMA_BASE_URL` to `http://host.docker.internal:11434`,
which resolves to the host machine running Docker (i.e. andromeda). Override via `.env`:

```bash
# .env (repo root) — only needed to override defaults
OLLAMA_BASE_URL=http://some-other-host:11434
OLLAMA_MODEL=nomic-embed-text
```

## Connect from Cursor / Claude

Add to your `mcp.json` (see `mcp/mcp.json.example`):

```json
{
  "mcpServers": {
    "agent-library": {
      "url": "http://localhost:3740"
    }
  }
}
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `SKILLS_ROOT` | `../../skills` (relative to `dist/`) | Path to the skills directory to index |
| `DB_PATH` | `agent-library.db` next to `dist/` | SQLite database path |
| `OLLAMA_BASE_URL` | `http://localhost:11434` | Ollama API base URL |
| `OLLAMA_MODEL` | `nomic-embed-text` | Embedding model name |
| `PORT` | `3740` | HTTP port to listen on |

When Ollama is unreachable, the server starts and runs normally — `library_search` falls back to substring matching on name, description, and tags.

## Development

```bash
cd agent-library-mcp

# Install dependencies
npm install

# Run tests
npm test

# Type-check
npm run typecheck

# Start locally (requires a build first)
npm run build && npm start

# Validate all SKILL.md manifests
npm run validate-manifests
```

## Architecture

```
Orchestrator
  │
  ├── library_search("analyze TypeScript") → [{ id: "agents/agent-reviewer", ... }]
  ├── library_resolve("agents/agent-reviewer") → { agent, skills: ["git-workflow", ...] }
  └── reads SKILL.md content for each ID from its local skills/ cache

agent-library-mcp (this server)
  ├── indexer.ts   — walks skills/, parses SKILL.md, watches for changes
  ├── store.ts     — SQLite metadata + Ollama cosine-similarity search
  ├── tools.ts     — library_search / library_list / library_resolve logic
  └── index.ts     — McpServer over StreamableHTTP
```
