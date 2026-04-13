import { z } from "zod";

/**
 * Valid AIDLC phases a skill or agent can participate in.
 */
export const AidlcPhase = z.enum(["plan", "design", "build", "test", "review", "validate"]);
export type AidlcPhase = z.infer<typeof AidlcPhase>;

/**
 * ISO 8601 date string (YYYY-MM-DD). Accepts:
 *   - Plain strings: "2026-03-07" or "2026-03-07T14:30:00Z"
 *   - JavaScript Date objects — js-yaml parses bare YYYY-MM-DD values as Date
 *     objects per the YAML 1.1 spec, so we coerce them here before validating.
 * Always normalises to the date portion (YYYY-MM-DD) on output.
 */
const IsoDateString = z.preprocess(
  (val) => (val instanceof Date ? val.toISOString().slice(0, 10) : val),
  z
    .string()
    .regex(
      /^\d{4}-\d{2}-\d{2}(T[\d:.Z+-]+)?$/,
      "must be an ISO 8601 date string (YYYY-MM-DD)"
    )
    .transform((s) => s.slice(0, 10))
);

/**
 * Base fields shared by both skill and agent manifests.
 */
const BaseManifestSchema = z.object({
  name: z.string().min(1, "name is required"),
  description: z.string().min(1, "description is required"),
  aidlc_phases: z.array(AidlcPhase).min(1, "at least one aidlc_phase is required"),
  tags: z.array(z.string()).default([]),
  tool_file: z.string().optional(),
  requires: z.array(z.string()).default([]),
  author: z.string().optional(),
  created_at: IsoDateString.optional(),
  updated_at: IsoDateString.optional(),
});

/**
 * Schema for a skill manifest (type: skill).
 * Skills cannot declare a `skills` field -- that is agents-only.
 */
export const SkillManifestSchema = BaseManifestSchema.extend({
  type: z.literal("skill"),
  max_turns: z.undefined().optional(),
  timeout_seconds: z.undefined().optional(),
  skills: z.undefined({
    errorMap: () => ({
      message: "type 'skill' cannot declare a 'skills' field; only agents may declare skills",
    }),
  }).optional(),
});
export type SkillManifest = z.infer<typeof SkillManifestSchema>;

/**
 * Schema for an agent manifest (type: agent).
 * Agents compose skills and may declare loop control parameters.
 */
export const AgentManifestSchema = BaseManifestSchema.extend({
  type: z.literal("agent"),
  skills: z.array(z.string()).min(1, "agents must declare at least one skill"),
  max_turns: z.number().int().positive().optional(),
  timeout_seconds: z.number().int().positive().optional(),
});
export type AgentManifest = z.infer<typeof AgentManifestSchema>;

/**
 * Schema for an orchestrator manifest (type: orchestrator).
 * Orchestrators own a full AIDLC phase, dispatch specialist agents, and communicate
 * with the user. They are tied 1:1 to an AIDLC phase and live in orchestrators/.
 */
export const OrchestratorManifestSchema = BaseManifestSchema.extend({
  type: z.literal("orchestrator"),
  aidlc_phase: AidlcPhase,
  agents: z.array(z.string()).min(1, "orchestrators must declare at least one agent"),
  skills: z.array(z.string()).default([]),
  max_turns: z.number().int().positive().optional(),
  timeout_seconds: z.number().int().positive().optional(),
  success_criteria: z.string().optional(),
});
export type OrchestratorManifest = z.infer<typeof OrchestratorManifestSchema>;

/**
 * Discriminated union covering skill, agent, and orchestrator manifests.
 * Use this as the single parse entry-point.
 */
export const ManifestSchema = z.discriminatedUnion("type", [
  SkillManifestSchema,
  AgentManifestSchema,
  OrchestratorManifestSchema,
]);
export type Manifest = z.infer<typeof ManifestSchema>;

/**
 * Parse raw frontmatter data (e.g. from a YAML parser) against the manifest schema.
 * Throws a ZodError on validation failure.
 */
export function parseManifest(raw: unknown): Manifest {
  return ManifestSchema.parse(raw);
}

/**
 * Non-throwing variant -- returns a success/error discriminated result.
 */
export function safeParseManifest(raw: unknown): z.SafeParseReturnType<unknown, Manifest> {
  return ManifestSchema.safeParse(raw);
}
