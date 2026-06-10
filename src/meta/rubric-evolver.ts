import type { MemoryArchive, GenerationMemory } from '../types.js';

const DIMENSIONS = [
  { key: 'ambiguity' as const, label: 'ambiguity', defaultWeight: 25 },
  { key: 'completeness' as const, label: 'completeness', defaultWeight: 30 },
  { key: 'feasibility' as const, label: 'feasibility', defaultWeight: 25 },
  { key: 'goalAlignment' as const, label: 'goalAlignment', defaultWeight: 20 },
];

export function evolveRubrics(archive: MemoryArchive): string[] {
  const last3 = archive.memories.slice(-3);
  if (last3.length === 0) return [];

  const suggestions: string[] = [];

  for (const dim of DIMENSIONS) {
    const scores = last3.map((m) => m.verdict[dim.key]);
    const avg = scores.reduce((a, b) => a + b, 0) / scores.length;

    if (avg < 0.5) {
      const newWeight = Math.min(dim.defaultWeight + 10, 50);
      suggestions.push(
        `${dim.label} has averaged ${avg.toFixed(2)} over the last ${last3.length} generations; consider increasing its weight from ${dim.defaultWeight}% to ${newWeight}%`
      );
    } else if (avg > 0.9) {
      const newWeight = Math.max(dim.defaultWeight - 10, 10);
      suggestions.push(
        `${dim.label} has averaged ${avg.toFixed(2)} over the last ${last3.length} generations; consider decreasing its weight from ${dim.defaultWeight}% to ${newWeight}% (diminishing returns)`
      );
    }
  }

  return suggestions;
}
