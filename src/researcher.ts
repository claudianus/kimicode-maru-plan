import type { ResearchItem } from "./types.js";

/**
 * Conduct research by running the provided queries.
 *
 * Currently returns stub results. Each query becomes a ResearchItem
 * with a placeholder summary.
 */
export async function conductResearch(
	queries: string[],
): Promise<ResearchItem[]> {
	return queries.map((query, index) => ({
		id: `r-${index + 1}`,
		query,
		summary: `Research stub for: ${query}`,
	}));
}
