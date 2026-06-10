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

import type { Seed, LoopOptions, Plan, PlanVerdict, InterviewQA, ResearchItem, ConsensusVerdict } from './types.js';
import { generatePlan } from './planner.js';
import { evaluatePlan } from './plan-evaluator.js';
import { refinePlan } from './plan-refiner.js';
import { generateQuestions } from './interviewer.js';
import { conductResearch } from './researcher.js';
import { evaluateAsDeveloper, evaluateAsPM, evaluateAsSecurity, evaluateAsUX, aggregateVerdicts } from './evaluators/index.js';
import { createMemoryArchive, recordGeneration, detectDrift } from './memory.js';
import { runMetaEvolution } from './meta/index.js';

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

  const archive = createMemoryArchive(seed);

  let prevPlan: Plan | null = null;
  let prevVerdict: ConsensusVerdict | null = null;
  let prevScore = -1;
  let prevStrategies: string[] = [];
  let prevDiscarded: string[] = [];
  let prevImprovements: string[] = [];

  for (let i = 1; i <= maxGenerations; i++) {
    console.log(`\n━━━━━━━━━━━━━━━ Generation ${i}/${maxGenerations} ━━━━━━━━━━━━━━━`);

    try {
      const baseVerdict = await evaluatePlan(plan, seed);
      const personaVerdicts = await Promise.all([
        evaluateAsDeveloper(plan, seed),
        evaluateAsPM(plan, seed),
        evaluateAsSecurity(plan, seed),
        evaluateAsUX(plan, seed),
      ]);
      const verdict: ConsensusVerdict = aggregateVerdicts(personaVerdicts, baseVerdict);

      console.log(`   Consensus: ${verdict.score.toFixed(2)}`);
      for (const pv of verdict.personaVerdicts) {
        console.log(`      ${pv.persona}: ${pv.score.toFixed(2)}${pv.passed ? '' : ' ❌'}`);
      }
      if (verdict.disagreements.length > 0) {
        console.log(`   Disagreements: ${verdict.disagreements.join('; ')}`);
      }

      if (verdict.score > bestScore) {
        bestScore = verdict.score;
        bestPlan = plan;
      }

      const improvements: string[] = [];
      if (prevVerdict) {
        const scoreDelta = verdict.score - prevScore;
        if (scoreDelta > 0) improvements.push(`Score improved by ${scoreDelta.toFixed(2)} (${prevScore.toFixed(2)} → ${verdict.score.toFixed(2)})`);
        else if (scoreDelta < 0) improvements.push(`Score regressed by ${Math.abs(scoreDelta).toFixed(2)} (${prevScore.toFixed(2)} → ${verdict.score.toFixed(2)})`);
        else improvements.push(`Score unchanged at ${verdict.score.toFixed(2)}`);

        const ambiguityDelta = prevVerdict.ambiguity - verdict.ambiguity;
        if (ambiguityDelta > 0) improvements.push(`Ambiguity reduced by ${ambiguityDelta.toFixed(2)} (${prevVerdict.ambiguity.toFixed(2)} → ${verdict.ambiguity.toFixed(2)})`);

        const completenessDelta = verdict.completeness - prevVerdict.completeness;
        if (completenessDelta > 0) improvements.push(`Completeness improved by ${completenessDelta.toFixed(2)} (${prevVerdict.completeness.toFixed(2)} → ${verdict.completeness.toFixed(2)})`);

        const feasibilityDelta = verdict.feasibility - prevVerdict.feasibility;
        if (feasibilityDelta > 0) improvements.push(`Feasibility improved by ${feasibilityDelta.toFixed(2)} (${prevVerdict.feasibility.toFixed(2)} → ${verdict.feasibility.toFixed(2)})`);

        const goalAlignmentDelta = verdict.goalAlignment - prevVerdict.goalAlignment;
        if (goalAlignmentDelta > 0) improvements.push(`Goal alignment improved by ${goalAlignmentDelta.toFixed(2)} (${prevVerdict.goalAlignment.toFixed(2)} → ${verdict.goalAlignment.toFixed(2)})`);
      }

      if (prevVerdict && prevPlan) {
        recordGeneration(archive, i - 1, prevPlan, prevVerdict, prevStrategies, [prevVerdict.feedback], prevImprovements, prevDiscarded);
      }

      const passed = options.stopOnPass !== false ? verdict.passed : verdict.score >= 0.85;
      if (passed) {
        console.log(`\n✅ Plan passed at generation ${i} (score ${verdict.score.toFixed(2)})!`);
        printPlan(plan);
        return plan;
      }

      console.log(`   Feedback: ${verdict.feedback.slice(0, 200)}${verdict.feedback.length > 200 ? '...' : ''}`);

      const drift = detectDrift(plan, seed);
      if (drift > 0.3) {
        console.warn(`   ⚠️ Goal drift detected: ${drift.toFixed(2)} (threshold 0.3)`);
        verdict.feedback += ` [DRIFT ALERT] Plan goal diverged from seed goal (drift=${drift.toFixed(2)}). Re-align with seed.goal="${seed.goal}".`;
      }

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

      if (i % 3 === 0 && i > 0) {
        const meta = runMetaEvolution(archive);
        console.log(`\n━━━━━━━━━━━━━━━ Meta-Evolution ━━━━━━━━━━━━━━━`);
        console.log(`Strategy shift: ${meta.strategyShift}`);
        if (meta.rubricSuggestions.length > 0) {
          console.log(`Rubric suggestions:`);
          for (const s of meta.rubricSuggestions) {
            console.log(`  - ${s}`);
          }
        }
        if (meta.promptSuggestions.length > 0) {
          console.log(`Prompt suggestions:`);
          for (const s of meta.promptSuggestions) {
            console.log(`  - ${s}`);
          }
        }
      }

      const evolution = await refinePlan(plan, verdict, archive);

      const { strategiesAttempted, discardedIdeas } = diffPlans(plan, evolution.updatedPlan);
      prevPlan = plan;
      prevVerdict = verdict;
      prevScore = verdict.score;
      prevStrategies = strategiesAttempted;
      prevDiscarded = discardedIdeas;
      prevImprovements = improvements;

      plan = evolution.updatedPlan;
    } catch (err) {
      console.error(`   Generation ${i} failed:`, err);
    }
  }

  if (prevVerdict && prevPlan) {
    recordGeneration(archive, maxGenerations, prevPlan, prevVerdict, prevStrategies, [prevVerdict.feedback], prevImprovements, prevDiscarded);
  }

  console.log(`\n❌ Max generations (${maxGenerations}) reached without passing.`);
  console.log(`   Best score: ${bestScore.toFixed(2)}`);
  printPlan(bestPlan);
  return bestPlan;
}

function diffPlans(oldPlan: Plan, newPlan: Plan): { strategiesAttempted: string[]; discardedIdeas: string[] } {
  const strategiesAttempted: string[] = [];
  const discardedIdeas: string[] = [];

  const oldStepIds = new Set(oldPlan.steps.map((s) => s.id));
  const newStepIds = new Set(newPlan.steps.map((s) => s.id));

  for (const step of oldPlan.steps) {
    if (!newStepIds.has(step.id)) {
      discardedIdeas.push(step.description);
      strategiesAttempted.push(`Removed step: ${step.description}`);
    }
  }
  for (const step of newPlan.steps) {
    if (!oldStepIds.has(step.id)) {
      strategiesAttempted.push(`Added step: ${step.description}`);
    }
  }

  for (const a of oldPlan.assumptions) {
    if (!newPlan.assumptions.includes(a)) {
      discardedIdeas.push(a);
      strategiesAttempted.push(`Removed assumption: ${a}`);
    }
  }
  for (const a of newPlan.assumptions) {
    if (!oldPlan.assumptions.includes(a)) {
      strategiesAttempted.push(`Added assumption: ${a}`);
    }
  }

  for (const r of oldPlan.risks) {
    if (!newPlan.risks.includes(r)) {
      discardedIdeas.push(r);
      strategiesAttempted.push(`Removed risk: ${r}`);
    }
  }
  for (const r of newPlan.risks) {
    if (!oldPlan.risks.includes(r)) {
      strategiesAttempted.push(`Added risk: ${r}`);
    }
  }

  if (newPlan.version !== oldPlan.version) {
    strategiesAttempted.push(`Bumped version to ${newPlan.version}`);
  }

  return { strategiesAttempted, discardedIdeas };
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
