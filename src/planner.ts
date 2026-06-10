import type { InterviewQA, Plan, ResearchItem, Seed } from "./types.js";

/**
 * Generate an initial Plan from a raw Seed.
 *
 * Stub — returns a minimal skeleton plan with a single placeholder step.
 */
export function generatePlan(
  seed: Seed,
  interviews: InterviewQA[] = [],
  research: ResearchItem[] = [],
): Promise<Plan> {
  return Promise.resolve({
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
    interviews,
    research,
  });
}
