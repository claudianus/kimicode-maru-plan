/**
 * Core types for kimi-harness.
 *
 * Inspired by Ouroboros:
 *  - Seed: immutable goal + constraints + acceptance criteria
 *  - Generation: one code-producing attempt
 *  - Verdict: mechanical + semantic evaluation
 *  - Evolve: drift-aware prompt refinement
 */

export interface Seed {
  /** One-sentence mission. Must not change during evolution. */
  goal: string;
  /** Hard constraints that every generation must respect. */
  constraints: string[];
  /** Acceptance criteria — mechanical or semantic. */
  acceptanceCriteria: AcceptanceCriterion[];
  /** Explicitly out-of-scope items. */
  nonGoals?: string[];
  /** Max evolutionary generations before giving up. */
  maxGenerations?: number;
  /** Ethical guardrails applied to every generation. */
  ethicalConstraints?: string[];
}

export interface AcceptanceCriterion {
  id: string;
  description: string;
  /** How to verify this AC. */
  verificationMethod: 'test' | 'lint' | 'build' | 'manual' | 'semantic';
}

export interface Generation {
  id: string;
  generationNumber: number;
  /** Files changed in this generation. */
  codeChanges: CodeChange[];
  /** Optional test execution results. */
  testResults?: TestResult[];
  /** Evaluation result, populated after evaluate(). */
  verdict?: Verdict;
}

export interface CodeChange {
  path: string;
  content: string;
  operation: 'create' | 'update' | 'delete';
}

export interface TestResult {
  passed: boolean;
  command: string;
  stdout: string;
  stderr: string;
  exitCode: number;
  durationMs: number;
}

export interface Verdict {
  passed: boolean;
  /** 0.0–1.0 composite score. */
  score: number;
  mechanical: MechanicalResult;
  semantic: SemanticResult;
  /** Actionable feedback for the next generation. */
  feedback: string;
}

export interface MechanicalResult {
  buildPassed: boolean;
  testsPassed: boolean;
  lintPassed: boolean;
  /** Per-AC test results. */
  acResults: AcResult[];
}

export interface AcResult {
  acId: string;
  passed: boolean;
  detail: string;
}

export interface SemanticResult {
  /** 0.0–1.0 how well the generation aligns with seed.goal. */
  goalAlignment: number;
  /** 0.0–1.0 constraint compliance. */
  constraintCompliance: number;
  /** 0.0–1.0 0 = no drift, 1 = completely off-track. */
  driftScore: number;
  /** Summary of semantic evaluation. */
  summary: string;
}

export interface Evolution {
  /** Refined seed (may add derived constraints). */
  updatedSeed: Seed;
  /** Prompt to feed into the next generation. */
  prompt: string;
}

export interface LoopOptions {
  cwd: string;
  maxGenerations?: number;
  /** If true, stop immediately on first passing generation. */
  stopOnPass?: boolean;
  /** If true, use a git worktree per generation. */
  useWorktree?: boolean;
}
