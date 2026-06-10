import type { InterviewQA, Plan, Seed } from "./types.js";

/**
 * Generate clarifying interview questions based on seed and plan quality.
 *
 * Rule-based checks:
 * - Goal too short → ask for elaboration
 * - No steps → ask for first actions
 * - No constraints → ask for constraints
 * - Vague step descriptions → ask for clarification
 * - Missing effort estimates → ask for estimates
 */
export function generateQuestions(seed: Seed, plan: Plan): InterviewQA[] {
	const questions: InterviewQA[] = [];
	let nextId = 1;

	const add = (question: string, reason: string) => {
		questions.push({
			id: `q-${nextId++}`,
			question,
			reason,
		});
	};

	if (seed.goal.length < 30) {
		add(
			"Could you elaborate more on the goal? A single sentence is too vague to build a reliable plan.",
			"Goal is too short (< 30 chars) to derive actionable steps.",
		);
	}

	if (plan.steps.length === 0) {
		add(
			"What are the first concrete actions you would like to take toward this goal?",
			"Plan has no steps defined.",
		);
	}

	if (seed.constraints.length === 0) {
		add(
			"Are there any constraints (time, budget, technology, team size) we should respect?",
			"No constraints provided; constraints prevent plan drift.",
		);
	}

	for (const step of plan.steps) {
		if (step.description.length < 10) {
			add(
				`Step "${step.id}" description is too vague. Could you clarify what exactly needs to be done?`,
				`Step description is too short (< 10 chars): "${step.description}"`,
			);
		}
		if (!step.estimatedEffort) {
			add(
				`What is the estimated effort for step "${step.id}" (e.g., "2h", "1 day")?`,
				"Missing estimatedEffort prevents scheduling and feasibility checks.",
			);
		}
	}

	return questions;
}
