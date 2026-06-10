import type { Seed, LoopOptions } from './types.js';
import { executeGeneration } from './executor.js';
import { evaluateGeneration } from './evaluator.js';
import { evolveSeed } from './evolver.js';

/**
 * Run the Ouroboros-inspired evolutionary loop.
 *
 * Execute → Evaluate → Evolve → repeat until pass or max generations.
 */
export async function runLoop(seed: Seed, options: LoopOptions): Promise<void> {
  const maxGenerations = options.maxGenerations ?? seed.maxGenerations ?? 5;
  let currentSeed = seed;
  let previousFeedback: string | undefined;
  let lastVerdict = undefined;

  console.log(`🐍 kimi-harness start`);
  console.log(`   Goal: ${seed.goal}`);
  console.log(`   Max generations: ${maxGenerations}`);
  console.log(`   CWD: ${options.cwd}`);

  for (let i = 1; i <= maxGenerations; i++) {
    console.log(`\n━━━━━━━━━━━━━━━ Generation ${i}/${maxGenerations} ━━━━━━━━━━━━━━━`);

    try {
      const generation = await executeGeneration(currentSeed, i, previousFeedback, {
        cwd: options.cwd,
        applyChanges: true,
      });

      const verdict = await evaluateGeneration(generation, currentSeed, { cwd: options.cwd });
      generation.verdict = verdict;
      lastVerdict = verdict;

      console.log(`   Score: ${verdict.score.toFixed(2)}`);
      console.log(`   Build: ${verdict.mechanical.buildPassed ? '✅' : '❌'}`);
      console.log(`   Tests: ${verdict.mechanical.testsPassed ? '✅' : '❌'}`);
      console.log(`   Lint:  ${verdict.mechanical.lintPassed ? '✅' : '❌'}`);
      console.log(`   Drift: ${verdict.semantic.driftScore.toFixed(2)}`);

      if (verdict.passed) {
        console.log(`\n✅ All acceptance criteria passed at generation ${i}!`);
        return;
      }

      const evolution = evolveSeed(currentSeed, generation, verdict);
      currentSeed = evolution.updatedSeed;
      previousFeedback = evolution.prompt;

      console.log(`   Feedback: ${verdict.feedback.slice(0, 200)}${verdict.feedback.length > 200 ? '...' : ''}`);
    } catch (err) {
      console.error(`   Generation ${i} failed:`, err);
    }
  }

  console.log(`\n❌ Max generations (${maxGenerations}) reached without passing.`);
  if (lastVerdict) {
    console.log(`   Best score: ${lastVerdict.score.toFixed(2)}`);
  }
}
