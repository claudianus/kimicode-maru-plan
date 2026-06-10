import type { ResearchItem } from './types.js';
import YAML from 'yaml';

/**
 * Conduct research by generating stub ResearchItems for each query.
 *
 * @param queries - Research topics or search queries.
 * @returns Array of stub ResearchItems.
 */
export async function conductResearch(queries: string[]): Promise<ResearchItem[]> {
  return queries.map((query, index) => ({
    id: `r-${index + 1}`,
    query,
    summary: `Research stub for: ${query}`,
  }));
}
