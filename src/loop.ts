/**
 * Orchestrates the kimi-harness planning loop.
 *
 * This module defines a **role** for Kimi Code to perform. Kimi Code executes
 * this role by driving the full planning lifecycle: generating a Plan, evaluating
 * it, and iteratively refining it through interviews and research.
 *
 * Loop flow:
 * 1. Planner (`planner.ts`) generates an initial Plan.
 * 2. Evaluator (`plan-evaluator.ts`) scores the Plan for ambiguity, completeness,
 *    feasibility, and alignment.
 * 3. If the score is insufficient, the loop continues:
 *    - Interviewer (`interviewer.ts`) — Kimi Code asks the user clarifying
 *      questions via `AskUserQuestion`.
 *    - Researcher (`researcher.ts`) — Kimi Code searches the web via `WebSearch`.
 *    - Refiner (`plan-refiner.ts`) — Kimi Code synthesizes feedback into an
 *      updated Plan.
 * 4. The loop repeats until the Plan passes or `maxGenerations` is reached.
 */

import type { Seed, LoopOptions, Plan, PlanVerdict, InterviewQA, ResearchItem } from './types.js';
import { generatePlan } from './planner.js';
import { evaluatePlan } from './plan-evaluator.js';
import { refinePlan } from './plan-refiner.js';
import { generateQuestions } from './interviewer.js';
import { conductResearch } from './researcher.js';

function mergeById<T extends { id: string }>(existing: T[], incoming: T[]): T[] {
  const seen = new Set(existing.map((x) => x.id));
  return [...existing, ...incoming.filter((x) => !seen.has(x.id))];
}

/**
 * Run the planning harness loop.
 *
 * Kimi Code performs this role by executing the generation loop:
 * generate a Plan, evaluate it, conduct interviews (AskUserQuestion) and
 * research (WebSearch) as needed, refine the Plan, and repeat until the
 * Plan passes or `maxGenerations` is reached.
 */
export async function runLoop(seed: Seed, options: LoopOptions): Promise<Plan> {
  const maxGenerations = options.maxGenerations ?? seed.maxGenerations ?? 5;

  console.log(`🐍 kimi-harness start`);
  console.log(`   Goal: ${seed.goal}`);
  console.log(`   Max generations: ${maxGenerations}`);
  console.log(`   CWD: ${options.cwd}`);

  let plan: Plan = await generatePlan(seed, [], []);
  let bestPlan: Plan = plan;
  let bestScore = -1;

  for (let i = 1; i <= maxGenerations; i++) {
    console.log(`\n━━━━━━━━━━━━━━━ Generation ${i}/${maxGenerations} ━━━━━━━━━━━━━━━`);

    try {
      const verdict: PlanVerdict = await evaluatePlan(plan, seed);

      console.log(`   Score: ${verdict.score.toFixed(2)}`);

      if (verdict.score > bestScore) {
        bestScore = verdict.score;
        bestPlan = plan;
      }

      if (verdict.score >= 0.85) {
        console.log(`\n✅ Plan accepted at generation ${i} (score ${verdict.score.toFixed(2)})!`);
        printPlan(plan);
        return plan;
      }

      if (options.stopOnPass !== false && verdict.passed) {
        console.log(`\n✅ Plan passed at generation ${i} (score ${verdict.score.toFixed(2)})!`);
        printPlan(plan);
        return plan;
      }

      console.log(`   Feedback: ${verdict.feedback.slice(0, 200)}${verdict.feedback.length > 200 ? '...' : ''}`);

      if (verdict.missingQuestions.length > 0) {
        const newQuestions = generateQuestions(seed, plan, i, verdict);
        plan.interviews = mergeById(plan.interviews, newQuestions);
        console.log(`   Questions: +${newQuestions.length} (total ${plan.interviews.length})`);
      }

      if (verdict.missingResearch.length > 0) {
        const newResearch = await conductResearch(verdict.missingResearch);
        plan.research = mergeById(plan.research, newResearch);
        console.log(`   Research: +${newResearch.length} (total ${plan.research.length})`);
      }

      const evolution = await refinePlan(plan, verdict);
      plan = evolution.updatedPlan;
    } catch (err) {
      console.error(`   Generation ${i} failed:`, err);
    }
  }

  console.log(`\n❌ Max generations (${maxGenerations}) reached without passing.`);
  console.log(`   Best score: ${bestScore.toFixed(2)}`);
  printPlan(bestPlan);
  return bestPlan;
}

function printPlan(plan: Plan): void {
  console.log(`\n📋 Plan v${plan.version} (${plan.id})`);
  console.log(`   Goal: ${plan.goal}`);
  console.log(`   Steps (${plan.steps.length}):`);
  for (const step of plan.steps) {
    const deps = step.dependsOn?.length ? ` [deps: ${step.dependsOn.join(', ')}]` : '';
    console.log(`      - ${step.description}${deps}`);
  }
  if (plan.assumptions.length) {
    console.log(`   Assumptions:`);
    for (const a of plan.assumptions) console.log(`      • ${a}`);
  }
  if (plan.risks.length) {
    console.log(`   Risks:`);
    for (const r of plan.risks) console.log(`      • ${r}`);
  }
}
