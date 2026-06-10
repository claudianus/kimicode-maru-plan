import type { Seed, Plan, InterviewQA, PlanVerdict } from './types.js';

/**
 * Interviewer module — defines the **interview** role in the planning harness.
 *
 * Role:
 * Identifies ambiguities, missing constraints, vague steps, and missing effort
 * estimates in the current plan, then generates clarifying questions for the user.
 *
 * How Kimi Code performs this role:
 * Kimi Code asks the user clarifying questions via `AskUserQuestion`.
 *
 * Where it fits in the loop:
 * Runs after evaluation (`plan-evaluator.ts`) and before research (`researcher.ts`).
 * The loop flow is: plan → evaluate → **interview** → research → refine → repeat.
 *
 * @param seed - The original user seed.
 * @param plan - The current plan iteration.
 * @param generationNumber - Current generation number for question IDs.
 * @param verdict - Optional plan verdict to include evaluator-identified questions.
 * @returns Array of InterviewQA items with ids like g1-q1, g1-q2.
 */
export function generateQuestions(seed: Seed, plan: Plan, generationNumber: number, verdict?: PlanVerdict): InterviewQA[] {
  const questions: InterviewQA[] = [];
  let qIndex = 1;

  const addQuestion = (question: string, reason: string) => {
    questions.push({
      id: `g${generationNumber}-q${qIndex++}`,
      question,
      reason,
    });
  };

  if (verdict?.missingQuestions.length) {
    for (const mq of verdict.missingQuestions) {
      questions.push({
        id: `g${generationNumber}-q${qIndex++}`,
        question: mq,
        reason: 'Identified by evaluator',
      });
    }
  }

  if (seed.goal.length < 30) {
    addQuestion(
      'The goal seems quite short. Could you elaborate on what you are trying to achieve?',
      'A short goal may hide ambiguity and make alignment difficult.'
    );
  }

  if (seed.constraints.length === 0) {
    addQuestion(
      'No constraints have been defined. Are there any hard constraints this plan must respect?',
      'Constraints prevent scope creep and guide the planner.'
    );
  }

  if (plan.steps.length === 0) {
    addQuestion(
      'The plan has no steps yet. What are the first actions you would like to take?',
      'A plan without steps is not actionable.'
    );
  } else {
    const vagueSteps = plan.steps.filter((step) => step.description.length < 10);
    if (vagueSteps.length > 0) {
      const stepNames = vagueSteps.map((s) => `"${s.description}"`).join(', ');
      addQuestion(
        `The following step(s) are vague: ${stepNames}. Could you clarify what each involves?`,
        'Vague step descriptions make execution and verification difficult.'
      );
    }

    const missingEffort = plan.steps.some((step) => !step.estimatedEffort);
    if (missingEffort) {
      addQuestion(
        'Some steps are missing effort estimates. Could you provide rough effort estimates for each step?',
        'Effort estimates help with scheduling and feasibility checks.'
      );
    }
  }

  return questions;
}
