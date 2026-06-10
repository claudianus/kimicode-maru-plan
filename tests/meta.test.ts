import { test, expect, describe } from 'bun:test';
import { runMetaEvolution, evolveRubrics, evolvePrompts } from '../src/meta/index.js';
import type { MemoryArchive, GenerationMemory, ConsensusVerdict, Plan, InterviewQA } from '../src/types.js';

function makePlan(interviews: InterviewQA[] = []): Plan {
  return {
    id: 'plan-1',
    version: 1,
    goal: 'test goal',
    steps: [],
    assumptions: [],
    risks: [],
    interviews,
    research: [],
  };
}

function makeVerdict(overrides: Partial<ConsensusVerdict> = {}): ConsensusVerdict {
  return {
    passed: false,
    score: 0.5,
    ambiguity: 0.5,
    completeness: 0.5,
    feasibility: 0.5,
    goalAlignment: 0.5,
    feedback: '',
    missingQuestions: [],
    missingResearch: [],
    personaVerdicts: [],
    consensusFeedback: '',
    disagreements: [],
    ...overrides,
  };
}

function makeMemory(overrides: Partial<GenerationMemory> = {}): GenerationMemory {
  return {
    generation: 1,
    planSnapshot: makePlan(),
    verdict: makeVerdict(),
    strategiesAttempted: [],
    failures: [],
    improvements: [],
    discardedIdeas: [],
    ...overrides,
  };
}

function makeArchive(memories: GenerationMemory[]): MemoryArchive {
  return {
    seed: { goal: 'test', constraints: [] },
    memories,
    summary: '',
  };
}

describe('evolveRubrics', () => {
  test('returns empty array for empty archive', () => {
    const archive = makeArchive([]);
    expect(evolveRubrics(archive)).toEqual([]);
  });

  test('suggests increasing weight when average < 0.5', () => {
    const archive = makeArchive([
      makeMemory({ verdict: makeVerdict({ ambiguity: 0.3 }) }),
    ]);
    const suggestions = evolveRubrics(archive);
    expect(suggestions.length).toBeGreaterThan(0);
    expect(suggestions[0]).toContain('consider increasing its weight');
    expect(suggestions[0]).toContain('25%');
    expect(suggestions[0]).toContain('35%');
  });

  test('suggests decreasing weight when average > 0.9', () => {
    const archive = makeArchive([
      makeMemory({ verdict: makeVerdict({ completeness: 1.0 }) }),
    ]);
    const suggestions = evolveRubrics(archive);
    const completenessSuggestion = suggestions.find((s) => s.includes('completeness'));
    expect(completenessSuggestion).toBeDefined();
    expect(completenessSuggestion).toContain('consider decreasing its weight');
    expect(completenessSuggestion).toContain('30%');
    expect(completenessSuggestion).toContain('20%');
  });

  test('returns no suggestion when average is between 0.5 and 0.9', () => {
    const archive = makeArchive([
      makeMemory({ verdict: makeVerdict({ feasibility: 0.7 }) }),
    ]);
    const suggestions = evolveRubrics(archive);
    const feasibilitySuggestion = suggestions.find((s) => s.includes('feasibility'));
    expect(feasibilitySuggestion).toBeUndefined();
  });

  test('only considers the last 3 memories', () => {
    const archive = makeArchive([
      makeMemory({ verdict: makeVerdict({ ambiguity: 1.0 }) }),
      makeMemory({ verdict: makeVerdict({ ambiguity: 0.1 }) }),
      makeMemory({ verdict: makeVerdict({ ambiguity: 0.1 }) }),
      makeMemory({ verdict: makeVerdict({ ambiguity: 0.1 }) }),
    ]);
    const suggestions = evolveRubrics(archive);
    const ambiguitySuggestion = suggestions.find((s) => s.includes('ambiguity'));
    expect(ambiguitySuggestion).toBeDefined();
    expect(ambiguitySuggestion).toContain('0.10');
  });

  test('handles multiple dimensions independently', () => {
    const archive = makeArchive([
      makeMemory({
        verdict: makeVerdict({
          ambiguity: 0.2,
          completeness: 0.95,
          feasibility: 0.6,
          goalAlignment: 0.4,
        }),
      }),
    ]);
    const suggestions = evolveRubrics(archive);
    expect(suggestions.filter((s) => s.includes('ambiguity')).length).toBe(1);
    expect(suggestions.filter((s) => s.includes('completeness')).length).toBe(1);
    expect(suggestions.filter((s) => s.includes('feasibility')).length).toBe(0);
    expect(suggestions.filter((s) => s.includes('goalAlignment')).length).toBe(1);
  });

  test('weight caps at 50% when increasing', () => {
    const archive = makeArchive([
      makeMemory({ verdict: makeVerdict({ goalAlignment: 0.1 }) }),
    ]);
    const suggestions = evolveRubrics(archive);
    const suggestion = suggestions.find((s) => s.includes('goalAlignment'));
    expect(suggestion).toContain('30%');
  });

  test('weight floors at 10% when decreasing', () => {
    const archive = makeArchive([
      makeMemory({ verdict: makeVerdict({ goalAlignment: 1.0 }) }),
    ]);
    const suggestions = evolveRubrics(archive);
    const suggestion = suggestions.find((s) => s.includes('goalAlignment'));
    expect(suggestion).toContain('10%');
  });
});

describe('evolvePrompts', () => {
  test('returns empty array for empty archive', () => {
    const archive = makeArchive([]);
    expect(evolvePrompts(archive)).toEqual([]);
  });

  test('categorizes questions by keywords in question and reason', () => {
    const archive = makeArchive([
      makeMemory({
        planSnapshot: makePlan([
          { id: 'q1', question: 'What is the goal?', reason: 'Need to understand the objective' },
        ]),
        improvements: ['improved clarity'],
      }),
    ]);
    const suggestions = evolvePrompts(archive);
    expect(suggestions.some((s) => s.includes('goal'))).toBe(true);
  });

  test('promotes category when hit rate >= 0.66', () => {
    const archive = makeArchive([
      makeMemory({
        planSnapshot: makePlan([
          { id: 'q1', question: 'What is the goal?', reason: 'Need to understand' },
        ]),
        improvements: ['improved clarity'],
      }),
      makeMemory({
        planSnapshot: makePlan([
          { id: 'q2', question: 'What is the goal?', reason: 'Need to understand' },
        ]),
        improvements: ['improved focus'],
      }),
      makeMemory({
        planSnapshot: makePlan([
          { id: 'q3', question: 'What is the goal?', reason: 'Need to understand' },
        ]),
        improvements: ['improved structure'],
      }),
    ]);
    const suggestions = evolvePrompts(archive);
    expect(suggestions.some((s) => s.includes('Promote') && s.includes('goal'))).toBe(true);
  });

  test('demotes category when hit rate <= 0.33', () => {
    const archive = makeArchive([
      makeMemory({
        planSnapshot: makePlan([
          { id: 'q1', question: 'What is the goal?', reason: 'Need to understand' },
        ]),
        improvements: ['failed'],
      }),
      makeMemory({
        planSnapshot: makePlan([
          { id: 'q2', question: 'What is the goal?', reason: 'Need to understand' },
        ]),
        improvements: ['failed'],
      }),
      makeMemory({
        planSnapshot: makePlan([
          { id: 'q3', question: 'What is the goal?', reason: 'Need to understand' },
        ]),
        improvements: ['failed again'],
      }),
    ]);
    const suggestions = evolvePrompts(archive);
    expect(suggestions.some((s) => s.includes('Demote') && s.includes('goal'))).toBe(true);
  });

  test('no suggestion for middle hit rate (0.33-0.66)', () => {
    const archive = makeArchive([
      makeMemory({
        planSnapshot: makePlan([
          { id: 'q1', question: 'What is the goal?', reason: 'Need to understand' },
        ]),
        improvements: ['improved clarity'],
      }),
      makeMemory({
        planSnapshot: makePlan([
          { id: 'q2', question: 'What is the goal?', reason: 'Need to understand' },
        ]),
        improvements: ['failed'],
      }),
    ]);
    const suggestions = evolvePrompts(archive);
    expect(suggestions.some((s) => s.includes('goal'))).toBe(false);
  });

  test('only last 3 memories are considered', () => {
    const archive = makeArchive([
      makeMemory({
        planSnapshot: makePlan([
          { id: 'q1', question: 'What is the goal?', reason: 'Need to understand' },
        ]),
        improvements: ['failed'],
      }),
      makeMemory({
        planSnapshot: makePlan([
          { id: 'q2', question: 'What is the goal?', reason: 'Need to understand' },
        ]),
        improvements: ['improved'],
      }),
      makeMemory({
        planSnapshot: makePlan([
          { id: 'q3', question: 'What is the goal?', reason: 'Need to understand' },
        ]),
        improvements: ['improved'],
      }),
      makeMemory({
        planSnapshot: makePlan([
          { id: 'q4', question: 'What is the goal?', reason: 'Need to understand' },
        ]),
        improvements: ['improved'],
      }),
    ]);
    const suggestions = evolvePrompts(archive);
    expect(suggestions.some((s) => s.includes('Promote') && s.includes('goal'))).toBe(true);
  });

  test('categories are deduplicated per memory', () => {
    const archive = makeArchive([
      makeMemory({
        planSnapshot: makePlan([
          { id: 'q1', question: 'What is the goal?', reason: 'Need to understand the objective' },
          { id: 'q2', question: 'What is the goal?', reason: 'Need to understand the purpose' },
        ]),
        improvements: ['improved'],
      }),
    ]);
    const suggestions = evolvePrompts(archive);
    expect(suggestions.filter((s) => s.includes('goal')).length).toBe(1);
  });

  test('multiple categories can be suggested', () => {
    const archive = makeArchive([
      makeMemory({
        planSnapshot: makePlan([
          { id: 'q1', question: 'What is the goal?', reason: 'Need to understand' },
          { id: 'q2', question: 'What are the constraints?', reason: 'Need limits' },
        ]),
        improvements: ['improved'],
      }),
      makeMemory({
        planSnapshot: makePlan([
          { id: 'q3', question: 'What is the goal?', reason: 'Need to understand' },
          { id: 'q4', question: 'What are the constraints?', reason: 'Need limits' },
        ]),
        improvements: ['improved'],
      }),
      makeMemory({
        planSnapshot: makePlan([
          { id: 'q5', question: 'What is the goal?', reason: 'Need to understand' },
          { id: 'q6', question: 'What are the constraints?', reason: 'Need limits' },
        ]),
        improvements: ['improved'],
      }),
    ]);
    const suggestions = evolvePrompts(archive);
    expect(suggestions.some((s) => s.includes('goal'))).toBe(true);
    expect(suggestions.some((s) => s.includes('constraints'))).toBe(true);
  });

  test('generation not improved when improvements do not contain "improved"', () => {
    const archive = makeArchive([
      makeMemory({
        planSnapshot: makePlan([
          { id: 'q1', question: 'What is the goal?', reason: 'Need to understand' },
        ]),
        improvements: ['failed', 'regressed'],
      }),
      makeMemory({
        planSnapshot: makePlan([
          { id: 'q2', question: 'What is the goal?', reason: 'Need to understand' },
        ]),
        improvements: ['failed', 'regressed'],
      }),
      makeMemory({
        planSnapshot: makePlan([
          { id: 'q3', question: 'What is the goal?', reason: 'Need to understand' },
        ]),
        improvements: ['failed', 'regressed'],
      }),
    ]);
    const suggestions = evolvePrompts(archive);
    expect(suggestions.some((s) => s.includes('Demote') && s.includes('goal'))).toBe(true);
  });

  test('case-insensitive keyword matching', () => {
    const archive = makeArchive([
      makeMemory({
        planSnapshot: makePlan([
          { id: 'q1', question: 'What are the RISKS?', reason: 'Need to know concerns' },
        ]),
        improvements: ['improved'],
      }),
    ]);
    const suggestions = evolvePrompts(archive);
    expect(suggestions.some((s) => s.includes('risks'))).toBe(true);
  });
});

describe('runMetaEvolution', () => {
  test('returns both suggestions when present', () => {
    const archive = makeArchive([
      makeMemory({
        verdict: makeVerdict({ ambiguity: 0.1 }),
        planSnapshot: makePlan([
          { id: 'q1', question: 'What is the goal?', reason: 'Need to understand' },
        ]),
        improvements: ['improved'],
      }),
    ]);
    const result = runMetaEvolution(archive);
    expect(result.rubricSuggestions.length).toBeGreaterThan(0);
    expect(result.promptSuggestions.length).toBeGreaterThan(0);
    expect(result.strategyShift).toContain('rubric adjustment');
    expect(result.strategyShift).toContain('prompt adjustment');
  });

  test('returns only rubric suggestions when prompts are stable', () => {
    const archive = makeArchive([
      makeMemory({
        verdict: makeVerdict({ ambiguity: 0.1 }),
        planSnapshot: makePlan([]),
        improvements: [],
      }),
    ]);
    const result = runMetaEvolution(archive);
    expect(result.rubricSuggestions.length).toBeGreaterThan(0);
    expect(result.promptSuggestions).toEqual([]);
    expect(result.strategyShift).toContain('rubric adjustment');
    expect(result.strategyShift).not.toContain('prompt adjustment');
  });

  test('returns only prompt suggestions when rubrics are stable', () => {
    const archive = makeArchive([
      makeMemory({
        verdict: makeVerdict({ ambiguity: 0.7 }),
        planSnapshot: makePlan([
          { id: 'q1', question: 'What is the goal?', reason: 'Need to understand' },
        ]),
        improvements: ['improved'],
      }),
    ]);
    const result = runMetaEvolution(archive);
    expect(result.rubricSuggestions).toEqual([]);
    expect(result.promptSuggestions.length).toBeGreaterThan(0);
    expect(result.strategyShift).toContain('prompt adjustment');
    expect(result.strategyShift).not.toContain('rubric adjustment');
  });

  test('returns stable strategy when nothing needs adjustment', () => {
    const archive = makeArchive([
      makeMemory({
        verdict: makeVerdict({ ambiguity: 0.7 }),
        planSnapshot: makePlan([]),
        improvements: [],
      }),
    ]);
    const result = runMetaEvolution(archive);
    expect(result.rubricSuggestions).toEqual([]);
    expect(result.promptSuggestions).toEqual([]);
    expect(result.strategyShift).toBe('No adjustments needed; current strategy is stable');
  });
});
