import type { InterviewQA, Plan, ResearchItem, Seed } from "./types.js";

/**
 * Planner — synthesizes a concrete Plan from a Seed, interviews, and research.
 *
 * Role in the harness: This module defines the planning role for Kimi Code.
 * Kimi Code performs this role by reasoning over the seed goal, interview
 * answers, and research findings to produce a concrete, actionable Plan.
 *
 * Position in the loop: Runs first to bootstrap the Plan, before evaluation.
 * Subsequent updates are produced by the refiner; this module establishes the
 * initial plan that enters the Plan → Evaluate → Refine loop.
 */

/**
 * Generate an initial Plan from a raw Seed, incorporating any interviews
 * and research gathered so far.
 *
 * Role: Kimi Code synthesizes a concrete Plan by reasoning over the seed
 * goal, user interview answers, and web research findings.
 *
 * Position in the loop: Runs first to bootstrap the Plan, before evaluation.
 * After evaluation and refinement, the plan evolves via plan-refiner.ts.
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
