# ── Stage 1: build ──────────────────────────────────────────────────────────
FROM node:20-slim AS builder

WORKDIR /build

# Install dependencies first (cached layer)
COPY agent-library-mcp/package.json agent-library-mcp/package-lock.json ./
RUN npm ci

# Compile TypeScript
COPY agent-library-mcp/src ./src
COPY agent-library-mcp/tsconfig.json ./
RUN npm run build

# ── Stage 2: runtime ─────────────────────────────────────────────────────────
FROM node:20-slim AS runtime

ENV NODE_ENV=production

WORKDIR /app

# Install only production dependencies (no devDeps, no tsx, no tsc)
COPY agent-library-mcp/package.json agent-library-mcp/package-lock.json ./
RUN npm ci --omit=dev

# Copy compiled JS from builder
COPY --from=builder /build/dist ./dist

# skills/ is mounted at runtime (read-only); this just documents the mount point
VOLUME ["/skills"]

ENV SKILLS_ROOT=/skills \
    DB_PATH=/data/agent-library.db \
    OLLAMA_BASE_URL=http://ollama:11434 \
    OLLAMA_MODEL=nomic-embed-text \
    PORT=3740

# Persist the SQLite database across container restarts
VOLUME ["/data"]

# node:20-slim already provides a non-root "node" user (uid 1000)
RUN mkdir -p /data && chown -R node:node /app /data
USER node

EXPOSE 3740

CMD ["node", "dist/index.js"]
