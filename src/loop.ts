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
 * Plan → Evaluate → Refine → repeat until pass or max generations.
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

      if (verdict.passed || verdict.score >= 0.85) {
        console.log(`\n✅ Plan accepted at generation ${i} (score ${verdict.score.toFixed(2)})!`);
        printPlan(plan);
        return plan;
      }

      console.log(`   Feedback: ${verdict.feedback.slice(0, 200)}${verdict.feedback.length > 200 ? '...' : ''}`);

      if (verdict.missingQuestions.length > 0) {
        const newQuestions = generateQuestions(seed, plan);
        plan.interviews = mergeById(plan.interviews, newQuestions);
        console.log(`   Questions: +${newQuestions.length} (total ${plan.interviews.length})`);
      }

      const evolution = await refinePlan(plan, verdict);
      plan = evolution.updatedPlan;

      const researchQueries = [...verdict.missingResearch, ...evolution.researchQueries];
      if (researchQueries.length > 0) {
        const newResearch = await conductResearch(researchQueries);
        plan.research = mergeById(plan.research, newResearch);
        console.log(`   Research: +${newResearch.length} (total ${plan.research.length})`);
      }
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
