import type { Seed, Plan, InterviewQA } from './types.js';

/**
 * Generate interview questions based on the seed and current plan.
 * Identifies ambiguities, missing constraints, vague steps, and missing effort estimates.
 *
 * @param seed - The original user seed.
 * @param plan - The current plan iteration.
 * @returns Array of InterviewQA items with ids like q-1, q-2.
 */
export function generateQuestions(seed: Seed, plan: Plan): InterviewQA[] {
  const questions: InterviewQA[] = [];
  let qIndex = 1;

  const addQuestion = (question: string, reason: string) => {
    questions.push({
      id: `q-${qIndex++}`,
      question,
      reason,
    });
  };

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
