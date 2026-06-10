/**
 * Plan refiner — stub implementation.
 *
 * Takes a plan and its evaluation verdict, returns a minimally-evolved
 * PlanEvolution (questions, research topics, and an unchanged plan).
 */

import type { Plan, PlanVerdict, PlanEvolution } from "./types.js";

/**
 * Evolve a plan based on evaluation feedback.
 *
 * @param plan    — the current plan to refine.
 * @param verdict — evaluation result with feedback / missing items.
 * @returns PlanEvolution — updated plan + follow-up questions & research.
 */
export function refinePlan(plan: Plan, verdict: PlanVerdict): PlanEvolution {
  return {
    updatedPlan: {
      ...plan,
      version: plan.version + 1,
    },
    interviewQuestions: verdict.missingQuestions,
    researchQueries: verdict.missingResearch,
  };
}
