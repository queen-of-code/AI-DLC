import type { AgentManifest } from "../manifest.js";

/**
 * A fully valid agent manifest fixture.
 */
export const validAgentFixture: AgentManifest = {
  type: "agent",
  name: "researcher",
  description:
    "Explores codebases and external resources to answer questions and gather context.",
  aidlc_phases: ["design", "build", "review"],
  tags: ["research", "exploration"],
  skills: ["typescript-analysis", "api-design"],
  requires: [],
  max_turns: 40,
  timeout_seconds: 180,
  author: "Melissa Benua",
  created_at: "2026-03-07",
  updated_at: "2026-03-07",
};

/**
 * A minimal valid agent manifest (only required fields for an agent).
 */
export const minimalAgentFixture: AgentManifest = {
  type: "agent",
  name: "minimal-agent",
  description: "An agent with only the required fields.",
  aidlc_phases: ["build"],
  tags: [],
  skills: ["git-workflow"],
  requires: [],
};
