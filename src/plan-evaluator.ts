import type { Plan, PlanVerdict, PlanStep, Seed } from "./types.js";

// ═══════════════════════════════════════════════════════════════
// Plan Evaluator — concrete scoring criteria & checklists
// ═══════════════════════════════════════════════════════════════
//
// Role: Produce a rigorous, actionable quality verdict for any Plan.
//
// Kimi Code performs this role by running the algorithms below against
// the generated Plan and original Seed.  Every score is derived from
// observable Plan properties (word counts, field presence, constraint
// coverage, dependency validity, etc.) so that the evaluation is
// repeatable and debuggable.
//
// Where it fits in the loop:
//   Planner → **Evaluator** → (if fail) Refiner / Interviewer / Researcher
//
// ═══════════════════════════════════════════════════════════════

// ───────────────────────────────────────────────
// Thresholds
// ───────────────────────────────────────────────

/** Minimum composite score required to mark a plan as `passed`. */
const PASS_SCORE = 0.75;
/** Minimum per-dimension score required to pass (no dimension may be critically weak). */
const PASS_PER_DIMENSION = 0.6;
/** Maximum penalty cap for any single dimension — prevents one bad signal from zeroing a score. */
const MAX_PENALTY_PER_DIMENSION = 0.8;

// ───────────────────────────────────────────────
// Rubric: Ambiguity (0 = crystal clear, 1 = completely vague)
// ───────────────────────────────────────────────
//
// Concrete examples:
//   0.0 — "Build an Astro 4.x blog with Cloudflare Pages, Tailwind CSS,
//          and MDX content, including RSS feed and sitemap."
//   0.3 — "Build a blog with Astro and deploy to the edge."
//   0.6 — "Build a fast, modern blog website with good SEO."
//   0.9 — "Build a good website."
//   1.0 — "Do something useful."
//
// Decision tree:
//   1. Is the plan.goal fewer than 6 words?              → +0.25
//   2. Does the goal contain vague qualifiers?           → +0.20
//   3. Are any step descriptions < 4 words?              → +0.10 each (max 0.30)
//   4. Do step descriptions contain vague qualifiers?    → +0.10 each (max 0.25)
//   5. Does NO step name a specific technology/version?   → +0.20
//   6. Are >50% of steps missing estimatedEffort?        → +0.15
//   7. Are >50% of steps missing verificationMethod?     → +0.15
//   8. Penalty cap at MAX_PENALTY_PER_DIMENSION.
//
// ───────────────────────────────────────────────

const VAGUE_WORDS = new Set([
  "good",
  "better",
  "best",
  "nice",
  "great",
  "improve",
  "optimize",
  "enhance",
  "refine",
  "maybe",
  "perhaps",
  "possibly",
  "some",
  "something",
  "stuff",
  "things",
  "later",
  "eventually",
  "sometime",
  "soon",
  "etc",
  "and so on",
  "...",
  "whatever",
  "appropriate",
  "relevant",
  "suitable",
  "various",
  "miscellaneous",
  "general",
  "flexible",
  "scalable", // often used as a hand-wave
  "robust",
  "efficient",
  "performant", // vague without numbers
]);

const TECH_PATTERNS = [
  /\bv?\d+\.\d+(?:\.\d+)?\b/, // version numbers: 4.2, v1.0.3
  /\b(React|Vue\.js|Vue|Angular|Svelte|Astro|Next\.js|Nuxt\.?js?|Express|Fastify|NestJS|Django|Rails|Laravel|Spring\s*Boot?|Flask|FastAPI|Hono|Elysia|Remix|Gatsby|Qwik|SolidJS)\b/i,
  /\b(TypeScript|JavaScript|Python|Go(?:lang)?|Rust|Java|Kotlin|Swift|C\+\+|C#|Ruby|PHP|Elixir|Dart|Scala|Clojure)\b/i,
  /\b(PostgreSQL|MySQL|MariaDB|MongoDB|Redis|SQLite|DynamoDB|Firestore|CockroachDB|PlanetScale|Supabase)\b/i,
  /\b(AWS|GCP|Azure|Vercel|Netlify|Cloudflare\s*(Pages|Workers)?|Heroku|DigitalOcean|Fly\.io|Render|Railway)\b/i,
  /\b(Docker|Kubernetes|Terraform|Ansible|Pulumi|GitHub\s*Actions|CircleCI|Jenkins|GitLab\s*CI|Travis)\b/i,
  /\b(Jest|Vitest|Mocha|Cypress|Playwright|Selenium|PHPUnit|JUnit|PyTest|RSpec|Go\s*test)\b/i,
  /\b(Tailwind\s*CSS|Bootstrap|Material\s*UI|Chakra\s*UI|Shadcn|Radix|Styled\s*Components|Sass|Less|PostCSS)\b/i,
  /\b(GraphQL|REST|gRPC|WebSocket|tRPC|OpenAPI|Swagger|Zod|Yup|Joi)\b/i,
  /\b(Vite|Webpack|Rollup|esbuild|Parcel|Turbopack|Bun|pnpm|npm|yarn)\b/i,
  /\b(Stripe|PayPal|Square| LemonSqueezy| Paddle)\b/i,
  /\b(Auth0|Clerk|NextAuth|Firebase\s*Auth|Supabase\s*Auth|AWS\s*Cognito|OAuth\s*2\.?0?|JWT|Passkey)\b/i,
];

/**
 * Detect whether a text string contains vague / hand-wavy language.
 * Each match contributes to ambiguity because it signals undefined scope.
 *
 * WHY: Vague words shift interpretive burden to the executor.  A plan
 * that says "make it scalable" gives no measurable target (requests/sec?
 * latency p99?).  Specificity is the antidote to ambiguity.
 */
function containsVagueWords(text: string): boolean {
  const lower = text.toLowerCase();
  for (const w of VAGUE_WORDS) {
    if (lower.includes(w)) return true;
  }
  return false;
}

/**
 * Count how many vague tokens appear in the text.
 * Used for graduated penalties rather than binary yes/no.
 */
function countVagueWords(text: string): number {
  const lower = text.toLowerCase();
  let count = 0;
  for (const w of VAGUE_WORDS) {
    // Simple inclusion check; good enough for heuristic scoring
    if (lower.includes(w)) count += 1;
  }
  return count;
}

/**
 * Detect whether a text string names a concrete technology, framework,
 * platform, or version.
 *
 * WHY: "Use a framework" is ambiguous.  "Use Astro v4.2" is not.
 * Naming specific tools proves the planner made concrete decisions.
 */
function namesSpecificTechnology(text: string): boolean {
  return TECH_PATTERNS.some((p) => p.test(text));
}

/**
 * Compute the Ambiguity dimension.
 *
 * Scoring rubric (penalties accumulate, then clamped):
 *   Base: 0.0 (perfectly clear)
 *   +0.25  goal < 6 words
 *   +0.20  goal contains vague words
 *   +0.10  per step with description < 4 words  (max +0.30)
 *   +0.08  per step containing vague words      (max +0.24)
 *   +0.20  zero steps name a specific technology
 *   +0.15  >50% of steps lack estimatedEffort
 *   +0.15  >50% of steps lack verificationMethod
 *   clamp to [0, MAX_PENALTY_PER_DIMENSION]
 */
function scoreAmbiguity(plan: Plan): number {
  let penalty = 0.0;

  // 1. Goal brevity penalty
  const goalWords = plan.goal.trim().split(/\s+/).length;
  if (goalWords < 6) {
    penalty += 0.25;
  }

  // 2. Goal vague-word penalty
  if (containsVagueWords(plan.goal)) {
    penalty += 0.2;
  }

  // 3 & 4. Step-level penalties
  let shortStepCount = 0;
  let vagueStepCount = 0;
  let techNamedCount = 0;
  let missingEffortCount = 0;
  let missingVerifyCount = 0;

  for (const step of plan.steps) {
    const descWords = step.description.trim().split(/\s+/).length;
    if (descWords < 4) shortStepCount += 1;
    if (containsVagueWords(step.description)) vagueStepCount += 1;
    if (namesSpecificTechnology(step.description)) techNamedCount += 1;
    if (!step.estimatedEffort || step.estimatedEffort.trim().length === 0) {
      missingEffortCount += 1;
    }
    if (!step.verificationMethod || step.verificationMethod.trim().length === 0) {
      missingVerifyCount += 1;
    }
  }

  penalty += Math.min(shortStepCount * 0.1, 0.3);
  penalty += Math.min(vagueStepCount * 0.08, 0.24);

  // 5. Technology specificity
  if (plan.steps.length > 0 && techNamedCount === 0) {
    penalty += 0.2;
  }

  // 6 & 7. Coverage of effort / verification
  if (plan.steps.length > 0) {
    if (missingEffortCount / plan.steps.length > 0.5) {
      penalty += 0.15;
    }
    if (missingVerifyCount / plan.steps.length > 0.5) {
      penalty += 0.15;
    }
  } else {
    // No steps at all is maximally ambiguous
    penalty += 0.4;
  }

  return Math.min(penalty, MAX_PENALTY_PER_DIMENSION);
}

// ───────────────────────────────────────────────
// Rubric: Completeness (0 = missing critical pieces, 1 = fully specified)
// ───────────────────────────────────────────────
//
// Concrete examples:
//   0.0 — Empty steps array, no assumptions, no risks, no verification.
//   0.3 — Single step "Build the app" with no deps or checks.
//   0.6 — Steps cover happy path but miss auth, error handling, tests, deploy.
//   0.8 — Most areas covered, but missing rollback plan or monitoring.
//   1.0 — Every constraint has a step, every step has verification,
//          dependencies form a DAG, assumptions & risks documented,
//          edge cases enumerated.
//
// Checklist (each failure reduces score):
//   □ Steps array non-empty
//   □ At least one step per major phase (dev, test, deploy) when applicable
//   □ Every step has a verificationMethod
//   □ Every step has an estimatedEffort
//   □ Dependencies form a valid DAG (no orphaned IDs, no self-loops)
//   □ Seed constraints are reflected in at least one step description
//   □ Assumptions array non-empty
//   □ Risks array non-empty
//   □ Plan addresses edge cases (auth, errors, rollback, monitoring)
//
// ───────────────────────────────────────────────

/**
 * Verify that every `dependsOn` entry references an existing step id
 * and that no step depends on itself.
 *
 * WHY: Invalid dependencies make the plan non-executable.  A broken DAG
 * is a broken contract.
 */
function hasValidDependencyGraph(plan: Plan): boolean {
  const ids = new Set(plan.steps.map((s) => s.id));
  for (const step of plan.steps) {
    if (!step.dependsOn) continue;
    for (const depId of step.dependsOn) {
      if (depId === step.id) return false; // self-loop
      if (!ids.has(depId)) return false; // dangling reference
    }
  }
  return true;
}

/**
 * Check how many seed constraints are actually mentioned in step descriptions.
 * A constraint is "covered" if at least one step description contains a
 * keyword from the constraint (case-insensitive).
 *
 * WHY: A plan that ignores hard constraints is incomplete by definition.
 */
function coveredConstraintRatio(seed: Seed, plan: Plan): number {
  if (seed.constraints.length === 0) return 1.0;
  const descriptions = plan.steps.map((s) => s.description.toLowerCase()).join(" ");
  let covered = 0;
  for (const c of seed.constraints) {
    const words = c.toLowerCase().split(/\W+/).filter((w) => w.length > 3);
    // If we cannot extract meaningful keywords, treat as covered to avoid false penalisation
    if (words.length === 0) {
      covered += 1;
      continue;
    }
    const matched = words.some((w) => descriptions.includes(w));
    if (matched) covered += 1;
  }
  return covered / seed.constraints.length;
}

/**
 * Compute the Completeness dimension.
 *
 * Scoring rubric (starts at 1.0, penalties subtract):
 *   Base: 1.0
 *   -0.30  steps.length === 0
 *   -0.20  steps.length === 1 or 2 (likely under-specified for any non-trivial goal)
 *   -0.15  >30% of steps lack verificationMethod
 *   -0.15  >30% of steps lack estimatedEffort
 *   -0.20  dependency graph has dangling refs or self-loops
 *   -0.25  <50% of seed constraints covered by step descriptions
 *   -0.10  assumptions array empty
 *   -0.10  risks array empty
 *   -0.10  no step mentions testing/verification/QA concepts
 *   -0.10  no step mentions deployment/release concepts
 *   clamp to [0, 1]
 */
function scoreCompleteness(plan: Plan, seed: Seed): number {
  let score = 1.0;

  if (plan.steps.length === 0) {
    score -= 0.3;
  } else if (plan.steps.length <= 2) {
    score -= 0.2;
  }

  let missingVerify = 0;
  let missingEffort = 0;
  for (const step of plan.steps) {
    if (!step.verificationMethod || step.verificationMethod.trim().length === 0) {
      missingVerify += 1;
    }
    if (!step.estimatedEffort || step.estimatedEffort.trim().length === 0) {
      missingEffort += 1;
    }
  }

  if (plan.steps.length > 0) {
    if (missingVerify / plan.steps.length > 0.3) score -= 0.15;
    if (missingEffort / plan.steps.length > 0.3) score -= 0.15;
  }

  if (!hasValidDependencyGraph(plan)) {
    score -= 0.2;
  }

  const constraintCoverage = coveredConstraintRatio(seed, plan);
  if (constraintCoverage < 0.5) {
    score -= 0.25;
  } else if (constraintCoverage < 0.8) {
    score -= 0.1;
  }

  if (plan.assumptions.length === 0) score -= 0.1;
  if (plan.risks.length === 0) score -= 0.1;

  const allText = plan.steps.map((s) => s.description.toLowerCase()).join(" ");
  const hasTestingMention = /\b(test|spec|jest|vitest|cypress|playwright|unit test|e2e|qa|verify|assertion|coverage)\b/.test(allText);
  const hasDeployMention = /\b(deploy|release|publish|ship|ci\s*\/\s*cd|pipeline|build|dockerfile|infra)\b/.test(allText);
  if (!hasTestingMention) score -= 0.1;
  if (!hasDeployMention) score -= 0.1;

  return Math.max(0, score);
}

// ───────────────────────────────────────────────
// Rubric: Feasibility (0 = impossible, 1 = trivially executable)
// ───────────────────────────────────────────────
//
// Concrete examples:
//   0.0 — "Implement GPT-5 from scratch in 1 day" or dependencies on non-existent steps.
//   0.3 — "Rewrite entire codebase to Rust" with no migration steps.
//   0.6 — "Build full SaaS in 2 days" — plausible but severely underestimated.
//   0.8 — Realistic estimates, known tech stack, clear prerequisites.
//   1.0 — All steps < 1 day, no external blockers, dependencies validated.
//
// Checklist:
//   □ All estimatedEffort values parse to a known time unit
//   □ No single step estimate exceeds 2 weeks (indivisible = un-estimable)
//   □ Dependency graph is a DAG (no cycles)
//   □ Prerequisites / assumptions are realistic (no "assume user base of 1B day one")
//   □ Step granularity: not too coarse, not too fine
//
// ───────────────────────────────────────────────

const TIME_UNIT_PATTERN = /\b(\d+(?:\.\d+)?)\s*(min|minute|hour|h|day|d|week|wk|month|mo)\b/i;

/**
 * Extract a rough "hours equivalent" from an effort string.
 * Returns undefined if the string is unparseable.
 *
 * WHY: Feasibility requires comparable effort estimates.  "2h" and
 * "1 day" must be normalised to the same unit for arithmetic checks.
 */
function parseEffortToHours(text: string): number | undefined {
  const match = text.match(TIME_UNIT_PATTERN);
  if (!match) return undefined;

  const value = parseFloat(match[1]!);
  const unit = match[2]!.toLowerCase();

  if (unit.startsWith("min")) return value / 60;
  if (unit === "h" || unit.startsWith("hour")) return value;
  if (unit === "d" || unit.startsWith("day")) return value * 8; // 1 dev day ≈ 8h
  if (unit.startsWith("wk") || unit.startsWith("week")) return value * 40;
  if (unit.startsWith("mo") || unit.startsWith("month")) return value * 160;
  return undefined;
}

/**
 * Detect whether the dependency graph contains a cycle.
 *
 * WHY: Cyclic dependencies make a plan impossible to execute sequentially.
 * Even parallel execution cannot resolve a true circular prerequisite.
 */
function hasDependencyCycle(plan: Plan): boolean {
  const adj = new Map<string, string[]>();
  for (const step of plan.steps) {
    adj.set(step.id, step.dependsOn ?? []);
  }

  const visited = new Set<string>();
  const recStack = new Set<string>();

  function dfs(node: string): boolean {
    visited.add(node);
    recStack.add(node);
    for (const neighbor of adj.get(node) ?? []) {
      if (!visited.has(neighbor)) {
        if (dfs(neighbor)) return true;
      } else if (recStack.has(neighbor)) {
        return true;
      }
    }
    recStack.delete(node);
    return false;
  }

  for (const step of plan.steps) {
    if (!visited.has(step.id)) {
      if (dfs(step.id)) return true;
    }
  }
  return false;
}

/**
 * Compute the Feasibility dimension.
 *
 * Scoring rubric:
 *   Base: 1.0
 *   -0.30  dependency cycle detected
 *   -0.20  any step has an unparseable estimatedEffort
 *   -0.20  any single step estimate > 80h (2 weeks) — signal of coarse granularity
 *   -0.15  >50% of steps have unparseable or missing estimatedEffort
 *   -0.10  plan has <3 steps for a complex goal (>10 words) — under-decomposed
 *   -0.10  plan has >30 steps — over-decomposed, coordination overhead
 *   -0.15  any assumption contains unrealistic / fantasy prerequisites
 *   clamp to [0, 1]
 */
function scoreFeasibility(plan: Plan): number {
  let score = 1.0;

  if (hasDependencyCycle(plan)) {
    score -= 0.3;
  }

  let unparseableCount = 0;
  let oversizedCount = 0;
  let totalParsed = 0;

  for (const step of plan.steps) {
    const effort = step.estimatedEffort?.trim();
    if (!effort || effort.length === 0) {
      unparseableCount += 1;
      continue;
    }
    const hours = parseEffortToHours(effort);
    if (hours === undefined) {
      unparseableCount += 1;
    } else {
      totalParsed += 1;
      if (hours > 80) {
        // > 2 weeks for a single step is a red flag — step should be split
        oversizedCount += 1;
      }
    }
  }

  if (unparseableCount > 0) {
    score -= 0.2;
  }
  if (plan.steps.length > 0 && unparseableCount / plan.steps.length > 0.5) {
    score -= 0.15;
  }
  if (oversizedCount > 0) {
    score -= 0.2;
  }

  const isComplexGoal = plan.goal.trim().split(/\s+/).length > 10;
  if (isComplexGoal && plan.steps.length < 3) {
    score -= 0.1;
  }
  if (plan.steps.length > 30) {
    score -= 0.1;
  }

  // Check assumptions for unrealistic fantasy
  const fantasyIndicators = ["1 billion users", "infinite scale", "zero latency", "100% uptime", "instant", "free"];
  const assumptionsText = plan.assumptions.join(" ").toLowerCase();
  const hasFantasy = fantasyIndicators.some((f) => assumptionsText.includes(f));
  if (hasFantasy) {
    score -= 0.15;
  }

  return Math.max(0, score);
}

// ───────────────────────────────────────────────
// Rubric: Goal Alignment (0 = off-track, 1 = perfectly aligned)
// ───────────────────────────────────────────────
//
// Concrete examples:
//   0.0 — Seed: "Build a CLI tool"; Plan: "Build a mobile app".
//   0.3 — Seed mentions auth; plan skips auth and builds a dashboard instead.
//   0.6 — Seed: "Python API"; Plan uses Node.js but delivers an API.
//   0.8 — Mostly aligned, but adds a few nice-to-have features not in seed.
//   1.0 — Plan.goal === Seed.goal, every constraint honoured, nonGoals avoided,
//          every step traceable back to the seed goal.
//
// Checklist:
//   □ plan.goal semantically matches seed.goal
//   □ Seed constraints are respected (not violated)
//   □ Seed nonGoals are NOT present in plan steps
//   □ Every step can be traced to the seed goal (no orphan steps)
//   □ No scope creep (features not justified by seed)
//
// ───────────────────────────────────────────────

/**
 * Compute semantic overlap between two strings using a simple keyword-jaccard
 * heuristic.  Not NLP-grade, but deterministic and observable.
 *
 * WHY: We need an objective signal for "does plan.goal match seed.goal?"
 * without pulling in a 500 MB embedding model.
 */
function textOverlap(a: string, b: string): number {
  const setA = new Set(a.toLowerCase().split(/\W+/).filter((w) => w.length > 2));
  const setB = new Set(b.toLowerCase().split(/\W+/).filter((w) => w.length > 2));
  if (setA.size === 0 && setB.size === 0) return 1.0;
  if (setA.size === 0 || setB.size === 0) return 0.0;
  const intersection = new Set([...setA].filter((x) => setB.has(x)));
  const union = new Set([...setA, ...setB]);
  return intersection.size / union.size;
}

/**
 * Check whether any seed nonGoal is inadvertently addressed by the plan.
 * Returns the ratio of nonGoals that are violated (0 = none violated).
 *
 * WHY: Explicitly out-of-scope items creeping into the plan is classic
 * scope creep and lowers alignment.
 */
function violatedNonGoalRatio(seed: Seed, plan: Plan): number {
  if (!seed.nonGoals || seed.nonGoals.length === 0) return 0.0;
  const allPlanText = [plan.goal, ...plan.steps.map((s) => s.description)].join(" ").toLowerCase();
  let violated = 0;
  for (const ng of seed.nonGoals) {
    const keywords = ng.toLowerCase().split(/\W+/).filter((w) => w.length > 2);
    if (keywords.length === 0) continue;
    const hit = keywords.some((k) => allPlanText.includes(k));
    if (hit) violated += 1;
  }
  return violated / seed.nonGoals.length;
}

/**
 * Compute the Goal Alignment dimension.
 *
 * Scoring rubric:
 *   Base: 1.0
 *   -0.30  plan.goal / seed.goal overlap < 0.3 (severe misalignment)
 *   -0.15  plan.goal / seed.goal overlap < 0.6 (moderate drift)
 *   -0.25  >30% of seed constraints not covered by any step
 *   -0.25  any seed nonGoal is violated by plan steps
 *   -0.15  plan steps contain features not traceable to seed goal keywords
 *   clamp to [0, 1]
 */
function scoreGoalAlignment(plan: Plan, seed: Seed): number {
  let score = 1.0;

  const overlap = textOverlap(plan.goal, seed.goal);
  if (overlap < 0.3) {
    score -= 0.3;
  } else if (overlap < 0.6) {
    score -= 0.15;
  }

  const constraintCoverage = coveredConstraintRatio(seed, plan);
  if (constraintCoverage < 0.5) {
    score -= 0.25;
  } else if (constraintCoverage < 0.7) {
    score -= 0.1;
  }

  const nonGoalViolation = violatedNonGoalRatio(seed, plan);
  if (nonGoalViolation > 0) {
    score -= 0.25;
  }

  // Scope-creep check: do plan steps introduce keywords not in seed at all?
  const seedText = `${seed.goal} ${seed.constraints.join(" ")}`.toLowerCase();
  const seedWords = new Set(seedText.split(/\W+/).filter((w) => w.length > 3));
  const planWords = new Set(
    plan.steps
      .map((s) => s.description.toLowerCase().split(/\W+/).filter((w) => w.length > 3))
      .flat(),
  );
  let alienWords = 0;
  for (const w of planWords) {
    if (!seedWords.has(w)) alienWords += 1;
  }
  // Some alien words are fine (implementation details), but if >60% of step
  // words are unrelated to the seed, that's scope creep.
  if (planWords.size > 0 && alienWords / planWords.size > 0.6) {
    score -= 0.15;
  }

  return Math.max(0, score);
}

// ───────────────────────────────────────────────
// Feedback generators
// ───────────────────────────────────────────────

/**
 * Build a human-readable feedback string from dimension scores.
 * This is the primary teaching signal for the Refiner and for Kimi Code.
 */
function buildFeedback(
  ambiguity: number,
  completeness: number,
  feasibility: number,
  goalAlignment: number,
): string {
  const lines: string[] = [];

  if (ambiguity >= 0.5) {
    lines.push(
      `Ambiguity (${ambiguity.toFixed(2)}): Plan is too vague. ` +
        `Add specific technology names, version numbers, measurable outcomes, and precise scope boundaries. ` +
        `Example of low ambiguity: "Build Astro 4.x blog with Cloudflare Pages" vs high ambiguity: "Build a good website".`,
    );
  } else if (ambiguity >= 0.3) {
    lines.push(
      `Ambiguity (${ambiguity.toFixed(2)}): Some areas lack specificity. ` +
        `Review steps for vague words ("good", "better", " scalable") and add concrete tools or metrics.`,
    );
  }

  if (completeness < 0.6) {
    lines.push(
      `Completeness (${completeness.toFixed(2)}): Critical pieces missing. ` +
        `Ensure every step has verificationMethod and estimatedEffort. ` +
        `Cover all seed constraints, add assumptions & risks, and include test + deploy phases.`,
    );
  } else if (completeness < 0.8) {
    lines.push(
      `Completeness (${completeness.toFixed(2)}): Nearly there. ` +
        `Double-check constraint coverage, dependency validity, and edge-case handling.`,
    );
  }

  if (feasibility < 0.6) {
    lines.push(
      `Feasibility (${feasibility.toFixed(2)}): Plan may be impossible or severely underestimated. ` +
        `Break steps smaller than 2 weeks, validate dependencies form a DAG, and remove fantasy assumptions.`,
    );
  } else if (feasibility < 0.8) {
    lines.push(
      `Feasibility (${feasibility.toFixed(2)}): Some estimates or dependencies look suspicious. ` +
        `Ensure all effort strings use parseable units (e.g., "2h", "1 day") and no step exceeds 80 hours.`,
    );
  }

  if (goalAlignment < 0.6) {
    lines.push(
      `Goal Alignment (${goalAlignment.toFixed(2)}): Plan diverges from seed. ` +
        `Re-align plan.goal with seed.goal, respect nonGoals, and ensure every step serves the original mission.`,
    );
  } else if (goalAlignment < 0.8) {
    lines.push(
      `Goal Alignment (${goalAlignment.toFixed(2)}): Minor drift detected. ` +
        `Prune nice-to-have features that are not justified by the seed goal or constraints.`,
    );
  }

  if (lines.length === 0) {
    lines.push(
      `All dimensions look healthy (ambiguity ${ambiguity.toFixed(2)}, completeness ${completeness.toFixed(2)}, ` +
        `feasibility ${feasibility.toFixed(2)}, alignment ${goalAlignment.toFixed(2)}). ` +
        `Proceed to execution or perform a final human sanity check.`,
    );
  }

  return lines.join("\n\n");
}

/**
 * Derive missing interview questions from evaluation gaps.
 * These feed directly into the next iteration's interviewer.ts.
 */
function deriveMissingQuestions(
  plan: Plan,
  seed: Seed,
  ambiguity: number,
  completeness: number,
  feasibility: number,
  goalAlignment: number,
): string[] {
  const questions: string[] = [];

  if (ambiguity > 0.4 && !namesSpecificTechnology(plan.goal)) {
    questions.push(
      `What specific framework, library, or platform should be used for "${seed.goal}"? (e.g., Astro, Next.js, Django)`,
    );
  }

  if (ambiguity > 0.4) {
    questions.push(
      `What does "done" look like for this project? Please list 3–5 concrete acceptance criteria.`,
    );
  }

  if (completeness < 0.6) {
    questions.push(
      `Are there any hard deadlines, budget limits, or compliance requirements (GDPR, SOC2, etc.) we must respect?`,
    );
  }

  if (feasibility < 0.6) {
    questions.push(
      `What is the realistic timeline — and are there any external blockers (vendor approvals, API access, legal review)?`,
    );
  }

  if (goalAlignment < 0.6) {
    questions.push(
      `The current plan may have drifted from the original goal. What is the ONE must-have outcome vs. nice-to-have features?`,
    );
  }

  if (plan.steps.length > 0 && plan.steps.every((s) => !s.estimatedEffort)) {
    questions.push(
      `Can you provide rough effort estimates (hours/days) for the major phases? This helps validate feasibility.`,
    );
  }

  return questions;
}

/**
 * Derive missing research topics from evaluation gaps.
 * These feed directly into the next iteration's researcher.ts.
 */
function deriveMissingResearch(
  plan: Plan,
  seed: Seed,
  ambiguity: number,
  completeness: number,
  feasibility: number,
): string[] {
  const queries: string[] = [];

  if (ambiguity > 0.4 && !namesSpecificTechnology(plan.goal)) {
    queries.push(`Best technology stack for "${seed.goal}" in 2024–2025`);
  }

  if (completeness < 0.6) {
    queries.push(`Deployment and CI/CD best practices for projects like "${seed.goal}"`);
  }

  if (feasibility < 0.6) {
    queries.push(`Typical development effort estimate for "${seed.goal}" — industry benchmarks`);
  }

  // If constraints mention security/compliance, research current standards
  const seedText = `${seed.goal} ${seed.constraints.join(" ")}`.toLowerCase();
  if (/\b(security|auth|oauth|gdpr|soc2|hipaa|pci)\b/.test(seedText)) {
    queries.push(`Security checklist and auth patterns for "${seed.goal}"`);
  }

  // If no testing framework is named, research current favourites
  const planText = plan.steps.map((s) => s.description).join(" ").toLowerCase();
  if (!/\b(jest|vitest|cypress|playwright|mocha|pytest)\b/.test(planText)) {
    queries.push(`Recommended testing strategy and tools for "${seed.goal}"`);
  }

  return queries;
}

// ───────────────────────────────────────────────
// Public API
// ───────────────────────────────────────────────

/**
 * Evaluate a plan against its seed and return a conservative quality verdict.
 *
 * This implementation replaces the previous all-0.5 stub with concrete,
 * observable scoring logic across four dimensions:
 *
 *   1. **Ambiguity** — penalises vague language, missing tech names,
 *      short step descriptions, and absent effort/verification fields.
 *   2. **Completeness** — penalises missing steps, uncovered constraints,
 *      invalid dependencies, absent assumptions/risks, and missing
 *      test or deploy phases.
 *   3. **Feasibility** — penalises dependency cycles, unparseable or
 *      oversized estimates, under/over-decomposition, and fantasy assumptions.
 *   4. **Goal Alignment** — penalises goal drift, violated nonGoals,
 *      uncovered constraints, and scope creep.
 *
 * The composite `score` is a weighted average:
 *   ambiguity 25% | completeness 30% | feasibility 25% | goalAlignment 20%
 *
 * `passed` is true only when:
 *   - composite score >= PASS_SCORE (0.75)
 *   - every dimension >= PASS_PER_DIMENSION (0.60)
 *
 * Concrete examples of resulting verdicts:
 *   - A plan for "Build a good website" with 1 step and no verification
 *     will score ambiguity ≈ 0.8, completeness ≈ 0.2, feasibility ≈ 0.7,
 *     alignment ≈ 0.5 → composite ≈ 0.52 → **fail**.
 *   - A plan for "Build Astro 4.x blog with Cloudflare Pages" with 8
 *     granular steps, verified dependencies, parseable estimates, and
 *     explicit test/deploy phases will score ≈ 0.9 on all dimensions
 *     → composite ≈ 0.9 → **pass**.
 *
 * @param plan — the Plan to evaluate.
 * @param seed — the original Seed constraints and goal.
 * @returns PlanVerdict — scores, feedback, and follow-up items.
 */
export function evaluatePlan(plan: Plan, seed: Seed): PlanVerdict {
  const ambiguity = scoreAmbiguity(plan);
  const completeness = scoreCompleteness(plan, seed);
  const feasibility = scoreFeasibility(plan);
  const goalAlignment = scoreGoalAlignment(plan, seed);

  // Weighted composite — completeness weighted highest because a complete
  // but slightly ambiguous plan is more actionable than an ambiguous plan
  // that happens to be well-aligned.
  const score =
    (1 - ambiguity) * 0.25 +
    completeness * 0.30 +
    feasibility * 0.25 +
    goalAlignment * 0.20;

  const passed =
    score >= PASS_SCORE &&
    ambiguity <= 0.4 &&
    completeness >= PASS_PER_DIMENSION &&
    feasibility >= PASS_PER_DIMENSION &&
    goalAlignment >= PASS_PER_DIMENSION;

  const feedback = buildFeedback(ambiguity, completeness, feasibility, goalAlignment);
  const missingQuestions = deriveMissingQuestions(plan, seed, ambiguity, completeness, feasibility, goalAlignment);
  const missingResearch = deriveMissingResearch(plan, seed, ambiguity, completeness, feasibility);

  return {
    passed,
    score: Math.round(score * 100) / 100,
    ambiguity: Math.round(ambiguity * 100) / 100,
    completeness: Math.round(completeness * 100) / 100,
    feasibility: Math.round(feasibility * 100) / 100,
    goalAlignment: Math.round(goalAlignment * 100) / 100,
    feedback,
    missingQuestions,
    missingResearch,
  };
}
