import { describe, it, expect } from "vitest";
import { parseManifest, safeParseManifest } from "./manifest.js";
import { validSkillFixture, minimalSkillFixture } from "./fixtures/valid-skill.js";
import { validAgentFixture, minimalAgentFixture } from "./fixtures/valid-agent.js";
import { validOrchestratorFixture, minimalOrchestratorFixture } from "./fixtures/valid-orchestrator.js";
import {
  skillWithSkillsFieldFixture,
  unknownTypeFixture,
  missingNameFixture,
  missingDescriptionFixture,
  missingPhasesFixture,
  agentWithNoSkillsFixture,
  invalidPhaseFixture,
} from "./fixtures/invalid-manifests.js";

describe("manifest schema -- valid skills", () => {
  it("accepts a fully populated valid skill manifest", () => {
    const result = safeParseManifest(validSkillFixture);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.type).toBe("skill");
      expect(result.data.name).toBe("blog-writing");
    }
  });

  it("accepts a minimal skill manifest with only required fields", () => {
    const result = safeParseManifest(minimalSkillFixture);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.type).toBe("skill");
    }
  });

  it("parseManifest returns a typed manifest for a valid skill", () => {
    const manifest = parseManifest(validSkillFixture);
    expect(manifest.type).toBe("skill");
    expect(manifest.name).toBe("blog-writing");
  });

  it("defaults tags to an empty array when omitted", () => {
    const raw = {
      type: "skill",
      name: "no-tags",
      description: "Skill without explicit tags.",
      aidlc_phases: ["build"],
      requires: [],
    };
    const result = safeParseManifest(raw);
    expect(result.success).toBe(true);
    if (result.success && result.data.type === "skill") {
      expect(result.data.tags).toEqual([]);
    }
  });

  it("defaults requires to an empty array when omitted", () => {
    const raw = {
      type: "skill",
      name: "no-requires",
      description: "Skill without explicit requires.",
      aidlc_phases: ["build"],
    };
    const result = safeParseManifest(raw);
    expect(result.success).toBe(true);
    if (result.success && result.data.type === "skill") {
      expect(result.data.requires).toEqual([]);
    }
  });
});

describe("manifest schema -- valid agents", () => {
  it("accepts a fully populated valid agent manifest", () => {
    const result = safeParseManifest(validAgentFixture);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.type).toBe("agent");
      expect(result.data.name).toBe("researcher");
    }
  });

  it("accepts a minimal agent manifest with only required fields", () => {
    const result = safeParseManifest(minimalAgentFixture);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.type).toBe("agent");
    }
  });

  it("accepts an agent with max_turns and timeout_seconds", () => {
    const result = safeParseManifest(validAgentFixture);
    expect(result.success).toBe(true);
    if (result.success && result.data.type === "agent") {
      expect(result.data.max_turns).toBe(40);
      expect(result.data.timeout_seconds).toBe(180);
    }
  });
});

describe("manifest schema -- valid orchestrators", () => {
  it("accepts a fully populated valid orchestrator manifest", () => {
    const result = safeParseManifest(validOrchestratorFixture);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.type).toBe("orchestrator");
      expect(result.data.name).toBe("plan-orchestrator");
    }
  });

  it("accepts a minimal orchestrator manifest", () => {
    const result = safeParseManifest(minimalOrchestratorFixture);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.type).toBe("orchestrator");
    }
  });

  it("accepts an orchestrator with max_turns, timeout_seconds, and success_criteria", () => {
    const result = safeParseManifest(validOrchestratorFixture);
    expect(result.success).toBe(true);
    if (result.success && result.data.type === "orchestrator") {
      expect(result.data.max_turns).toBe(120);
      expect(result.data.timeout_seconds).toBe(900);
      expect(result.data.success_criteria).toContain("feature spec");
    }
  });

  it("rejects an orchestrator with no agents declared", () => {
    const result = safeParseManifest({
      type: "orchestrator",
      name: "empty-orchestrator",
      description: "An orchestrator that declares no agents.",
      aidlc_phases: ["plan"],
      aidlc_phase: "plan",
      agents: [],
    });
    expect(result.success).toBe(false);
  });

  it("rejects an orchestrator with no aidlc_phase", () => {
    const result = safeParseManifest({
      type: "orchestrator",
      name: "no-phase-orchestrator",
      description: "An orchestrator without aidlc_phase.",
      aidlc_phases: ["plan"],
      agents: ["agent-builder"],
    });
    expect(result.success).toBe(false);
  });

  it("parseManifest returns a typed orchestrator for a valid orchestrator manifest", () => {
    const manifest = parseManifest(validOrchestratorFixture);
    expect(manifest.type).toBe("orchestrator");
    if (manifest.type === "orchestrator") {
      expect(manifest.aidlc_phase).toBe("plan");
      expect(manifest.agents).toContain("agent-researcher");
    }
  });
});

describe("manifest schema -- rejection: skill with skills field", () => {
  it("rejects a skill manifest that declares a skills field", () => {
    const result = safeParseManifest(skillWithSkillsFieldFixture);
    expect(result.success).toBe(false);
  });

  it("parseManifest throws for a skill with a skills field", () => {
    expect(() => parseManifest(skillWithSkillsFieldFixture)).toThrow();
  });
});

describe("manifest schema -- rejection: missing required fields", () => {
  it("rejects a manifest with missing name", () => {
    const result = safeParseManifest(missingNameFixture);
    expect(result.success).toBe(false);
  });

  it("rejects a manifest with missing description", () => {
    const result = safeParseManifest(missingDescriptionFixture);
    expect(result.success).toBe(false);
  });

  it("rejects a manifest with missing aidlc_phases", () => {
    const result = safeParseManifest(missingPhasesFixture);
    expect(result.success).toBe(false);
  });

  it("rejects an agent with an empty skills array", () => {
    const result = safeParseManifest(agentWithNoSkillsFixture);
    expect(result.success).toBe(false);
  });
});

describe("manifest schema -- rejection: unknown type value", () => {
  it("rejects a manifest with an unknown type", () => {
    const result = safeParseManifest(unknownTypeFixture);
    expect(result.success).toBe(false);
  });
});

describe("manifest schema -- rejection: invalid aidlc_phases value", () => {
  it("rejects a manifest with an unrecognised aidlc_phase", () => {
    const result = safeParseManifest(invalidPhaseFixture);
    expect(result.success).toBe(false);
  });
});

describe("manifest schema -- error messages", () => {
  it("includes a useful error message when skills is declared on a skill type", () => {
    const result = safeParseManifest(skillWithSkillsFieldFixture);
    expect(result.success).toBe(false);
    if (!result.success) {
      const messages = result.error.issues.map((i) => i.message).join(" ");
      expect(messages.toLowerCase()).toContain("skill");
    }
  });
});

describe("manifest schema -- metadata fields (author, created_at, updated_at)", () => {
  it("accepts a skill with all three metadata fields set", () => {
    const result = safeParseManifest({
      type: "skill",
      name: "with-meta",
      description: "Has full metadata.",
      aidlc_phases: ["build"],
      author: "Melissa Benua",
      created_at: "2026-03-07",
      updated_at: "2026-03-07",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.author).toBe("Melissa Benua");
      expect(result.data.created_at).toBe("2026-03-07");
      expect(result.data.updated_at).toBe("2026-03-07");
    }
  });

  it("coerces js-yaml Date objects to YYYY-MM-DD strings (real-world frontmatter parse)", () => {
    // js-yaml parses bare `2026-03-07` values as JS Date objects (YAML 1.1).
    // The schema must handle this or CI will fail on every skill with date fields.
    const result = safeParseManifest({
      type: "skill",
      name: "yaml-date",
      description: "Simulates js-yaml date coercion.",
      aidlc_phases: ["build"],
      created_at: new Date("2026-03-07T00:00:00.000Z"),
      updated_at: new Date("2026-03-07T00:00:00.000Z"),
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.created_at).toBe("2026-03-07");
      expect(result.data.updated_at).toBe("2026-03-07");
    }
  });

  it("accepts a skill with no metadata fields (all optional)", () => {
    const result = safeParseManifest({
      type: "skill",
      name: "no-meta",
      description: "No metadata fields at all.",
      aidlc_phases: ["build"],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.author).toBeUndefined();
      expect(result.data.created_at).toBeUndefined();
      expect(result.data.updated_at).toBeUndefined();
    }
  });

  it("accepts an agent with all three metadata fields set", () => {
    const result = safeParseManifest({
      type: "agent",
      name: "agent-with-meta",
      description: "An agent with metadata.",
      aidlc_phases: ["build"],
      skills: ["git-workflow"],
      author: "Melissa Benua",
      created_at: "2026-01-15",
      updated_at: "2026-03-07",
    });
    expect(result.success).toBe(true);
    if (result.success && result.data.type === "agent") {
      expect(result.data.author).toBe("Melissa Benua");
      expect(result.data.created_at).toBe("2026-01-15");
      expect(result.data.updated_at).toBe("2026-03-07");
    }
  });

  it("normalises a full ISO datetime string to date-only (YYYY-MM-DD)", () => {
    const result = safeParseManifest({
      type: "skill",
      name: "datetime-meta",
      description: "Uses a full datetime string.",
      aidlc_phases: ["build"],
      created_at: "2026-03-07T14:30:00Z",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.created_at).toBe("2026-03-07");
    }
  });

  it("rejects created_at with an invalid date format", () => {
    const result = safeParseManifest({
      type: "skill",
      name: "bad-date",
      description: "Bad date format.",
      aidlc_phases: ["build"],
      created_at: "March 7, 2026",
    });
    expect(result.success).toBe(false);
  });

  it("accepts the validSkillFixture with metadata fields", () => {
    const result = safeParseManifest(validSkillFixture);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.author).toBe("Melissa Benua");
    }
  });

  it("accepts the validAgentFixture with metadata fields", () => {
    const result = safeParseManifest(validAgentFixture);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.author).toBe("Melissa Benua");
    }
  });
});
