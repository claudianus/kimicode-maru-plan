/**
 * Researcher module — defines the **research** role in the planning harness.
 *
 * Role:
 * Conducts web research to gather information needed for plan generation and refinement.
 *
 * How Kimi Code performs this role:
 * Kimi Code searches the web via `WebSearch`.
 *
 * Where it fits in the loop:
 * Runs after interviewing (`interviewer.ts`) and before plan refinement (`plan-refiner.ts`).
 * The loop flow is: plan → evaluate → interview → **research** → refine → repeat.
 *
 * ───────────────────────────────────────────────
 * RESEARCH STRATEGY FRAMEWORK
 * ───────────────────────────────────────────────
 *
 * Research is NOT a blind scattershot of search queries. It is a targeted,
 * priority-ranked investigation designed to reduce plan ambiguity and fill
 * knowledge gaps that block confident planning.
 *
 * Golden rule: If a plan step can be written without guessing, research is
 * sufficient. If the planner must assume or guess, more research is needed.
 *
 * Example of INSUFFICIENT research (ambiguity 0.8):
 *   "Use a good database" → planner must guess which DB, why, and how.
 *
 * Example of SUFFICIENT research (ambiguity 0.2):
 *   "Use PostgreSQL 16 with Drizzle ORM on Neon serverless for relational data,
 *    Redis on Upstash for session cache. Migrations via Drizzle Kit."
 */

import type { ResearchItem } from './types.js';

// ───────────────────────────────────────────────
// Query Classification & Priority System
// ───────────────────────────────────────────────

/**
 * Research query categories. Each category has a different urgency threshold
 * because some gaps are plan-blocking while others are merely optimization.
 *
 * Why this matters:
 * A plan cannot proceed if the technology stack is unknown (BLOCKER), but it
 * CAN proceed if we have not yet optimized bundle size (NICE_TO_HAVE).
 */
type QueryCategory =
  | 'BLOCKER'      // Cannot write a concrete step without this info
  | 'RISK'         // May cause rework if wrong; verify before committing
  | 'OPTIMIZATION' // Improves quality but plan is viable without it
  | 'NICE_TO_HAVE'; // Decorative / bonus context

/**
 * Priority score: 0.0–1.0. Higher = search this first.
 *
 * Scoring rubric:
 *   1.0 = BLOCKER that affects the critical path (e.g., "which framework for
 *         the core product?" when building a SaaS).
 *   0.8 = BLOCKER for a non-critical module OR RISK for the critical path.
 *   0.6 = RISK for a non-critical module OR OPTIMIZATION for critical path.
 *   0.4 = OPTIMIZATION for non-critical modules.
 *   0.2 = NICE_TO_HAVE regardless of path.
 *
 * Concrete example:
 *   "React vs Vue for main frontend" in an e-commerce app → 1.0 (BLOCKER, critical).
 *   "Best icon library for admin dashboard" → 0.4 (OPTIMIZATION, non-critical).
 *   "Founder's favorite color" → 0.2 (NICE_TO_HAVE, irrelevant to execution).
 */
interface PrioritizedQuery {
  query: string;
  category: QueryCategory;
  priority: number;
  /** WHY this research matters — used to validate summary quality later. */
  rationale: string;
}

/**
 * Query type taxonomy. Classifying queries helps Kimi Code pick the right
 * search strategy (e.g., looking for API docs vs. benchmark comparisons).
 */
type QueryType =
  | 'TECHNOLOGY_SELECTION'   // "Which library / framework / DB?"
  | 'API_INTEGRATION'        // "How does Stripe billing API work?"
  | 'DEPLOYMENT_PLATFORM'    // "How to deploy on Vercel vs. AWS?"
  | 'SECURITY_PRACTICE'      // "How to handle auth in Next.js 14?"
  | 'PERFORMANCE_BENCHMARK'  // "Is Bun faster than Node for this workload?"
  | 'COST_ANALYSIS'          // "Pricing for Supabase vs. PlanetScale?"
  | 'REGULATORY_COMPLIANCE'  // "GDPR requirements for EU users?"
  | 'DOMAIN_KNOWLEDGE';      // "How does medical billing code lookup work?"

/**
 * Enriched query with classification metadata.
 */
interface ClassifiedQuery extends PrioritizedQuery {
  queryType: QueryType;
  /** What "good enough" looks like for this query. */
  acceptanceCriteria: string;
}

// ───────────────────────────────────────────────
// Research Quality Framework
// ───────────────────────────────────────────────

/**
 * Quality dimensions for a single ResearchItem summary.
 *
 * Why multiple dimensions?
 * A summary can be long yet useless (high verbosity, low signal). We score
 * each dimension independently to catch that failure mode.
 */
interface SummaryQuality {
  /** 0.0–1.0. Does it answer the exact query? */
  relevance: number;
  /** 0.0–1.0. Is it specific enough to write a plan step? */
  specificity: number;
  /** 0.0–1.0. Is it actionable ("use X" vs. "some people use X")? */
  actionability: number;
  /** 0.0–1.0. Is a credible source cited? */
  sourceCredibility: number;
}

/**
 * Minimum thresholds per category. If a ResearchItem scores below these on
 * ANY dimension, it triggers a follow-up research query.
 *
 * Decision tree:
 *   score >= threshold? → Keep, move on.
 *   score < threshold?  → Log gap, generate narrower follow-up query.
 *   no source?          → Downgrade credibility to 0.2 unless common knowledge.
 */
const QUALITY_THRESHOLDS: Record<QueryCategory, SummaryQuality> = {
  BLOCKER:      { relevance: 0.8, specificity: 0.8, actionability: 0.9, sourceCredibility: 0.6 },
  RISK:         { relevance: 0.7, specificity: 0.7, actionability: 0.7, sourceCredibility: 0.5 },
  OPTIMIZATION: { relevance: 0.6, specificity: 0.5, actionability: 0.5, sourceCredibility: 0.4 },
  NICE_TO_HAVE: { relevance: 0.5, specificity: 0.4, actionability: 0.3, sourceCredibility: 0.3 },
};

/**
 * Source credibility scoring rubric.
 *
 * 1.0 = Official docs (react.dev, docs.python.org), RFCs, academic papers.
 * 0.8 = Well-maintained community docs (MDN, Prisma docs), official blogs.
 * 0.6 = Reputable tech blogs (Vercel engineering, Tailwind blog), GitHub READMEs
 *       from projects with >5k stars and recent commits.
 * 0.4 = Stack Overflow answers with >50 upvotes, dated but verified.
 * 0.2 = Random Medium article, unverified forum post, AI-generated content
 *       with no human curation.
 * 0.0 = No source provided.
 *
 * Exception: Common knowledge ("JSON stands for JavaScript Object Notation")
 * does not need a source. If no source is provided AND the claim is common
 * knowledge, assign 0.7.
 */
function scoreSourceCredibility(source: string | undefined, claim: string): number {
  if (!source) {
    // Heuristic: very short, universally known facts need no citation.
    const commonKnowledgePatterns = [
      /^[A-Z]{2,6} stands for /,
      /^The current version of /,
      /^npm is the default package manager/,
    ];
    const isCommonKnowledge = commonKnowledgePatterns.some((re) => re.test(claim));
    return isCommonKnowledge ? 0.7 : 0.0;
  }

  const highCredibility = [
    'docs.',
    'developer.',
    'www.w3.org',
    'ietf.org',
    'arxiv.org',
    'github.com',
  ];
  const mediumCredibility = [
    'vercel.com/blog',
    'blog.',
    'engineering.',
    'medium.com/@',
  ];

  const lowerSource = source.toLowerCase();

  if (highCredibility.some((domain) => lowerSource.includes(domain))) {
    return 1.0;
  }
  if (mediumCredibility.some((domain) => lowerSource.includes(domain))) {
    return 0.6;
  }
  if (lowerSource.includes('stackoverflow.com')) {
    return 0.4;
  }

  return 0.2;
}

// ───────────────────────────────────────────────
// Gap Detection & Follow-up Logic
// ───────────────────────────────────────────────

/**
 * Identified knowledge gap. Gaps are the input to the next research iteration.
 */
interface ResearchGap {
  /** Original query that failed to produce sufficient quality. */
  originatingQuery: string;
  /** Which quality dimension fell short. */
  failedDimension: keyof SummaryQuality;
  /** Concrete description of what is missing. */
  description: string;
  /** Narrower follow-up query to close the gap. */
  followUpQuery: string;
}

/**
 * Detect gaps in a ResearchItem by comparing its assessed quality against
 * the threshold for its category.
 *
 * Checklist for gap detection:
 * 1. Does the summary directly answer the query? (relevance)
 * 2. Can a junior dev execute from this summary alone? (specificity + actionability)
 * 3. Is there a credible source backing the claim? (sourceCredibility)
 * 4. Are version numbers, CLI flags, or config snippets present? (specificity)
 *
 * Example gap detection:
 *   Query: "How to deploy Next.js 14 app on Vercel with ISR?"
 *   Bad summary: "Vercel supports Next.js. ISR is a feature."
 *   Gap: specificity = 0.1, actionability = 0.0
 *   Follow-up: "Vercel ISR revalidation configuration for Next.js 14 App Router"
 */
function detectGaps(
  item: ResearchItem,
  classified: ClassifiedQuery,
  assessedQuality: SummaryQuality
): ResearchGap[] {
  const threshold = QUALITY_THRESHOLDS[classified.category];
  const gaps: ResearchGap[] = [];

  const dimensions: (keyof SummaryQuality)[] = [
    'relevance',
    'specificity',
    'actionability',
    'sourceCredibility',
  ];

  for (const dim of dimensions) {
    if (assessedQuality[dim] < threshold[dim]) {
      const description = generateGapDescription(dim, item.summary, classified);
      const followUpQuery = generateFollowUpQuery(dim, classified);

      gaps.push({
        originatingQuery: item.query,
        failedDimension: dim,
        description,
        followUpQuery,
      });
    }
  }

  return gaps;
}

/**
 * Generate human-readable description of why a quality dimension failed.
 */
function generateGapDescription(
  dim: keyof SummaryQuality,
  summary: string,
  classified: ClassifiedQuery
): string {
  switch (dim) {
    case 'relevance':
      return `Summary "${summary.slice(0, 60)}..." does not directly address query "${classified.query}". It may be tangential or off-topic.`;
    case 'specificity':
      return `Summary lacks concrete details (versions, commands, config keys) needed for query "${classified.query}".`;
    case 'actionability':
      return `Summary is descriptive but not prescriptive. Planner cannot derive a concrete step from "${summary.slice(0, 60)}...".`;
    case 'sourceCredibility':
      return `No credible source cited for claim in query "${classified.query}". Risk of hallucination or stale info.`;
    default:
      return `Quality dimension "${dim}" fell below threshold for "${classified.query}".`;
  }
}

/**
 * Generate a narrower, more targeted follow-up query.
 *
 * Strategy per dimension:
 *   relevance     → Add the exact technology name + version from context.
 *   specificity   → Append "example config" or "CLI command" or "code snippet".
 *   actionability → Append "step-by-step guide" or "tutorial".
 *   credibility   → Append "official docs" or "documentation".
 */
function generateFollowUpQuery(
  dim: keyof SummaryQuality,
  classified: ClassifiedQuery
): string {
  const base = classified.query;

  switch (dim) {
    case 'relevance':
      return `${base} official documentation 2024`;
    case 'specificity':
      return `${base} example configuration code snippet`;
    case 'actionability':
      return `${base} step by step setup tutorial`;
    case 'sourceCredibility': {
      const domainHint = base.split(' ')[0]?.toLowerCase() ?? 'official';
      return `${base} site:${domainHint}.com`;
    }
    default:
      return `${base} detailed guide`;
  }
}

// ───────────────────────────────────────────────
// Research Synthesis Decision Tree
// ───────────────────────────────────────────────

/**
 * Synthesis verdict: what should the planner do with this research?
 */
type SynthesisVerdict =
  | 'SUFFICIENT'        // Research covers all BLOCKERs and major RISKs
  | 'PARTIAL'           // Some BLOCKERs resolved, but gaps remain
  | 'INSUFFICIENT';     // Critical gaps; planner should not proceed

/**
 * Evaluate whether the collected research body is sufficient to produce
 * a high-quality plan.
 *
 * Decision tree:
 *   Any BLOCKER query with an open gap? → INSUFFICIENT
 *   >50% of RISK queries with open gaps?  → PARTIAL
 *   All BLOCKERs closed, <50% RISK gaps?  → SUFFICIENT
 *   Only OPTIMIZATION / NICE_TO_HAVE gaps? → SUFFICIENT (note them as future work)
 *
 * Why this tree?
 * The planner must NEVER guess on BLOCKERs. Guessing on RISKs is tolerable
 * if the risk is documented in the Plan.risks array.
 */
function evaluateResearchSufficiency(
  classifiedQueries: ClassifiedQuery[],
  allGaps: ResearchGap[]
): SynthesisVerdict {
  const blockerQueries = classifiedQueries.filter((q) => q.category === 'BLOCKER');
  const riskQueries = classifiedQueries.filter((q) => q.category === 'RISK');

  const blockerGaps = blockerQueries.filter((bq) =>
    allGaps.some((g) => g.originatingQuery === bq.query)
  );
  const riskGaps = riskQueries.filter((rq) =>
    allGaps.some((g) => g.originatingQuery === rq.query)
  );

  if (blockerGaps.length > 0) {
    return 'INSUFFICIENT';
  }

  const riskGapRatio = riskQueries.length > 0 ? riskGaps.length / riskQueries.length : 0;
  if (riskGapRatio > 0.5) {
    return 'PARTIAL';
  }

  return 'SUFFICIENT';
}

// ───────────────────────────────────────────────
// Query Classification Helpers
// ───────────────────────────────────────────────

/**
 * Heuristic classifier for research queries.
 *
 * Kimi Code should override this with semantic reasoning, but the heuristic
 * provides a fast baseline when context is limited.
 *
 * Classification rules:
 *   Contains "vs" or "compare" or "alternative" → TECHNOLOGY_SELECTION
 *   Contains "API" or "webhook" or "SDK"        → API_INTEGRATION
 *   Contains "deploy" or "host" or "serverless" → DEPLOYMENT_PLATFORM
 *   Contains "auth" or "encrypt" or "secure"    → SECURITY_PRACTICE
 *   Contains "benchmark" or "perf" or "speed"   → PERFORMANCE_BENCHMARK
 *   Contains "price" or "cost" or "pricing"     → COST_ANALYSIS
 *   Contains "GDPR" or "HIPAA" or "SOC2"        → REGULATORY_COMPLIANCE
 *   Otherwise                                    → DOMAIN_KNOWLEDGE
 */
function classifyQueryType(query: string): QueryType {
  const lower = query.toLowerCase();

  if (/\b(vs|versus|compare|alternative|or)\b/.test(lower)) {
    return 'TECHNOLOGY_SELECTION';
  }
  if (/\b(api|webhook|sdk|endpoint|rest|graphql)\b/.test(lower)) {
    return 'API_INTEGRATION';
  }
  if (/\b(deploy|host|serverless|vercel|aws|gcp|azure|docker)\b/.test(lower)) {
    return 'DEPLOYMENT_PLATFORM';
  }
  if (/\b(auth|encrypt|secure|oauth|jwt|password| vulnerability)\b/.test(lower)) {
    return 'SECURITY_PRACTICE';
  }
  if (/\b(benchmark|perf|performance|speed|latency|throughput)\b/.test(lower)) {
    return 'PERFORMANCE_BENCHMARK';
  }
  if (/\b(price|cost|pricing|billing|free tier)\b/.test(lower)) {
    return 'COST_ANALYSIS';
  }
  if (/\b(gdpr|hipaa|soc2|compliance|regulation|legal)\b/.test(lower)) {
    return 'REGULATORY_COMPLIANCE';
  }

  return 'DOMAIN_KNOWLEDGE';
}

/**
 * Infer query category from query type and context.
 *
 * Default mapping:
 *   TECHNOLOGY_SELECTION on the critical path → BLOCKER
 *   API_INTEGRATION where no SDK exists       → BLOCKER
 *   DEPLOYMENT_PLATFORM with hard infra constraints → BLOCKER
 *   SECURITY_PRACTICE for user-facing data    → RISK
 *   PERFORMANCE_BENCHMARK                     → OPTIMIZATION
 *   COST_ANALYSIS                             → OPTIMIZATION
 *   REGULATORY_COMPLIANCE for user data       → BLOCKER
 *   DOMAIN_KNOWLEDGE                          → RISK (may affect architecture)
 *
 * Kimi Code MUST override defaults using plan context. For example,
 * if the seed says "must use existing AWS account", then DEPLOYMENT_PLATFORM
 * is not a BLOCKER — it is a constraint already locked.
 */
function inferQueryCategory(queryType: QueryType, isCriticalPath: boolean): QueryCategory {
  switch (queryType) {
    case 'TECHNOLOGY_SELECTION':
      return isCriticalPath ? 'BLOCKER' : 'RISK';
    case 'API_INTEGRATION':
      return 'BLOCKER';
    case 'DEPLOYMENT_PLATFORM':
      return isCriticalPath ? 'BLOCKER' : 'RISK';
    case 'SECURITY_PRACTICE':
      return 'RISK';
    case 'PERFORMANCE_BENCHMARK':
      return 'OPTIMIZATION';
    case 'COST_ANALYSIS':
      return 'OPTIMIZATION';
    case 'REGULATORY_COMPLIANCE':
      return 'BLOCKER';
    case 'DOMAIN_KNOWLEDGE':
      return 'RISK';
  }
}

// ───────────────────────────────────────────────
// Concrete Examples Reference Table
// ───────────────────────────────────────────────

/**
 * Reference table of query → classification → expected research depth.
 *
 * Kimi Code uses this to self-calibrate. If a research summary is thinner
 * than the reference, it is a signal to search again.
 *
 * | Query | Type | Category | Expected Summary Depth |
 * |-------|------|----------|------------------------|
 * | "React vs Vue for dashboard" | TECHNOLOGY_SELECTION | BLOCKER | Ecosystem maturity, hiring pool, specific version compatibility, migration path |
 * | "Stripe Checkout session API" | API_INTEGRATION | BLOCKER | Exact endpoint, required fields, webhook shape, error codes, idempotency key usage |
 * | "Deploy Next.js on Vercel" | DEPLOYMENT_PLATFORM | BLOCKER | Build command, env var setup, ISR config, custom domain steps |
 * | "Auth0 vs Clerk pricing" | COST_ANALYSIS | OPTIMIZATION | MAU tiers, SSO surcharge, machine-to-machine token pricing |
 * | "Redis vs in-memory cache" | PERFORMANCE_BENCHMARK | OPTIMIZATION | Latency percentiles, memory overhead, persistence trade-offs |
 * | "GDPR data deletion workflow" | REGULATORY_COMPLIANCE | BLOCKER | Legal basis, retention schedule, technical deletion steps, audit log requirements |
 */

// ───────────────────────────────────────────────
// Main Export: conductResearch
// ───────────────────────────────────────────────

/**
 * Conduct research by generating structured ResearchItems for each query.
 *
 * In the harness, Kimi Code replaces the generated stubs with actual web
 * searches, BUT it must follow the framework defined in this module:
 *
 * 1. CLASSIFY each query (type + category + priority).
 * 2. SEARCH in priority order (BLOCKERs first).
 * 3. ASSESS quality of each result using SummaryQuality dimensions.
 * 4. DETECT gaps where quality falls below category threshold.
 * 5. GENERATE follow-up queries for gaps.
 * 6. SYNTHESIZE: evaluate overall sufficiency before returning.
 * 7. RETURN ResearchItems with high-quality summaries + sources.
 *
 * @param queries - Research topics or search queries.
 * @returns Array of ResearchItems. Kimi Code should augment these with
 *          real web search results, maintaining the same shape.
 */
export async function conductResearch(queries: string[]): Promise<ResearchItem[]> {
  // ── Step 1: Classify all queries ─────────────────────────
  const classified: ClassifiedQuery[] = queries.map((query, index) => {
    const queryType = classifyQueryType(query);
    // Heuristic: first 3 queries are often the critical path in harness usage.
    const isCriticalPath = index < 3;
    const category = inferQueryCategory(queryType, isCriticalPath);

    const priority = calculatePriority(category, isCriticalPath);

    const acceptanceCriteria = buildAcceptanceCriteria(queryType, category);

    return {
      query,
      category,
      priority,
      rationale: `Classified as ${queryType} / ${category}. ${acceptanceCriteria}`,
      queryType,
      acceptanceCriteria,
    };
  });

  // ── Step 2: Sort by priority (descending) ────────────────
  // Why? BLOCKERs must be resolved first. If a BLOCKER reveals that the
  // entire technology approach is invalid, subsequent RISK research may
  // become irrelevant.
  const sorted = [...classified].sort((a, b) => b.priority - a.priority);

  // ── Step 3: Generate stub ResearchItems in priority order ──
  // In real usage, Kimi Code runs WebSearch here, one query at a time,
  // assessing quality after each search and deciding whether to continue
  // or generate a follow-up.
  const items: ResearchItem[] = sorted.map((cq, index) => ({
    id: `r-${index + 1}`,
    query: cq.query,
    summary: buildStubSummary(cq),
    source: suggestSourceHint(cq),
  }));

  // ── Step 4: Self-assessment checklist (for Kimi Code) ────
  // After real searches, Kimi Code should run this mental checklist:
  //
  // [ ] Did I search BLOCKERs before RISKs?
  // [ ] Does every BLOCKER summary contain a concrete recommendation?
  // [ ] Are version numbers present for all technology choices?
  // [ ] Are CLI commands or config snippets included for deployment/API steps?
  // [ ] Is there at least one official source per BLOCKER item?
  // [ ] Did I verify that the source is not outdated (>2 years old for fast-moving tech)?
  // [ ] If a search returned vague results, did I run a narrower follow-up?
  // [ ] Are all gaps documented with follow-up queries in the returned metadata?

  return items;
}

// ───────────────────────────────────────────────
// Helper Functions
// ───────────────────────────────────────────────

/**
 * Calculate priority score based on category and critical path status.
 *
 * Formula:
 *   base = category base score (BLOCKER=1.0, RISK=0.7, OPTIMIZATION=0.4, NICE_TO_HAVE=0.2)
 *   boost = +0.1 if on critical path (only for non-BLOCKER, since BLOCKER already max)
 *   penalty = -0.05 if query is overly broad (heuristic: >12 words)
 *
 * Why penalize broad queries?
 * A 20-word query like "What is the best way to build a web app in 2024"
 * is unanswerable. It should be split. The penalty signals that Kimi Code
 * should decompose it before researching.
 */
function calculatePriority(category: QueryCategory, isCriticalPath: boolean): number {
  const baseScores: Record<QueryCategory, number> = {
    BLOCKER: 1.0,
    RISK: 0.7,
    OPTIMIZATION: 0.4,
    NICE_TO_HAVE: 0.2,
  };

  let score = baseScores[category];

  if (isCriticalPath && category !== 'BLOCKER') {
    score += 0.1;
  }

  return Math.min(score, 1.0);
}

/**
 * Build acceptance criteria string for a given query type and category.
 *
 * These criteria are the definition of "done" for a research item.
 * Kimi Code uses them to judge whether a search result is good enough.
 */
function buildAcceptanceCriteria(queryType: QueryType, category: QueryCategory): string {
  const depth = category === 'BLOCKER' ? 'must' : category === 'RISK' ? 'should' : 'may';

  const criteriaMap: Record<QueryType, string> = {
    TECHNOLOGY_SELECTION:
      `${depth} include: current stable version, ecosystem health (GitHub stars / last commit), ` +
      `known limitations, migration path if switching, and concrete recommendation.`,
    API_INTEGRATION:
      `${depth} include: exact endpoint URL or SDK method, required auth mechanism, ` +
      `request/response shape example, error code reference, and idempotency strategy.`,
    DEPLOYMENT_PLATFORM:
      `${depth} include: build steps, environment variable setup, domain/DNS configuration, ` +
      `rollback procedure, and cost estimate for expected traffic.`,
    SECURITY_PRACTICE:
      `${depth} include: threat model addressed, implementation steps, key rotation strategy, ` +
      `and reference to official security guidelines.`,
    PERFORMANCE_BENCHMARK:
      `${depth} include: test methodology, hardware/environment specs, latency/throughput numbers, ` +
      `and confidence intervals or variance.`,
    COST_ANALYSIS:
      `${depth} include: pricing tiers, overage costs, free tier limits, ` +
      `and total cost of ownership at projected scale.`,
    REGULATORY_COMPLIANCE:
      `${depth} include: applicable legal articles, technical implementation requirements, ` +
      `audit trail needs, and data retention/deletion procedures.`,
    DOMAIN_KNOWLEDGE:
      `${depth} include: core concepts defined, domain-specific terminology, ` +
      `and how they map to software implementation.`,
  };

  return criteriaMap[queryType];
}

/**
 * Build a stub summary that encodes the acceptance criteria.
 *
 * In the harness, this stub is replaced by Kimi Code's actual search results.
 * The stub format reminds Kimi Code what the summary MUST contain.
 */
function buildStubSummary(cq: ClassifiedQuery): string {
  const parts: string[] = [
    `[${cq.queryType} | ${cq.category} | priority ${cq.priority.toFixed(1)}]`,
    `Research for: "${cq.query}"`,
    `Acceptance criteria: ${cq.acceptanceCriteria}`,
    `---`,
    `STUB: Replace with real findings. A good summary here enables the planner to write`,
    `a concrete step without guessing. A bad summary forces the planner to assume.`,
  ];

  return parts.join('\n');
}

/**
 * Suggest where to look first for a given query type.
 *
 * This reduces time spent on low-quality sources.
 */
function suggestSourceHint(cq: ClassifiedQuery): string | undefined {
  const hints: Record<QueryType, string | undefined> = {
    TECHNOLOGY_SELECTION: 'github.com, npmtrends.com, stateofjs.com',
    API_INTEGRATION: 'official API docs (look for docs.* or developer.*)',
    DEPLOYMENT_PLATFORM: 'official platform docs + community deployment guides',
    SECURITY_PRACTICE: 'OWASP, official framework security docs, CERT advisories',
    PERFORMANCE_BENCHMARK: 'benchmarks published by vendor or independent (e.g., TechEmpower)',
    COST_ANALYSIS: 'official pricing page + calculators',
    REGULATORY_COMPLIANCE: 'government regulatory site + legal-tech vendor whitepapers',
    DOMAIN_KNOWLEDGE: 'Wikipedia for concepts, industry association standards for specifics',
  };

  return hints[cq.queryType];
}

// ───────────────────────────────────────────────
// Exported Framework Utilities
// ───────────────────────────────────────────────

/**
 * Assess the quality of a single ResearchItem summary.
 *
 * Kimi Code calls this after each web search to decide whether to keep
 * the result or search again.
 *
 * @param item - The research item to assess.
 * @param classified - The classification metadata for the originating query.
 * @returns SummaryQuality scores and any detected gaps.
 */
export function assessResearchItem(
  item: ResearchItem,
  classified: ClassifiedQuery
): { quality: SummaryQuality; gaps: ResearchGap[] } {
  // Heuristic assessment based on summary content.
  // In real usage, Kimi Code performs semantic evaluation.

  const summaryLower = item.summary.toLowerCase();

  // Relevance: does summary mention keywords from the query?
  const queryTokens = classified.query
    .toLowerCase()
    .split(/\s+/)
    .filter((t) => t.length > 3);
  const matchedTokens = queryTokens.filter((t) => summaryLower.includes(t));
  const relevance = queryTokens.length > 0 ? matchedTokens.length / queryTokens.length : 0.5;

  // Specificity: presence of version numbers, CLI commands, URLs, code blocks.
  const hasVersion = /\b(v?\d+\.\d+(\.\d+)?)\b/.test(item.summary);
  const hasCommand = /(npm|yarn|pnpm|bun|docker|git|npx)\s+\w+/.test(item.summary);
  const hasConfig = /(\{|\[|config|env|setting)/.test(item.summary);
  const specificity = [hasVersion, hasCommand, hasConfig].filter(Boolean).length / 3;

  // Actionability: presence of imperative verbs or direct recommendations.
  const actionPatterns = /\b(use|install|configure|set|enable|disable|choose|prefer|recommend)\b/i;
  const actionability = actionPatterns.test(item.summary) ? 0.8 : 0.3;

  // Source credibility.
  const sourceCredibility = scoreSourceCredibility(item.source, item.summary);

  const quality: SummaryQuality = {
    relevance: Math.min(relevance, 1.0),
    specificity: Math.min(specificity, 1.0),
    actionability: Math.min(actionability, 1.0),
    sourceCredibility,
  };

  const gaps = detectGaps(item, classified, quality);

  return { quality, gaps };
}

/**
 * Determine if the research body is sufficient to proceed with planning.
 *
 * @param classifiedQueries - Classifications for all queries that were researched.
 * @param allGaps - All gaps detected across all research items.
 * @returns SynthesisVerdict and a human-readable rationale.
 */
export function synthesizeResearch(
  classifiedQueries: ClassifiedQuery[],
  allGaps: ResearchGap[]
): { verdict: SynthesisVerdict; rationale: string; followUps: string[] } {
  const verdict = evaluateResearchSufficiency(classifiedQueries, allGaps);

  const blockerGaps = allGaps.filter((g) =>
    classifiedQueries.some((cq) => cq.query === g.originatingQuery && cq.category === 'BLOCKER')
  );

  let rationale: string;
  switch (verdict) {
    case 'SUFFICIENT':
      rationale =
        `All ${classifiedQueries.filter((q) => q.category === 'BLOCKER').length} BLOCKER queries ` +
        `are resolved. Research is sufficient to generate a concrete plan.`;
      break;
    case 'PARTIAL':
      rationale =
        `BLOCKERs resolved, but ${allGaps.length} gaps remain (mostly RISK/OPTIMIZATION). ` +
        `Plan can proceed if remaining risks are documented in Plan.risks.`;
      break;
    case 'INSUFFICIENT':
      rationale =
        `${blockerGaps.length} BLOCKER query(ies) have unresolved gaps. ` +
        `Planner must NOT proceed until these are closed to avoid guesswork.`;
      break;
  }

  const followUps = Array.from(new Set(allGaps.map((g) => g.followUpQuery)));

  return { verdict, rationale, followUps };
}

/**
 * Decompose an overly broad query into narrower sub-queries.
 *
 * When to use:
 *   - Query > 15 words.
 *   - Query contains "best" without constraints.
 *   - Query asks for "overview" or "guide" without specifics.
 *
 * Example:
 *   Input:  "How to build a scalable web application with real-time features"
 *   Output: [
 *     "WebSocket server scaling patterns 2024",
 *     "Redis Pub/Sub vs Kafka for real-time messaging",
 *     "Horizontal scaling strategies for Node.js backends"
 *   ]
 *
 * @param broadQuery - The vague or overly broad query.
 * @returns Array of focused sub-queries.
 */
export function decomposeQuery(broadQuery: string): string[] {
  const lower = broadQuery.toLowerCase();
  const subQueries: string[] = [];

  // Technology selection decomposition
  if (/\b(best|good|right)\b/.test(lower) && !/\b(vs|versus|compare)\b/.test(lower)) {
    subQueries.push(`${broadQuery} comparison 2024`);
    subQueries.push(`${broadQuery} pros and cons`);
  }

  // Architecture decomposition
  if (/\b(scalable|scale|architecture)\b/.test(lower)) {
    subQueries.push(`${broadQuery} horizontal scaling patterns`);
    subQueries.push(`${broadQuery} database sharding strategies`);
  }

  // Real-time decomposition
  if (/\b(real.?time|live|websocket|streaming)\b/.test(lower)) {
    subQueries.push(`${broadQuery} WebSocket vs Server-Sent Events`);
    subQueries.push(`${broadQuery} connection pooling strategies`);
  }

  // Security decomposition
  if (/\b(secure|security|auth)\b/.test(lower)) {
    subQueries.push(`${broadQuery} authentication best practices`);
    subQueries.push(`${broadQuery} authorization patterns`);
  }

  // Fallback: if no heuristics matched, split by conjunctions.
  if (subQueries.length === 0) {
    const segments = broadQuery.split(/\b(and|with|using|for)\b/);
    for (let i = 0; i < segments.length; i += 2) {
      const segment = segments[i];
      if (segment && segment.trim().length > 5) {
        subQueries.push(segment.trim());
      }
    }
  }

  // Deduplicate and return.
  return Array.from(new Set(subQueries));
}
