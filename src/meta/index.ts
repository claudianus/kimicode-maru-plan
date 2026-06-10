import type { MemoryArchive, MetaEvolution } from '../types.js';
import { evolveRubrics } from './rubric-evolver.js';
import { evolvePrompts } from './prompt-evolver.js';

export { evolveRubrics, evolvePrompts };

export function runMetaEvolution(archive: MemoryArchive): MetaEvolution {
  const rubricSuggestions = evolveRubrics(archive);
  const promptSuggestions = evolvePrompts(archive);

  const parts: string[] = [];
  if (rubricSuggestions.length > 0) {
    parts.push(`${rubricSuggestions.length} rubric adjustment(s) recommended`);
  }
  if (promptSuggestions.length > 0) {
    parts.push(`${promptSuggestions.length} prompt adjustment(s) recommended`);
  }
  if (parts.length === 0) {
    parts.push('No adjustments needed; current strategy is stable');
  }

  const strategyShift = parts.join('; ');

  return {
    rubricSuggestions,
    promptSuggestions,
    strategyShift,
  };
}
