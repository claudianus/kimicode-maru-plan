import type { Plan, PlanVerdict, Seed } from "./types.js";

/**
 * Evaluate a plan against its seed and return a conservative quality verdict.
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
