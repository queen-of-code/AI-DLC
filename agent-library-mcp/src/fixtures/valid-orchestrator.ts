import type { OrchestratorManifest } from "../manifest.js";

/**
 * A fully valid orchestrator manifest fixture.
 */
export const validOrchestratorFixture: OrchestratorManifest = {
  type: "orchestrator",
  name: "plan-orchestrator",
  description:
    "Owns the Plan phase of the AIDLC. Dispatches specialist agents to research, " +
    "draft, refine, and reality-check a feature spec.",
  aidlc_phases: ["plan"],
  aidlc_phase: "plan",
  tags: ["planning", "orchestration"],
  agents: ["agent-researcher", "agent-product-manager", "agent-product-marketer", "agent-grounding-reviewer"],
  skills: ["spec-management"],
  requires: [],
  max_turns: 120,
  timeout_seconds: 900,
  success_criteria:
    "A complete feature spec exists in scratchpad that follows the product template.",
  author: "Melissa Benua",
  created_at: "2026-03-08",
  updated_at: "2026-03-08",
};

/**
 * A minimal valid orchestrator manifest (only required fields).
 */
export const minimalOrchestratorFixture: OrchestratorManifest = {
  type: "orchestrator",
  name: "minimal-orchestrator",
  description: "An orchestrator with only required fields.",
  aidlc_phases: ["build"],
  aidlc_phase: "build",
  tags: [],
  agents: ["agent-builder"],
  skills: [],
  requires: [],
};
