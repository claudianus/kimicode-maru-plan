import type { Seed, Plan } from '../types.js';

export function detectStagnation(scores: number[]): boolean {
  if (scores.length < 3) return false;
  const [a, b, c] = scores.slice(-3) as [number, number, number];
  const deltas = [b - a, c - b];
  return deltas.every(d => d < 0.05);
}

export function generateAlternatives(seed: Seed, plan: Plan): string[] {
  // Rule-based alternative generation
  // Conservative: strip to MVP
  // Aggressive: add cutting-edge tech
  // Lateral: solve underlying problem differently
  return [
    `Conservative: Strip scope to MVP. Focus only on core goal "${seed.goal}". Remove non-essential steps.`,
    `Aggressive: Expand with latest tech trends. Add AI automation, real-time features, or advanced analytics.`,
    `Lateral: Don't build from scratch. Use existing platforms (SaaS, no-code, managed services) to achieve the same outcome faster.`,
  ];
}
