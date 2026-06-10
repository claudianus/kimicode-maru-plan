import { readFileSync } from 'fs';
import YAML from 'yaml';
import type { Seed } from './types.js';

export function parseSeed(path: string): Seed {
  const raw = readFileSync(path, 'utf-8');
  const parsed = YAML.parse(raw) as Partial<Seed>;

  if (!parsed.goal || typeof parsed.goal !== 'string') {
    throw new Error('Seed must have a non-empty "goal" string');
  }
  if (!Array.isArray(parsed.constraints)) {
    throw new Error('Seed must have a "constraints" array');
  }

  const seed: Seed = {
    goal: parsed.goal,
    constraints: parsed.constraints,
    nonGoals: parsed.nonGoals,
    maxGenerations: parsed.maxGenerations ?? 5,
    context: parsed.context,
  };

  return seed;
}
