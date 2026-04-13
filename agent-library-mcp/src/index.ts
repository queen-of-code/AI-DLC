import * as http from "http";
import * as path from "path";
import * as url from "url";
import { randomUUID } from "crypto";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";
import { Indexer } from "./indexer.js";
import { Store } from "./store.js";
import { librarySearch, libraryList, libraryResolve } from "./tools.js";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const SKILLS_ROOT = process.env.SKILLS_ROOT ?? path.resolve(__dirname, "../../skills");
const DB_PATH = process.env.DB_PATH ?? path.resolve(__dirname, "../agent-library.db");
const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL ?? "http://localhost:11434";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL ?? "nomic-embed-text";
const PORT = Number(process.env.PORT ?? 3740);

/** Creates and wires up a new McpServer with all three library tools. */
function createMcpServer(store: Store): McpServer {
  const server = new McpServer({
    name: "agent-library-mcp",
    version: "0.1.0",
  });

  server.registerTool(
    "library_search",
    {
      description:
        "Semantic search over the skill/agent library. Returns ranked metadata — never file content.",
      inputSchema: {
        query: z.string().describe("Natural-language task description to search for"),
        type: z.enum(["skill", "agent"]).optional().describe("Filter by skill or agent"),
        aidlc_phase: z
          .enum(["discover", "plan", "design", "build", "review", "deploy"])
          .optional()
          .describe("Filter by AIDLC phase"),
        tags: z.array(z.string()).optional().describe("Filter by tags (OR match)"),
        top_k: z
          .number()
          .int()
          .positive()
          .optional()
          .describe("Max results to return (default 10)"),
      },
    },
    async (args) => {
      const results = await librarySearch(
        store,
        args.query,
        { type: args.type, aidlc_phase: args.aidlc_phase, tags: args.tags },
        args.top_k ?? 10
      );
      return { content: [{ type: "text", text: JSON.stringify(results, null, 2) }] };
    }
  );

  server.registerTool(
    "library_list",
    {
      description:
        "List all skills and agents in the library, with optional filtering. Returns metadata only.",
      inputSchema: {
        type: z.enum(["skill", "agent"]).optional().describe("Filter by type"),
        aidlc_phase: z
          .enum(["discover", "plan", "design", "build", "review", "deploy"])
          .optional()
          .describe("Filter to entries available in this AIDLC phase"),
        tags: z.array(z.string()).optional().describe("Filter by tags (OR match)"),
      },
    },
    (args) => {
      const results = libraryList(store, {
        type: args.type,
        aidlc_phase: args.aidlc_phase,
        tags: args.tags,
      });
      return { content: [{ type: "text", text: JSON.stringify(results, null, 2) }] };
    }
  );

  server.registerTool(
    "library_resolve",
    {
      description:
        "Given an agent ID, returns the agent plus its full transitive skill set (depth-2 max). The orchestrator uses this to assemble its session context from the local cache.",
      inputSchema: {
        id: z.string().describe("Agent ID to resolve (e.g. 'agents/agent-researcher')"),
      },
    },
    (args) => {
      const result = libraryResolve(store, args.id);
      if (!result) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                error: `Agent '${args.id}' not found or is not an agent type`,
              }),
            },
          ],
          isError: true,
        };
      }
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );

  return server;
}

async function main(): Promise<void> {
  const indexer = new Indexer(SKILLS_ROOT);
  indexer.index();

  const store = new Store(DB_PATH, OLLAMA_BASE_URL, OLLAMA_MODEL);
  await store.bulkUpsert(indexer.getAll());

  indexer.onChange(async (event) => {
    if (event.type === "removed") {
      store.remove(event.id);
    } else {
      await store.upsert(event.entry);
    }
  });
  indexer.watch();

  // Session map: sessionId → { server, transport }
  // A new session is created on the first (initialize) request (no mcp-session-id header).
  // Subsequent requests from the same client carry the session ID and reuse the pair.
  const sessions = new Map<
    string,
    { server: McpServer; transport: StreamableHTTPServerTransport }
  >();

  const httpServer = http.createServer(async (req, res) => {
    if (req.method === "GET" && req.url === "/health") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ status: "ok", entries: indexer.getAll().length }));
      return;
    }

    const existingSessionId = req.headers["mcp-session-id"] as string | undefined;

    if (existingSessionId && sessions.has(existingSessionId)) {
      // Route to existing session
      const session = sessions.get(existingSessionId)!;
      await session.transport.handleRequest(req, res);
      return;
    }

    // New session — create a fresh server + transport pair
    const mcpServer = createMcpServer(store);
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
      onsessioninitialized: (sessionId) => {
        sessions.set(sessionId, { server: mcpServer, transport });
      },
    });

    // Clean up session when transport closes
    transport.onclose = () => {
      const sid = transport.sessionId;
      if (sid) sessions.delete(sid);
    };

    await mcpServer.server.connect(transport);
    await transport.handleRequest(req, res);
  });

  httpServer.listen(PORT, () => {
    console.log(`agent-library-mcp listening on http://localhost:${PORT}`);
    console.log(`  Skills root : ${SKILLS_ROOT}`);
    console.log(`  DB path     : ${DB_PATH}`);
    console.log(`  Ollama      : ${OLLAMA_BASE_URL} (${OLLAMA_MODEL})`);
    console.log(`  Entries     : ${indexer.getAll().length}`);
  });

  const shutdown = async () => {
    await indexer.close();
    store.close();
    httpServer.close(() => process.exit(0));
  };
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
