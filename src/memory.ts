import type { Seed, Plan, ConsensusVerdict, GenerationMemory, MemoryArchive } from './types.js';

export function createMemoryArchive(seed: Seed): MemoryArchive {
  return { seed, memories: [], summary: '' };
}

export function recordGeneration(
  archive: MemoryArchive,
  generation: number,
  plan: Plan,
  verdict: ConsensusVerdict,
  strategiesAttempted: string[],
  failures: string[],
  improvements: string[],
  discardedIdeas: string[]
): void {
  archive.memories.push({ generation, planSnapshot: plan, verdict, strategiesAttempted, failures, improvements, discardedIdeas });
  if (archive.memories.length > 5) {
    summarizeArchive(archive);
  }
}

function summarizeArchive(archive: MemoryArchive): void {
  const last5 = archive.memories.slice(-5);
  const attempts = [...new Set(last5.flatMap(m => m.strategiesAttempted))];
  const failures = [...new Set(last5.flatMap(m => m.failures))];
  archive.summary = `Last 5 generations attempted: ${attempts.join(', ')}. Persistent failures: ${failures.join(', ')}.`;
}

export function getLastMemories(archive: MemoryArchive, n: number): GenerationMemory[] {
  return archive.memories.slice(-n);
}

export function detectDrift(plan: Plan, seed: Seed): number {
  // Simple keyword overlap drift detection
  const planWords = new Set(plan.goal.toLowerCase().split(/\s+/));
  const seedWords = new Set(seed.goal.toLowerCase().split(/\s+/));
  const intersection = new Set([...planWords].filter(w => seedWords.has(w)));
  const union = new Set([...planWords, ...seedWords]);
  const jaccard = union.size > 0 ? 1 - (intersection.size / union.size) : 0;
  return Math.min(jaccard, 1);
}
