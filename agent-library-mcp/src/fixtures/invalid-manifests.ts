/**
 * Invalid manifest fixtures -- these are plain objects (not typed) because
 * they are intentionally malformed. Tests assert that parsing them fails.
 */

/**
 * A skill that illegally declares a `skills` field.
 * Must be rejected: type 'skill' cannot declare 'skills'.
 */
export const skillWithSkillsFieldFixture = {
  type: "skill",
  name: "bad-skill",
  description: "This skill illegally declares a skills array.",
  aidlc_phases: ["plan"],
  tags: [],
  requires: [],
  skills: ["some-other-skill"],
};

/**
 * A manifest with an unknown type value.
 */
export const unknownTypeFixture = {
  type: "workflow",
  name: "unknown-thing",
  description: "This has an unrecognised type.",
  aidlc_phases: ["build"],
  tags: [],
  requires: [],
};

/**
 * Missing required `name` field.
 */
export const missingNameFixture = {
  type: "skill",
  description: "No name here.",
  aidlc_phases: ["build"],
  tags: [],
  requires: [],
};

/**
 * Missing required `description` field.
 */
export const missingDescriptionFixture = {
  type: "skill",
  name: "no-description",
  aidlc_phases: ["build"],
  tags: [],
  requires: [],
};

/**
 * Missing required `aidlc_phases` field.
 */
export const missingPhasesFixture = {
  type: "skill",
  name: "no-phases",
  description: "No aidlc_phases declared.",
  tags: [],
  requires: [],
};

/**
 * An agent with no skills declared (must have at least one).
 */
export const agentWithNoSkillsFixture = {
  type: "agent",
  name: "empty-agent",
  description: "An agent that declares no skills.",
  aidlc_phases: ["build"],
  tags: [],
  requires: [],
  skills: [],
};

/**
 * An invalid AIDLC phase value.
 */
export const invalidPhaseFixture = {
  type: "skill",
  name: "bad-phase",
  description: "Uses a non-existent phase.",
  aidlc_phases: ["nonexistent-phase"],
  tags: [],
  requires: [],
};
