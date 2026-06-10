import { test, expect } from 'bun:test';
import { runPreGenerationGate, runPostEvaluationGate, runConsensusGate } from '../src/gates.js';
import type { Seed, Plan, PersonaVerdict } from '../src/types.js';

function makeSeed(partial: Partial<Seed> = {}): Seed {
  return {
    goal: 'Build a landing page',
    constraints: [],
    ...partial,
  };
}

function makePlan(partial: Partial<Plan> = {}): Plan {
  return {
    id: 'plan-1',
    version: 1,
    goal: 'Build a landing page',
    steps: [
      { id: 's1', description: 'Design the layout' },
      { id: 's2', description: 'Implement HTML' },
      { id: 's3', description: 'Deploy to CDN' },
    ],
    assumptions: ['Assume modern browser support'],
    risks: ['Scope creep'],
    interviews: [],
    research: [],
    ...partial,
  };
}

function makePersonaVerdict(partial: Partial<PersonaVerdict> = {}): PersonaVerdict {
  return {
    persona: 'developer',
    passed: true,
    score: 0.8,
    ambiguity: 0.2,
    completeness: 0.9,
    feasibility: 0.85,
    goalAlignment: 0.9,
    feedback: 'Looks good',
    blockingIssues: [],
    ...partial,
  };
}

// ─── runPreGenerationGate ───

test('pre-generation gate passes with valid seed', () => {
  const seed = makeSeed({ goal: 'Build a React app', constraints: ['Use TypeScript'] });
  const result = runPreGenerationGate(seed);
  expect(result.passed).toBe(true);
  expect(result.gateName).toBe('Pre-Generation');
  expect(result.violations).toHaveLength(0);
});

test('pre-generation gate fails when goal is empty', () => {
  const seed = makeSeed({ goal: '' });
  const result = runPreGenerationGate(seed);
  expect(result.passed).toBe(false);
  expect(result.violations).toContain('Goal is empty');
});

test('pre-generation gate fails when goal exceeds 200 characters', () => {
  const seed = makeSeed({ goal: 'Build an app '.repeat(20) });
  expect(seed.goal.length).toBeGreaterThan(200);
  const result = runPreGenerationGate(seed);
  expect(result.passed).toBe(false);
  expect(result.violations).toContain('Goal exceeds 200 characters');
});

test('pre-generation gate fails when goal lacks a noun', () => {
  const seed = makeSeed({ goal: 'Build quickly' });
  const result = runPreGenerationGate(seed);
  expect(result.passed).toBe(false);
  expect(result.violations).toContain('Goal should contain a noun (e.g., app, site, API)');
});

test('pre-generation gate fails when goal lacks a verb', () => {
  const seed = makeSeed({ goal: 'A new landing page' });
  const result = runPreGenerationGate(seed);
  expect(result.passed).toBe(false);
  expect(result.violations).toContain('Goal should contain a verb (e.g., build, create, deploy)');
});

test('pre-generation gate detects contradicting constraints', () => {
  const seed = makeSeed({ constraints: ['Use React', 'Do not use React'] });
  const result = runPreGenerationGate(seed);
  expect(result.passed).toBe(false);
  expect(result.violations.some((v) => v.includes('Contradicting constraints'))).toBe(true);
});

test('pre-generation gate accumulates multiple violations', () => {
  const seed = makeSeed({ goal: '', constraints: ['Use React', 'Do not use React'] });
  const result = runPreGenerationGate(seed);
  expect(result.passed).toBe(false);
  expect(result.violations.length).toBeGreaterThanOrEqual(3);
});

test('pre-generation gate skips empty constraint strings', () => {
  const seed = makeSeed({ constraints: ['', 'Use React', ''] });
  const result = runPreGenerationGate(seed);
  expect(result.passed).toBe(true);
});

test('pre-generation gate is case-insensitive for noun and verb detection', () => {
  const seed = makeSeed({ goal: 'DEPLOY a PLATFORM' });
  const result = runPreGenerationGate(seed);
  expect(result.passed).toBe(true);
});

// ─── runPostEvaluationGate ───

test('post-evaluation gate passes with valid plan', () => {
  const plan = makePlan();
  const seed = makeSeed();
  const result = runPostEvaluationGate(plan, seed);
  expect(result.passed).toBe(true);
  expect(result.gateName).toBe('Post-Evaluation');
  expect(result.violations).toHaveLength(0);
});

test('post-evaluation gate fails when plan has fewer than 3 steps', () => {
  const plan = makePlan({ steps: [{ id: 's1', description: 'Only step' }] });
  const seed = makeSeed();
  const result = runPostEvaluationGate(plan, seed);
  expect(result.passed).toBe(false);
  expect(result.violations).toContain('Plan must have at least 3 steps');
});

test('post-evaluation gate fails when plan has no assumptions', () => {
  const plan = makePlan({ assumptions: [] });
  const seed = makeSeed();
  const result = runPostEvaluationGate(plan, seed);
  expect(result.passed).toBe(false);
  expect(result.violations).toContain('Plan must have at least 1 assumption');
});

test('post-evaluation gate fails when plan has no risks', () => {
  const plan = makePlan({ risks: [] });
  const seed = makeSeed();
  const result = runPostEvaluationGate(plan, seed);
  expect(result.passed).toBe(false);
  expect(result.violations).toContain('Plan must have at least 1 risk');
});

test('post-evaluation gate detects duplicate step descriptions', () => {
  const plan = makePlan({
    steps: [
      { id: 's1', description: 'Design the layout' },
      { id: 's2', description: '  design the layout  ' },
      { id: 's3', description: 'Deploy to CDN' },
    ],
  });
  const seed = makeSeed();
  const result = runPostEvaluationGate(plan, seed);
  expect(result.passed).toBe(false);
  expect(result.violations.some((v) => v.includes('Duplicate step description'))).toBe(true);
});

test('post-evaluation gate detects goal divergence', () => {
  const plan = makePlan({ goal: 'Cook a delicious cake' });
  const seed = makeSeed({ goal: 'Build a landing page' });
  const result = runPostEvaluationGate(plan, seed);
  expect(result.passed).toBe(false);
  expect(result.violations.some((v) => v.includes('Plan goal diverges'))).toBe(true);
});

test('post-evaluation gate accumulates multiple violations', () => {
  const plan = makePlan({
    steps: [{ id: 's1', description: 'Only step' }],
    assumptions: [],
    risks: [],
    goal: 'Completely unrelated topic about quantum physics',
  });
  const seed = makeSeed();
  const result = runPostEvaluationGate(plan, seed);
  expect(result.passed).toBe(false);
  expect(result.violations.length).toBeGreaterThanOrEqual(4);
});

test('post-evaluation gate handles empty plan goal', () => {
  const plan = makePlan({ goal: '' });
  const seed = makeSeed({ goal: 'Build a landing page' });
  const result = runPostEvaluationGate(plan, seed);
  expect(result.passed).toBe(false);
  expect(result.violations.some((v) => v.includes('Plan goal diverges'))).toBe(true);
});

// ─── runConsensusGate ───

test('consensus gate passes when all persona scores are above threshold', () => {
  const verdicts: PersonaVerdict[] = [
    makePersonaVerdict({ persona: 'developer', score: 0.75 }),
    makePersonaVerdict({ persona: 'pm', score: 0.9 }),
    makePersonaVerdict({ persona: 'security', score: 1.0 }),
    makePersonaVerdict({ persona: 'ux', score: 0.8 }),
  ];
  const result = runConsensusGate(verdicts);
  expect(result.passed).toBe(true);
  expect(result.gateName).toBe('Consensus');
  expect(result.violations).toHaveLength(0);
});

test('consensus gate passes with empty verdicts array', () => {
  const result = runConsensusGate([]);
  expect(result.passed).toBe(true);
});

test('consensus gate fails when a persona score is below threshold', () => {
  const verdicts: PersonaVerdict[] = [
    makePersonaVerdict({ persona: 'developer', score: 0.74 }),
    makePersonaVerdict({ persona: 'pm', score: 0.9 }),
  ];
  const result = runConsensusGate(verdicts);
  expect(result.passed).toBe(false);
  expect(result.violations).toContain('developer score 0.74 is below minimum threshold (0.75)');
});

test('consensus gate fails when multiple persona scores are below threshold', () => {
  const verdicts: PersonaVerdict[] = [
    makePersonaVerdict({ persona: 'developer', score: 0.5 }),
    makePersonaVerdict({ persona: 'pm', score: 0.6 }),
    makePersonaVerdict({ persona: 'security', score: 0.8 }),
  ];
  const result = runConsensusGate(verdicts);
  expect(result.passed).toBe(false);
  expect(result.violations.length).toBe(2);
});

test('consensus gate boundary: 0.75 passes, 0.749 fails', () => {
  const passVerdicts: PersonaVerdict[] = [makePersonaVerdict({ score: 0.75 })];
  expect(runConsensusGate(passVerdicts).passed).toBe(true);

  const failVerdicts: PersonaVerdict[] = [makePersonaVerdict({ score: 0.749 })];
  const result = runConsensusGate(failVerdicts);
  expect(result.passed).toBe(false);
  expect(result.violations[0]).toBe('developer score 0.75 is below minimum threshold (0.75)');
});
