import type { Plan } from '../types.js';

export interface Branch {
  strategy: string;
  plan: Plan;
  score: number;
}

export function createBranch(plan: Plan, strategy: string, score: number): Branch {
  return { plan, strategy, score };
}

export function pruneBranches(branches: Branch[], minScore: number): Branch[] {
  return branches.filter(b => b.score >= minScore);
}

export function getBestBranch(branches: Branch[]): Branch | undefined {
  if (branches.length === 0) return undefined;
  return branches.reduce((best, b) => (b.score > best.score ? b : best));
}
