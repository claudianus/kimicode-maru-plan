import { seedCorpus } from './seed-corpus.js';
import { runLoop } from '../../src/loop.js';
import { computeBenchmarkScore } from './scoring.js';

async function main() {
  const results: { seed: string; score: number; generations: number }[] = [];

  for (const seed of seedCorpus) {
    const originalLog = console.log;
    console.log = () => {};
    const plan = await runLoop(seed, {
      cwd: '/tmp/bench',
      maxGenerations: seed.maxGenerations ?? 5,
    });
    console.log = originalLog;

    const score = computeBenchmarkScore(plan, seed);
    results.push({ seed: seed.goal.slice(0, 40), score, generations: plan.version });
  }

  const avgScore = results.reduce((s, r) => s + r.score, 0) / results.length;
  const avgGen = results.reduce((s, r) => s + r.generations, 0) / results.length;

  console.log('Benchmark Results');
  console.log('=================');
  for (const r of results) {
    console.log(`${r.seed.padEnd(42)} | score: ${r.score.toFixed(2)} | gen: ${r.generations}`);
  }
  console.log(`Average score: ${avgScore.toFixed(2)}`);
  console.log(`Average generations: ${avgGen.toFixed(1)}`);
}

main();
