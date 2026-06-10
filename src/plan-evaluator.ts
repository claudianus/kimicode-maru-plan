import type { Plan, PlanVerdict, Seed } from "./types.js";

/**
 * Plan Evaluator — defines the role of evaluating a generated Plan against its Seed.
 *
 * In the planning harness, this module is responsible for producing a quality verdict
 * that scores the Plan on ambiguity, completeness, feasibility, and goal alignment.
 *
 * Kimi Code performs this role by applying its own semantic reasoning to assess the
 * Plan relative to the original seed constraints and interview context.
 *
 * Where it fits in the loop: Runs after `planner.ts` generates a Plan and before
 * `plan-refiner.ts` or `interviewer.ts` refine or interview.
 */

/**
 * Evaluate a plan against its seed and return a conservative quality verdict.
 *
 * Kimi Code should override the default returned here with real semantic
 * evaluation (ambiguity, completeness, feasibility, goalAlignment) based on
 * the Plan content and Seed constraints.
 *
 * This is a stub: it always returns non-passing defaults so that the
 * evolution loop continues until a real evaluator is wired in.
 */
export function evaluatePlan(plan: Plan, seed: Seed): PlanVerdict {
  return {
    passed: false,
    score: 0.5,
    ambiguity: 0.5,
    completeness: 0.5,
    feasibility: 0.5,
    goalAlignment: 0.5,
    feedback: "Evaluator not yet implemented. Plan requires manual review.",
    missingQuestions: [],
    missingResearch: [],
  };
}
