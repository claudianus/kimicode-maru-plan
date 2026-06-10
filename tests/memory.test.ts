import { test, expect } from 'bun:test';
import { createMemoryArchive, recordGeneration, getLastMemories, detectDrift } from '../src/memory.js';
import type { Seed, Plan, ConsensusVerdict } from '../src/types.js';

// ─── Helpers ────────────────────────────────────────────────────

function makeSeed(goal: string): Seed {
  return { goal, constraints: [] };
}

function makePlan(goal: string): Plan {
  return {
    id: 'plan-1',
    version: 1,
    goal,
    steps: [],
    assumptions: [],
    risks: [],
    interviews: [],
    research: [],
  };
}

function makeVerdict(): ConsensusVerdict {
  return {
    passed: false,
    score: 0,
    ambiguity: 0,
    completeness: 0,
    feasibility: 0,
    goalAlignment: 0,
    feedback: '',
    missingQuestions: [],
    missingResearch: [],
    personaVerdicts: [],
    consensusFeedback: '',
    disagreements: [],
  };
}

// ─── createMemoryArchive ────────────────────────────────────────

test('createMemoryArchive returns archive with seed, empty memories and summary', () => {
  const seed = makeSeed('build a CLI tool');
  const archive = createMemoryArchive(seed);

  expect(archive.seed).toBe(seed);
  expect(archive.memories).toEqual([]);
  expect(archive.summary).toBe('');
});

// ─── recordGeneration ───────────────────────────────────────────

test('recordGeneration pushes a memory into the archive', () => {
  const seed = makeSeed('test');
  const archive = createMemoryArchive(seed);
  const plan = makePlan('test');

  recordGeneration(archive, 1, plan, makeVerdict(), ['s1'], ['f1'], ['i1'], ['d1']);

  expect(archive.memories).toHaveLength(1);
  expect(archive.memories[0].generation).toBe(1);
  expect(archive.memories[0].strategiesAttempted).toEqual(['s1']);
});

test('recordGeneration does not summarize when memories <= 5', () => {
  const archive = createMemoryArchive(makeSeed('test'));

  for (let i = 1; i <= 5; i++) {
    recordGeneration(
      archive,
      i,
      makePlan('test'),
      makeVerdict(),
      [`strategy-${i}`],
      [`failure-${i}`],
      [],
      []
    );
  }

  expect(archive.memories).toHaveLength(5);
  expect(archive.summary).toBe('');
});

test('recordGeneration summarizes when memories exceed 5 using last 5', () => {
  const archive = createMemoryArchive(makeSeed('test'));

  for (let i = 1; i <= 6; i++) {
    recordGeneration(
      archive,
      i,
      makePlan('test'),
      makeVerdict(),
      [`strategy-${i}`],
      [`failure-${i}`],
      [],
      []
    );
  }

  expect(archive.memories).toHaveLength(6);
  // Summary should reflect generations 2-6, not generation 1
  expect(archive.summary).toContain('strategy-2');
  expect(archive.summary).toContain('strategy-6');
  expect(archive.summary).not.toContain('strategy-1');
});

test('summarize deduplicates strategies and failures across last 5', () => {
  const archive = createMemoryArchive(makeSeed('test'));

  for (let i = 1; i <= 6; i++) {
    recordGeneration(
      archive,
      i,
      makePlan('test'),
      makeVerdict(),
      ['shared-strategy'],
      ['shared-failure'],
      [],
      []
    );
  }

  // Set deduplication means each item appears only once despite 5 memories
  const strategyCount = archive.summary.split('shared-strategy').length - 1;
  const failureCount = archive.summary.split('shared-failure').length - 1;
  expect(strategyCount).toBe(1);
  expect(failureCount).toBe(1);
});

test('summarize handles empty strategies and failures', () => {
  const archive = createMemoryArchive(makeSeed('test'));

  for (let i = 1; i <= 6; i++) {
    recordGeneration(archive, i, makePlan('test'), makeVerdict(), [], [], [], []);
  }

  expect(archive.summary).toBe('Last 5 generations attempted: . Persistent failures: .');
});

// ─── getLastMemories ────────────────────────────────────────────

test('getLastMemories returns the last n memories', () => {
  const archive = createMemoryArchive(makeSeed('test'));
  for (let i = 1; i <= 5; i++) {
    recordGeneration(archive, i, makePlan('test'), makeVerdict(), [], [], [], []);
  }

  const last2 = getLastMemories(archive, 2);
  expect(last2).toHaveLength(2);
  expect(last2[0].generation).toBe(4);
  expect(last2[1].generation).toBe(5);
});

test('getLastMemories returns all memories when n exceeds length', () => {
  const archive = createMemoryArchive(makeSeed('test'));
  recordGeneration(archive, 1, makePlan('test'), makeVerdict(), [], [], [], []);

  expect(getLastMemories(archive, 10)).toHaveLength(1);
});

test('getLastMemories returns all memories for n = 0 (slice(-0) quirk)', () => {
  const archive = createMemoryArchive(makeSeed('test'));
  recordGeneration(archive, 1, makePlan('test'), makeVerdict(), [], [], [], []);

  // JavaScript Array.prototype.slice(-0) is treated as slice(0)
  expect(getLastMemories(archive, 0)).toEqual(archive.memories);
});

test('getLastMemories returns empty array for empty archive', () => {
  const archive = createMemoryArchive(makeSeed('test'));
  expect(getLastMemories(archive, 3)).toEqual([]);
});

// ─── detectDrift ────────────────────────────────────────────────

test('detectDrift returns 0 for identical goals', () => {
  const seed = makeSeed('deploy to production');
  const plan = makePlan('deploy to production');
  expect(detectDrift(plan, seed)).toBe(0);
});

test('detectDrift returns 1 for completely different goals', () => {
  const seed = makeSeed('alpha beta');
  const plan = makePlan('gamma delta');
  expect(detectDrift(plan, seed)).toBe(1);
});

test('detectDrift computes correct Jaccard distance for partial overlap', () => {
  const seed = makeSeed('a b c');
  const plan = makePlan('a b d');
  // intersection = {a,b} → 2
  // union = {a,b,c,d} → 4
  // jaccard = 1 - 2/4 = 0.5
  expect(detectDrift(plan, seed)).toBe(0.5);
});

test('detectDrift is case-insensitive', () => {
  const seed = makeSeed('Build A CLI');
  const plan = makePlan('build a cli');
  expect(detectDrift(plan, seed)).toBe(0);
});

test('detectDrift returns 0 when both goals are empty', () => {
  const seed = makeSeed('');
  const plan = makePlan('');
  expect(detectDrift(plan, seed)).toBe(0);
});

test('detectDrift treats punctuation as distinct words', () => {
  const seed = makeSeed('build');
  const plan = makePlan('build!');
  // 'build' vs 'build!'
  expect(detectDrift(plan, seed)).toBe(1);
});
