/**
 * Plan refiner — defines the role Kimi Code performs to improve a plan.
 *
 * In the planning harness, this module sits in the loop after evaluation,
 * interview, and research. Kimi Code uses the evaluation verdict to identify
 * improvements, generates follow-up questions via AskUserQuestion, and
 * formulates research queries via WebSearch. The resulting PlanEvolution
 * feeds back into the next planning iteration.
 */

import type { Plan, PlanVerdict, PlanEvolution } from "./types.js";

/**
 * Evolve a plan based on evaluation feedback.
 *
 * This is the refinement step in the planning loop. Kimi Code reads the
 * verdict's missing questions and research topics, then produces an updated
 * plan along with new interview questions (AskUserQuestion) and research
 * queries (WebSearch) for the next cycle.
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
