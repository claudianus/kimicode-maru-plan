import type { Generation, Seed, Verdict, Evolution } from './types.js';

/**
 * Evolve the seed and generation prompt based on the verdict.
 *
 * Drift guard: if driftScore >= critical threshold, reset to original goal.
 * Otherwise, add derived constraints from feedback.
 */
export function evolveSeed(
  seed: Seed,
  generation: Generation,
  verdict: Verdict
): Evolution {
  const CRITICAL_DRIFT = 0.5;
  const WARNING_DRIFT = 0.3;

  let updatedSeed = { ...seed };
  const derivedConstraints: string[] = [];

  // Drift guard
  if (verdict.semantic.driftScore >= CRITICAL_DRIFT) {
    derivedConstraints.push(`CRITICAL DRIFT RESET: Re-anchor to original goal: "${seed.goal}"`);
  } else if (verdict.semantic.driftScore >= WARNING_DRIFT) {
    derivedConstraints.push(`WARNING: Drift ${verdict.semantic.driftScore.toFixed(2)} detected. Tighten scope.`);
  }

  // Mechanical feedback → derived constraints
  if (!verdict.mechanical.buildPassed) {
    derivedConstraints.push('Must pass build before declaring completion.');
  }
  if (!verdict.mechanical.testsPassed) {
    derivedConstraints.push('Must pass all tests before declaring completion.');
  }
  if (!verdict.mechanical.lintPassed) {
    derivedConstraints.push('Must pass lint before declaring completion.');
  }

  // AC-specific feedback
  const failedAc = verdict.mechanical.acResults.filter((r) => !r.passed);
  for (const ac of failedAc) {
    derivedConstraints.push(`Fix AC ${ac.acId}: ${ac.detail.slice(0, 120)}`);
  }

  updatedSeed = {
    ...updatedSeed,
    constraints: [...seed.constraints, ...derivedConstraints],
  };

  const prompt = buildPrompt(updatedSeed, generation, verdict);

  return { updatedSeed, prompt };
}

function buildPrompt(seed: Seed, generation: Generation, verdict: Verdict): string {
  const lines: string[] = [
    `# Evolution Request — Generation ${generation.generationNumber + 1}`,
    '',
    `## Original Goal`,
    seed.goal,
    '',
    `## Constraints`,
    ...seed.constraints.map((c) => `- ${c}`),
    '',
    `## Previous Generation Score`,
    `- Composite: ${verdict.score.toFixed(2)}`,
    `- Goal alignment: ${verdict.semantic.goalAlignment.toFixed(2)}`,
    `- Drift: ${verdict.semantic.driftScore.toFixed(2)}`,
    '',
    `## Feedback`,
    verdict.feedback,
    '',
    `## Instructions`,
    `Produce the next generation of code changes.`,
    `Do not repeat the same mistakes.`,
    `If drift is high, simplify and re-anchor to the original goal.`,
  ];

  if (seed.nonGoals?.length) {
    lines.push('', `## Non-Goals (avoid)`, ...seed.nonGoals.map((ng) => `- ${ng}`));
  }

  if (seed.ethicalConstraints?.length) {
    lines.push('', `## Ethical Guardrails`, ...seed.ethicalConstraints.map((e) => `- ${e}`));
  }

  return lines.join('\n');
}
