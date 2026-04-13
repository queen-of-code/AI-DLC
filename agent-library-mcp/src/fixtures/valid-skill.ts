import type { SkillManifest } from "../manifest.js";

/**
 * A fully valid skill manifest fixture.
 */
export const validSkillFixture: SkillManifest = {
  type: "skill",
  name: "blog-writing",
  description:
    "Write blog posts in Melissa Benua's voice and style, saved to external-brain/blog-posts.",
  aidlc_phases: ["plan"],
  tags: ["writing", "content", "blog"],
  tool_file: "tool.ts",
  requires: [],
  author: "Melissa Benua",
  created_at: "2026-03-07",
  updated_at: "2026-03-07",
};

/**
 * A minimal valid skill manifest (only required fields).
 */
export const minimalSkillFixture: SkillManifest = {
  type: "skill",
  name: "greeting",
  description: "Personal greeting preference for conversations.",
  aidlc_phases: ["plan"],
  tags: [],
  requires: [],
};
