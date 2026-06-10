import type { Seed, Plan, PersonaVerdict } from './types.js';

export interface GateResult {
  passed: boolean;
  gateName: string;
  violations: string[];
}

export function runPreGenerationGate(seed: Seed): GateResult {
  const violations: string[] = [];
  if (!seed.goal || seed.goal.trim().length === 0) violations.push('Goal is empty');
  if (seed.goal.length > 200) violations.push('Goal exceeds 200 characters');
  const hasNoun = /\b(project|app|site|website|web|frontend|landing page|page|platform|feature|api|service|blog|tool|system)\b/i.test(seed.goal);
  const hasVerb = /\b(build|create|make|develop|implement|design|deploy|add|integrate)\b/i.test(seed.goal);
  if (!hasNoun) violations.push('Goal should contain a noun (e.g., app, site, API)');
  if (!hasVerb) violations.push('Goal should contain a verb (e.g., build, create, deploy)');
  // Check for contradicting constraints
  const lowered = seed.constraints.map(c => c.toLowerCase());
  for (let i = 0; i < lowered.length; i++) {
    for (let j = i + 1; j < lowered.length; j++) {
      const a = lowered[i];
      const b = lowered[j];
      if (a && b && (a.includes('not ' + b) || b.includes('not ' + a))) {
        violations.push(`Contradicting constraints detected: "${seed.constraints[i]}" vs "${seed.constraints[j]}"`);
      }
    }
  }
  return { passed: violations.length === 0, gateName: 'Pre-Generation', violations };
}

export function runPostEvaluationGate(plan: Plan, seed: Seed): GateResult {
  const violations: string[] = [];
  if (plan.steps.length < 3) violations.push('Plan must have at least 3 steps');
  if (plan.assumptions.length < 1) violations.push('Plan must have at least 1 assumption');
  if (plan.risks.length < 1) violations.push('Plan must have at least 1 risk');
  // Detect duplicate step descriptions
  const descs = plan.steps.map(s => s.description.toLowerCase().trim());
  const seen = new Set<string>();
  for (const d of descs) {
    if (seen.has(d)) violations.push(`Duplicate step description: "${d}"`);
    seen.add(d);
  }
  // Drift check (simplified Jaccard)
  const planWords = new Set(plan.goal.toLowerCase().split(/\s+/));
  const seedWords = new Set(seed.goal.toLowerCase().split(/\s+/));
  const intersection = new Set([...planWords].filter(w => seedWords.has(w)));
  const overlap = planWords.size > 0 ? intersection.size / planWords.size : 0;
  if (overlap < 0.5) violations.push(`Plan goal diverges from seed goal (overlap ${(overlap * 100).toFixed(0)}%)`);
  return { passed: violations.length === 0, gateName: 'Post-Evaluation', violations };
}

export function runConsensusGate(personaVerdicts: PersonaVerdict[]): GateResult {
  const violations: string[] = [];
  for (const pv of personaVerdicts) {
    if (pv.score < 0.75) {
      violations.push(`${pv.persona} score ${pv.score.toFixed(2)} is below minimum threshold (0.75)`);
    }
  }
  return { passed: violations.length === 0, gateName: 'Consensus', violations };
}
