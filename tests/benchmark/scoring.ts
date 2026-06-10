import type { Plan, Seed, PlanStep } from '../../src/types.js';

function normalizeText(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').trim();
}

function tokenize(text: string): Set<string> {
  return new Set(normalizeText(text).split(/\s+/).filter(Boolean));
}

export function scoreCoverage(plan: Plan, seed: Seed): number {
  if (seed.constraints.length === 0) return 1;
  const haystack = [
    plan.goal,
    ...plan.steps.map((s) => s.description),
    ...plan.assumptions,
    ...plan.risks,
  ]
    .join(' ')
    .toLowerCase();

  let matched = 0;
  for (const c of seed.constraints) {
    const norm = c.toLowerCase();
    if (haystack.includes(norm)) {
      matched++;
    } else {
      // Allow partial word match for short constraints
      const words = norm.split(/\s+/).filter((w) => w.length > 2);
      if (words.length > 0 && words.every((w) => haystack.includes(w))) {
        matched++;
      }
    }
  }
  return matched / seed.constraints.length;
}

export function scoreClarity(plan: Plan): number {
  if (plan.steps.length === 0) return 0;
  const withVerification = plan.steps.filter((s) => s.verificationMethod && s.verificationMethod.trim().length > 0).length;
  const verificationRatio = withVerification / plan.steps.length;

  const avgLen =
    plan.steps.reduce((sum, s) => sum + s.description.length, 0) / plan.steps.length;
  // Heuristic: descriptions between 40 and 200 chars are ideal
  const lengthScore = avgLen < 20 ? 0.2 : avgLen > 300 ? 0.6 : 1;

  return verificationRatio * 0.7 + lengthScore * 0.3;
}

export function scoreFeasibility(plan: Plan): number {
  if (plan.steps.length === 0) return 0;
  const withEffort = plan.steps.filter((s) => s.estimatedEffort && s.estimatedEffort.trim().length > 0).length;
  return withEffort / plan.steps.length;
}

export function scoreAlignment(plan: Plan, seed: Seed): number {
  const planTokens = tokenize(plan.goal);
  const seedTokens = tokenize(seed.goal);
  if (seedTokens.size === 0) return 0;
  const intersection = new Set([...planTokens].filter((x) => seedTokens.has(x)));
  return intersection.size / seedTokens.size;
}

export function scoreCompleteness(plan: Plan): number {
  const haystack = plan.steps.map((s) => s.description.toLowerCase()).join(' ');
  const phases = [
    /\b(init|setup|scaffold|bootstrap|install|configure|create repo|git init)\b/,
    /\b(implement|build|develop|code|write|create|add feature|integrate)\b/,
    /\b(test|verify|validate|check|lint|audit|coverage|spec)\b/,
    /\b(deploy|publish|release|ship|launch|push|ci\/?cd|build for production)\b/,
  ];
  let covered = 0;
  for (const re of phases) {
    if (re.test(haystack)) covered++;
  }
  return covered / phases.length;
}

export function computeBenchmarkScore(plan: Plan, seed: Seed): number {
  const scores = [
    scoreCoverage(plan, seed),
    scoreClarity(plan),
    scoreFeasibility(plan),
    scoreAlignment(plan, seed),
    scoreCompleteness(plan),
  ];
  return scores.reduce((a, b) => a + b, 0) / scores.length;
}
