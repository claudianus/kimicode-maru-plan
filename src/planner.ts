import type { Plan, Seed } from "./types.js";

/**
 * Generate an initial Plan from a raw Seed.
 *
 * Stub — returns a minimal skeleton plan with a single placeholder step.
 */
export function generatePlan(seed: Seed): Plan {
  return {
    id: crypto.randomUUID(),
    version: 1,
    goal: seed.goal,
    steps: [
      {
        id: crypto.randomUUID(),
        description: "placeholder step — implementation pending",
      },
    ],
    assumptions: [],
    risks: [],
    interviews: [],
    research: [],
  };
}
