import type { Generation, Seed, Verdict, MechanicalResult, SemanticResult, TestResult, AcResult } from './types.js';
import { runCommand } from './executor.js';

export interface EvaluatorOptions {
  cwd: string;
}

/**
 * Evaluate a generation against its seed.
 *
 * Mechanical: build, test, lint.
 * Semantic: goal alignment, constraint compliance, drift detection.
 */
export async function evaluateGeneration(
  generation: Generation,
  seed: Seed,
  options: EvaluatorOptions
): Promise<Verdict> {
  const mechanical = await evaluateMechanical(generation, seed, options);
  const semantic = await evaluateSemantic(generation, seed, options);

  const allAcPassed = mechanical.acResults.every((r) => r.passed);
  const passed = mechanical.buildPassed && allAcPassed && semantic.goalAlignment >= 0.8 && semantic.driftScore < 0.3;

  const score = computeScore(mechanical, semantic);
  const feedback = generateFeedback(mechanical, semantic, seed);

  return {
    passed,
    score,
    mechanical,
    semantic,
    feedback,
  };
}

async function evaluateMechanical(
  _generation: Generation,
  seed: Seed,
  options: EvaluatorOptions
): Promise<MechanicalResult> {
  let buildPassed = true;
  let testsPassed = true;
  let lintPassed = true;
  const acResults: AcResult[] = [];

  for (const ac of seed.acceptanceCriteria) {
    if (ac.verificationMethod === 'build') {
      const result = runCommand('bun run build', options.cwd);
      buildPassed = result.exitCode === 0;
      acResults.push({ acId: ac.id, passed: buildPassed, detail: result.stderr || result.stdout });
    } else if (ac.verificationMethod === 'test') {
      const result = runCommand('bun test', options.cwd);
      testsPassed = result.exitCode === 0;
      acResults.push({ acId: ac.id, passed: testsPassed, detail: result.stderr || result.stdout });
    } else if (ac.verificationMethod === 'lint') {
      const result = runCommand('bun run lint', options.cwd);
      lintPassed = result.exitCode === 0;
      acResults.push({ acId: ac.id, passed: lintPassed, detail: result.stderr || result.stdout });
    } else {
      // manual / semantic — evaluated separately
      acResults.push({ acId: ac.id, passed: true, detail: 'Deferred to semantic evaluation' });
    }
  }

  return { buildPassed, testsPassed, lintPassed, acResults };
}

async function evaluateSemantic(
  _generation: Generation,
  seed: Seed,
  _options: EvaluatorOptions
): Promise<SemanticResult> {
  // TODO: Replace with LLM-based semantic evaluation.
  // For the scaffold we return conservative defaults.
  const goalAlignment = 0.5;
  const constraintCompliance = 0.5;
  const driftScore = 0.0;

  return {
    goalAlignment,
    constraintCompliance,
    driftScore,
    summary: `Goal alignment ${goalAlignment}, constraint compliance ${constraintCompliance}, drift ${driftScore}.`,
  };
}

function computeScore(mechanical: MechanicalResult, semantic: SemanticResult): number {
  const mechanicalScore = (mechanical.buildPassed ? 0.25 : 0) + (mechanical.testsPassed ? 0.25 : 0) + (mechanical.lintPassed ? 0.1 : 0);
  const semanticScore = semantic.goalAlignment * 0.3 + (1 - semantic.driftScore) * 0.1;
  return Math.min(1, mechanicalScore + semanticScore);
}

function generateFeedback(mechanical: MechanicalResult, semantic: SemanticResult, seed: Seed): string {
  const lines: string[] = [];

  if (!mechanical.buildPassed) lines.push('Build failed.');
  if (!mechanical.testsPassed) lines.push('Tests failed.');
  if (!mechanical.lintPassed) lines.push('Lint failed.');

  const failedAc = mechanical.acResults.filter((r) => !r.passed);
  for (const ac of failedAc) {
    lines.push(`AC ${ac.acId}: ${ac.detail.slice(0, 200)}`);
  }

  if (semantic.goalAlignment < 0.8) {
    lines.push(`Goal alignment low (${semantic.goalAlignment.toFixed(2)}). Re-read: ${seed.goal}`);
  }
  if (semantic.driftScore >= 0.3) {
    lines.push(`Drift detected (${semantic.driftScore.toFixed(2)}). Pull back to original goal.`);
  }

  if (seed.constraints.length > 0) {
    lines.push(`Constraints: ${seed.constraints.join('; ')}`);
  }

  return lines.join('\n') || 'No issues detected.';
}
