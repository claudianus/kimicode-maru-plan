import type { InterviewQA, Plan, PlanStep, ResearchItem, Seed } from "./types.js";

/**
 * Planner — synthesizes a concrete Plan from a Seed, interviews, and research.
 *
 * Role in the harness: This module defines the planning role for Kimi Code.
 * Kimi Code performs this role by reasoning over the seed goal, interview
 * answers, and research findings to produce a concrete, actionable Plan.
 *
 * Position in the loop: Runs first to bootstrap the Plan, before evaluation.
 * Subsequent updates are produced by the refiner; this module establishes the
 * initial plan that enters the Plan → Evaluate → Refine loop.
 */

// ═══════════════════════════════════════════════
// Section 1 — Goal Analysis & Ambiguity Detection
// ═══════════════════════════════════════════════

/**
 * Analyze the clarity of the seed goal and return an ambiguity score (0.0–1.0).
 *
 * WHY: A vague goal produces a vague plan. Kimi Code must detect ambiguity
 * early so the plan includes targeted assumptions and the evaluator can flag
 * missing interviews.
 *
 * Scoring rubric:
 * 0.0–0.2 = Crystal clear. Contains specific technology, platform, and scope.
 *   Example: "Build an Astro blog with Cloudflare Pages, MDX posts, and
 *   Tailwind styling."
 * 0.3–0.5 = Mostly clear but missing one dimension (tech, scale, or timeline).
 *   Example: "Build a React dashboard with charts." (Which chart library?
 *   Data source? Auth?)
 * 0.6–0.8 = Seriously vague. Adjectives without metrics, missing tech stack,
 *   no boundaries.
 *   Example: "Build a good website." (What is "good"? E-commerce? Blog?
 *   Static or dynamic?)
 * 0.9–1.0 = Almost empty or purely aspirational.
 *   Example: "Make something cool."
 *
 * Decision tree:
 * 1. Does the goal name a specific framework or language? → -0.3
 * 2. Does it name a specific platform or host? → -0.2
 * 3. Does it list concrete features (≥3)? → -0.2
 * 4. Does it contain subjective adjectives (good, nice, best, modern)
 *    without definitions? → +0.3
 * 5. Does it lack any boundary (no mention of what is NOT included)? → +0.2
 * 6. Is the goal longer than 20 words and still lacks specifics? → +0.1
 *
 * @param goal - The seed goal string.
 * @returns Ambiguity score between 0.0 (clear) and 1.0 (completely vague).
 */
function analyzeGoalAmbiguity(goal: string): number {
  let score = 0.5;
  const lower = goal.toLowerCase();

  // Specific technology / framework reduces ambiguity.
  const techPatterns = /\b(astro|next\.?js|react|vue|svelte|angular|django|rails|laravel|express|fastapi|flask|spring|dotnet|go|rust|python|typescript|javascript|java|kotlin|swift)\b/;
  if (techPatterns.test(lower)) score -= 0.3;

  // Platform or host reduces ambiguity.
  const platformPatterns = /\b(vercel|netlify|cloudflare|aws|gcp|azure|firebase|supabase|github pages|docker|kubernetes)\b/;
  if (platformPatterns.test(lower)) score -= 0.2;

  // Concrete feature markers (words like "with", "supporting", "including"
  // followed by nouns) reduce ambiguity.
  const featureIndicators = (lower.match(/\b(with|supporting|including|using|via)\b/g) ?? []).length;
  if (featureIndicators >= 2) score -= 0.2;

  // Subjective adjectives increase ambiguity.
  const subjectivePatterns = /\b(good|nice|best|modern|clean|awesome|great|better|user-friendly|scalable|robust)\b/;
  if (subjectivePatterns.test(lower)) score += 0.3;

  // Lack of boundary words (no "only", "not", "excluding", "limit to")
  // increases ambiguity.
  const boundaryPatterns = /\b(only|not|excluding|limit to|out of scope|won't|no\b)/;
  if (!boundaryPatterns.test(lower)) score += 0.2;

  // Very short goals (< 5 words) are usually vague.
  const wordCount = goal.trim().split(/\s+/).length;
  if (wordCount < 5) score += 0.2;

  return Math.max(0.0, Math.min(1.0, score));
}

/**
 * Extract a prioritized list of deliverables from the seed, interviews,
 * and research.
 *
 * WHY: A plan is only as good as its defined outputs. If deliverables are
 * implicit, the team (or Kimi Code) will build the wrong thing.
 *
 * Rules:
 * 1. Every sentence in seed.goal that starts with a verb is a candidate
 *    deliverable. ("Build X", "Integrate Y", "Migrate Z")
 * 2. Interview answers that add new verbs become additional deliverables.
 * 3. Research findings that reveal "commonly needed" items (e.g., "Auth0
 *    integration usually requires a callback handler") become deliverables
 *    UNLESS seed.nonGoals explicitly excludes them.
 * 4. Each deliverable must be a noun phrase, not a task description.
 *    BAD: "Code the login form"
 *    GOOD: "Login form with email/password validation and error states"
 *
 * @param seed - The user seed.
 * @param interviews - Completed interviews.
 * @param research - Research items.
 * @returns Ordered list of deliverables (highest priority first).
 */
function extractDeliverables(
  seed: Seed,
  interviews: InterviewQA[],
  research: ResearchItem[],
): string[] {
  const deliverables: string[] = [];
  const goalLower = seed.goal.toLowerCase();

  // ── Rule 1: Parse goal for verb-led clauses ──
  const verbClauses = seed.goal.match(/\b(Build|Create|Implement|Integrate|Migrate|Refactor|Add|Set up|Configure|Deploy)\s+([^,.]+)/gi);
  if (verbClauses) {
    for (const clause of verbClauses) {
      const cleaned = clause.replace(/\b(Build|Create|Implement|Integrate|Migrate|Refactor|Add|Set up|Configure|Deploy)\s+/i, "").trim();
      if (cleaned.length > 3) deliverables.push(cleaned);
    }
  }

  // If no verb clauses found, treat the entire goal as a single deliverable.
  if (deliverables.length === 0) {
    deliverables.push(seed.goal);
  }

  // ── Rule 2: Mine interview answers for new deliverables ──
  for (const qa of interviews) {
    if (!qa.answer) continue;
    const answerLower = qa.answer.toLowerCase();
    // Skip if answer just confirms existing deliverable.
    if (deliverables.some((d) => answerLower.includes(d.toLowerCase()))) continue;

    // Extract noun phrases that look like new features or artifacts.
    const newItems = qa.answer.match(/\b(?:we need|add|also|plus|include|require)\s+([^,.]+)/gi);
    if (newItems) {
      for (const item of newItems) {
        const cleaned = item.replace(/\b(?:we need|add|also|plus|include|require)\s+/i, "").trim();
        if (cleaned.length > 3 && !deliverables.includes(cleaned)) {
          deliverables.push(cleaned);
        }
      }
    }
  }

  // ── Rule 3: Enrich with research, respecting nonGoals ──
  const nonGoalsLower = (seed.nonGoals ?? []).map((ng) => ng.toLowerCase());
  for (const ri of research) {
    // Simple heuristic: if research summary contains "usually requires",
    // "typically needs", or "common pattern", treat the following noun
    // phrase as a candidate deliverable.
    const patterns = ri.summary.match(/\b(?:usually requires|typically needs|common pattern|standard practice|best practice)\s+([^,.]+)/gi);
    if (patterns) {
      for (const p of patterns) {
        const cleaned = p.replace(/\b(?:usually requires|typically needs|common pattern|standard practice|best practice)\s+/i, "").trim();
        const cleanedLower = cleaned.toLowerCase();
        if (
          cleaned.length > 3 &&
          !deliverables.some((d) => d.toLowerCase() === cleanedLower) &&
          !nonGoalsLower.some((ng) => cleanedLower.includes(ng) || ng.includes(cleanedLower))
        ) {
          deliverables.push(cleaned);
        }
      }
    }
  }

  return deliverables;
}

// ═══════════════════════════════════════════════
// Section 2 — Assumption & Risk Identification
// ═══════════════════════════════════════════════

/**
 * Generate a list of assumptions the plan must make when information is
 * missing or ambiguous.
 *
 * WHY: Explicit assumptions prevent silent misalignment. If an assumption
 * turns out to be false, the plan can be refined instead of rewritten.
 *
 * Decision tree:
 * 1. Is there NO interview covering deployment target?
 *    → Assume: "Deployment target is the developer's local machine or
 *       the most common free tier (Vercel for frontend, Render for backend)."
 * 2. Is there NO interview covering authentication?
 *    → Assume: "No authentication is required unless the goal explicitly
 *       mentions users, accounts, or admin panels."
 * 3. Is there NO research on the chosen framework's latest version?
 *    → Assume: "Latest stable major version is used."
 * 4. Does the goal mention "API" without specifying REST vs GraphQL vs gRPC?
 *    → Assume: "REST with JSON over HTTP."
 * 5. Is there no mention of testing?
 *    → Assume: "Manual verification is sufficient for the initial plan;
 *       automated tests will be added if scope allows."
 * 6. Is there no mention of styling approach?
 *    → Assume: "Tailwind CSS if the stack is modern JS; otherwise no
 *       strong opinion."
 * 7. Are seed.constraints empty?
 *    → Assume: "No hard deadlines or budget limits exist."
 *
 * @param seed - The user seed.
 * @param interviews - Completed interviews.
 * @param research - Research items.
 * @returns Array of explicit assumption strings.
 */
function identifyAssumptions(
  seed: Seed,
  interviews: InterviewQA[],
  research: ResearchItem[],
): string[] {
  const assumptions: string[] = [];
  const goalLower = seed.goal.toLowerCase();
  const hasInterviewTopic = (topic: string): boolean =>
    interviews.some((qa) => qa.question.toLowerCase().includes(topic) || (qa.answer?.toLowerCase().includes(topic) ?? false));
  const hasResearchTopic = (topic: string): boolean =>
    research.some((ri) => ri.query.toLowerCase().includes(topic) || ri.summary.toLowerCase().includes(topic));

  // Assumption 1: Deployment target.
  if (!hasInterviewTopic("deploy") && !hasResearchTopic("deploy") && !hasInterviewTopic("host")) {
    if (goalLower.includes("website") || goalLower.includes("frontend") || goalLower.includes("app")) {
      assumptions.push("Deployment target is a static host (Vercel/Netlify/Cloudflare Pages) unless the stack requires a server.");
    } else {
      assumptions.push("Deployment environment is the developer's local machine or a free-tier PaaS (Render/Railway).");
    }
  }

  // Assumption 2: Authentication.
  if (!hasInterviewTopic("auth") && !hasInterviewTopic("login") && !hasInterviewTopic("user")) {
    if (goalLower.includes("dashboard") || goalLower.includes("admin") || goalLower.includes("account")) {
      assumptions.push("Authentication is required but method is unspecified; plan assumes email/password or OAuth 2.0 via a provider like Auth0/Clerk.");
    } else {
      assumptions.push("No authentication or user management is required unless discovered during implementation.");
    }
  }

  // Assumption 3: Framework version.
  if (!hasResearchTopic("version") && !hasResearchTopic("latest")) {
    assumptions.push("Latest stable major version of any chosen framework or library is used.");
  }

  // Assumption 4: API style.
  if (goalLower.includes("api") && !hasInterviewTopic("rest") && !hasInterviewTopic("graphql") && !hasInterviewTopic("grpc")) {
    assumptions.push("API style is REST with JSON over HTTP unless a specific protocol is identified.");
  }

  // Assumption 5: Testing.
  if (!hasInterviewTopic("test") && !hasInterviewTopic("testing")) {
    assumptions.push("Manual verification is the default acceptance method; automated testing is a stretch goal.");
  }

  // Assumption 6: Styling.
  if (!hasInterviewTopic("style") && !hasInterviewTopic("css") && !hasInterviewTopic("tailwind") && !hasInterviewTopic("design")) {
    if (goalLower.includes("react") || goalLower.includes("vue") || goalLower.includes("svelte") || goalLower.includes("astro")) {
      assumptions.push("Styling uses Tailwind CSS or the framework's recommended CSS solution.");
    }
  }

  // Assumption 7: Constraints / timeline.
  if (seed.constraints.length === 0) {
    assumptions.push("No hard deadlines or budget constraints are enforced.");
  } else {
    // If constraints exist, assume they are immutable.
    assumptions.push(`Hard constraints (${seed.constraints.join("; ")}) are immutable and take precedence over all optimizations.`);
  }

  return assumptions;
}

/**
 * Identify risks that could derail the plan, along with mitigations.
 *
 * WHY: Plans fail because risks are invisible until they happen. Surfacing
 * them in the initial plan lets the evaluator check feasibility realistically.
 *
 * Risk categories and thresholds:
 * - TECHNICAL: New technology for the team, undocumented APIs, alpha/beta
 *   dependencies.
 *   Trigger: Goal contains "latest", "beta", "experimental", "custom",
 *   or research reveals recent breaking changes.
 * - SCHEDULE: Estimates based on pure guesswork because no similar past
 *   project exists.
 *   Trigger: < 2 research items and < 1 interview with effort estimate.
 * - DEPENDENCY: External service (API, SaaS, library) required but not
 *   provisioned or rate-limited.
 *   Trigger: Goal contains "integrate with", "using X API", "sync with".
 * - SCOPE CREEP: Vague boundaries allow endless additions.
 *   Trigger: Ambiguity score ≥ 0.6 or nonGoals is undefined/empty.
 * - KNOWLEDGE GAP: Team lacks domain expertise.
 *   Trigger: Research items contain phrases like "complex", "steep learning
 *   curve", "requires deep understanding".
 *
 * @param seed - The user seed.
 * @param interviews - Completed interviews.
 * @param research - Research items.
 * @returns Array of risk strings, each including a brief mitigation.
 */
function identifyRisks(
  seed: Seed,
  interviews: InterviewQA[],
  research: ResearchItem[],
): string[] {
  const risks: string[] = [];
  const goalLower = seed.goal.toLowerCase();
  const ambiguity = analyzeGoalAmbiguity(seed.goal);

  // ── TECHNICAL ──
  if (/\b(latest|beta|experimental|alpha|custom|hand-rolled|from scratch)\b/.test(goalLower)) {
    risks.push("TECHNICAL — Goal relies on bleeding-edge or custom technology. Mitigation: pin versions, create a spike/prototype step before full implementation.");
  }
  for (const ri of research) {
    if (/\b(breaking change|deprecated|unstable|buggy|alpha|beta)\b/i.test(ri.summary)) {
      risks.push(`TECHNICAL — Research on "${ri.query}" flagged instability. Mitigation: downgrade to stable LTS or isolate behind an abstraction layer.`);
      break; // One technical risk is enough; avoid spam.
    }
  }

  // ── SCHEDULE ──
  const hasEffortEstimate = interviews.some(
    (qa) => qa.answer && /\b(hour|day|week|month|point|story point)\b/i.test(qa.answer),
  );
  if (research.length < 2 && !hasEffortEstimate) {
    risks.push("SCHEDULE — Estimates are based on guesswork due to insufficient research/interviews. Mitigation: add a research spike as Step 1; do not commit to hard deadlines.");
  }

  // ── DEPENDENCY ──
  if (/\b(integrate with|using .* API|sync with|connect to|webhook|third-party)\b/i.test(seed.goal)) {
    risks.push("DEPENDENCY — External service integration required. Mitigation: verify API credentials/rate limits early; mock the service for local development.");
  }

  // ── SCOPE CREEP ──
  if (ambiguity >= 0.6 || !(seed.nonGoals && seed.nonGoals.length > 0)) {
    risks.push("SCOPE CREEP — Vague boundaries or missing nonGoals. Mitigation: define a hard cutoff milestone (e.g., 'v1 ships without feature X'); update nonGoals explicitly.");
  }

  // ── KNOWLEDGE GAP ──
  for (const ri of research) {
    if (/\b(complex|steep learning curve|requires deep understanding|difficult to master|not beginner-friendly)\b/i.test(ri.summary)) {
      risks.push(`KNOWLEDGE GAP — "${ri.query}" flagged as complex. Mitigation: allocate explicit learning/documentation time in early steps.`);
      break;
    }
  }

  return risks;
}

// ═══════════════════════════════════════════════
// Section 3 — Step Synthesis
// ═══════════════════════════════════════════════

/**
 * Synthesize an ordered list of PlanSteps from deliverables, considering
 * dependencies, effort, and verification.
 *
 * WHY: Steps are the executable core of the plan. They must be
 * - Atomic: one deliverable per step (no "and" in description).
 * - Ordered: dependencies form a DAG (no cycles).
 * - Verifiable: each step has a concrete "done" criterion.
 * - Estimated: rough effort prevents schedule fantasy.
 *
 * Synthesis checklist (applied to every deliverable):
 * 1. Is this deliverable purely investigative?
 *    → Create a "Research spike: <topic>" step. Effort: "1–2h".
 *      Verification: "Document findings in /docs/spike-<topic>.md".
 * 2. Is this deliverable infrastructure/setup?
 *    → Create a "Bootstrap: <setup>" step. Effort: "30m–2h".
 *      Verification: "Repository initializes, dev server starts, CI passes."
 * 3. Is this deliverable a user-facing feature?
 *    → Split into: (a) scaffold/data model, (b) UI/logic, (c) integration.
 *      Effort: "2h–1 day" per sub-step.
 *      Verification: "Feature is visible in preview build and passes manual
 *      acceptance criteria."
 * 4. Is this deliverable a migration or refactor?
 *    → Prepend "Backup / snapshot current state". Effort: "30m".
 *      Verification: "Rollback command tested successfully."
 *
 * Dependency rules (hard edges in the DAG):
 * - Bootstrap always comes first.
 * - Research spikes precede any step that depends on their findings.
 * - Data models precede UI/logic that consumes them.
 * - UI/logic precedes integration / deployment.
 * - Deployment is always last (or second-to-last if followed by docs).
 *
 * @param deliverables - Ordered list from extractDeliverables.
 * @returns PlanSteps with ids, dependencies, effort, and verification.
 */
function synthesizeSteps(deliverables: string[]): PlanStep[] {
  const steps: PlanStep[] = [];

  // Helper to create a step and track its id.
  const addStep = (
    description: string,
    opts: { dependsOn?: string[]; effort?: string; verification?: string } = {},
  ): string => {
    const id = crypto.randomUUID();
    steps.push({
      id,
      description,
      dependsOn: opts.dependsOn ?? [],
      estimatedEffort: opts.effort ?? "1h",
      verificationMethod: opts.verification ?? `Confirm "${description}" is complete and observable.`,
    });
    return id;
  };

  // ── Step 0: Bootstrap / Repository Setup ──
  // Every plan needs a foundation. If deliverables already mention setup,
  // we still keep this explicit to ensure a uniform start.
  const bootstrapId = addStep("Initialize repository, tooling, and dev environment", {
    effort: "30m–2h",
    verification: "Repo clones cleanly, `bun install` or equivalent succeeds, dev server starts without errors.",
  });

  // Track the last "infrastructure" step for dependency chaining.
  let lastInfraId = bootstrapId;

  for (const deliverable of deliverables) {
    const lower = deliverable.toLowerCase();

    // ── Branch A: Research / Spike ──
    if (/\b(research|investigate|compare|evaluate|spike|choose|select|decide)\b/.test(lower)) {
      const spikeId = addStep(`Research spike: ${deliverable}`, {
        dependsOn: [lastInfraId],
        effort: "1–2h",
        verification: `Findings documented in a decision record (e.g., /docs/adr-001-${slugify(deliverable)}.md). Options compared with pros/cons.`,
      });
      lastInfraId = spikeId;
      continue;
    }

    // ── Branch B: Infrastructure / Config ──
    if (/\b(setup|configure|install|deploy|host|provision|ci\/cd|pipeline|docker|kubernetes)\b/.test(lower)) {
      const infraId = addStep(`Infrastructure: ${deliverable}`, {
        dependsOn: [lastInfraId],
        effort: "1–3h",
        verification: `Configuration is applied and verified (e.g., deploy preview succeeds, container builds, CI checks pass).`,
      });
      lastInfraId = infraId;
      continue;
    }

    // ── Branch C: Migration / Refactor ──
    if (/\b(migrate|refactor|rewrite|upgrade|modernize)\b/.test(lower)) {
      const backupId = addStep(`Snapshot current state before: ${deliverable}`, {
        dependsOn: [lastInfraId],
        effort: "30m",
        verification: "Rollback command or backup branch tested; original state is recoverable in < 5 minutes.",
      });
      const migrateId = addStep(`Execute: ${deliverable}`, {
        dependsOn: [backupId],
        effort: "2h–2 days",
        verification: `All existing tests (or manual smoke tests) pass post-migration; no data loss observed.`,
      });
      lastInfraId = migrateId;
      continue;
    }

    // ── Branch D: User-facing Feature (default) ──
    // Split into scaffold, logic, and polish when possible.
    const scaffoldId = addStep(`Scaffold data model / types / API contract for: ${deliverable}`, {
      dependsOn: [lastInfraId],
      effort: "1–2h",
      verification: `Type-check passes, mock data renders correctly in a stub page or test.`,
    });

    const uiId = addStep(`Implement UI / logic for: ${deliverable}`, {
      dependsOn: [scaffoldId],
      effort: "2h–1 day",
      verification: `Feature is interactive in dev build; edge cases (empty state, error state, loading state) are handled visibly.`,
    });

    const integrateId = addStep(`Integrate and verify: ${deliverable}`, {
      dependsOn: [uiId],
      effort: "1–2h",
      verification: `End-to-end manual test passes; no console errors; responsive on mobile width.`,
    });

    lastInfraId = integrateId;
  }

  // ── Final Step: Deployment / Handoff ──
  // Only add if not already present in deliverables.
  if (!deliverables.some((d) => /\b(deploy|launch|ship|publish|release)\b/i.test(d))) {
    addStep("Deploy / publish to production or staging environment", {
      dependsOn: [lastInfraId],
      effort: "30m–1h",
      verification: "Live URL is accessible; smoke test passes; README updated with run/deploy instructions.",
    });
  }

  return steps;
}

/**
 * Create a slug from a deliverable string for use in file names or IDs.
 *
 * WHY: Consistent naming reduces decision fatigue when generating
 * documentation or branch names inside the plan.
 *
 * @param text - Raw deliverable text.
 * @returns Lowercase hyphenated slug.
 */
function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .substring(0, 40);
}

// ═══════════════════════════════════════════════
// Section 4 — Plan Quality Self-Check
// ═══════════════════════════════════════════════

/**
 * Score the plan's completeness before it leaves the planner.
 *
 * WHY: Catching a weak plan here prevents wasted evaluator cycles.
 * If the score is too low, the planner should inject a "Clarification"
 * step rather than ship a broken plan.
 *
 * Scoring rubric (0.0–1.0 per dimension, then averaged):
 *
 * STRUCTURAL (0.25 weight)
 * - Steps > 1 and < 20?                    → +0.25
 * - Every step has verificationMethod?     → +0.25
 * - Every step has estimatedEffort?        → +0.25
 * - Dependencies form a DAG (no cycles)?   → +0.25
 *
 * COVERAGE (0.35 weight)
 * - Every deliverable from extractDeliverables is represented? → +0.4
 * - Assumptions list is non-empty?         → +0.2
 * - Risks list is non-empty?               → +0.2
 * - At least one bootstrap/setup step?     → +0.2
 *
 * INPUT UTILIZATION (0.25 weight)
 * - Seed.goal is reflected in step descriptions (not just copied)? → +0.4
 * - At least one interview answer influenced a step?               → +0.3
 * - At least one research finding influenced a step?               → +0.3
 *
 * CLARITY (0.15 weight)
 * - No step description contains "and" (atomicity)? → +0.5
 * - No subjective adjectives in step descriptions?  → +0.5
 *
 * @param plan - The plan to score.
 * @param deliverables - Expected deliverables for coverage check.
 * @returns Composite score 0.0–1.0.
 */
function scorePlanCompleteness(plan: Plan, deliverables: string[]): number {
  let structural = 0;
  let coverage = 0;
  let inputUtil = 0;
  let clarity = 0;

  // Structural
  if (plan.steps.length > 1 && plan.steps.length < 20) structural += 0.25;
  if (plan.steps.every((s) => s.verificationMethod && s.verificationMethod.length > 10)) structural += 0.25;
  if (plan.steps.every((s) => s.estimatedEffort && s.estimatedEffort.length > 0)) structural += 0.25;

  // DAG check (simple cycle detection via DFS)
  const adj = new Map<string, string[]>();
  const allIds = new Set(plan.steps.map((s) => s.id));
  for (const s of plan.steps) {
    adj.set(s.id, s.dependsOn?.filter((d) => allIds.has(d)) ?? []);
  }
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const hasCycle = (node: string): boolean => {
    visiting.add(node);
    for (const neighbor of adj.get(node) ?? []) {
      if (visiting.has(neighbor)) return true;
      if (!visited.has(neighbor) && hasCycle(neighbor)) return true;
    }
    visiting.delete(node);
    visited.add(node);
    return false;
  };
  let cycleFound = false;
  for (const id of Array.from(allIds)) {
    if (!visited.has(id) && hasCycle(id)) {
      cycleFound = true;
      break;
    }
  }
  if (!cycleFound) structural += 0.25;

  // Coverage
  const stepTexts = plan.steps.map((s) => s.description.toLowerCase());
  const allDeliverablesCovered = deliverables.every((d) =>
    stepTexts.some((st) => st.includes(d.toLowerCase().substring(0, 20))),
  );
  if (allDeliverablesCovered) coverage += 0.4;
  if (plan.assumptions.length > 0) coverage += 0.2;
  if (plan.risks.length > 0) coverage += 0.2;
  if (stepTexts.some((st) => /\b(initialize|bootstrap|setup|install|configure)\b/.test(st))) coverage += 0.2;

  // Input utilization
  const goalWords = plan.goal.toLowerCase().split(/\s+/).filter((w) => w.length > 3);
  const goalReflected = goalWords.some((gw) => stepTexts.some((st) => st.includes(gw)));
  if (goalReflected) inputUtil += 0.4;
  if (plan.interviews.length > 0) inputUtil += 0.3;
  if (plan.research.length > 0) inputUtil += 0.3;

  // Clarity
  const noCompoundSteps = plan.steps.every((s) => !/\band\b/i.test(s.description));
  if (noCompoundSteps) clarity += 0.5;
  const noSubjectiveSteps = plan.steps.every(
    (s) => !/\b(good|nice|best|modern|clean|awesome|great|better|user-friendly|robust|scalable)\b/i.test(s.description),
  );
  if (noSubjectiveSteps) clarity += 0.5;

  return Math.round((structural * 0.25 + coverage * 0.35 + inputUtil * 0.25 + clarity * 0.15) * 100) / 100;
}

// ═══════════════════════════════════════════════
// Section 5 — Main Export
// ═══════════════════════════════════════════════

/**
 * Generate an initial Plan from a raw Seed, incorporating any interviews
 * and research gathered so far.
 *
 * Role: Kimi Code synthesizes a concrete Plan by reasoning over the seed
 * goal, user interview answers, and web research findings.
 *
 * Position in the loop: Runs first to bootstrap the Plan, before evaluation.
 * After evaluation and refinement, the plan evolves via plan-refiner.ts.
 *
 * Algorithm:
 * 1. Analyze goal ambiguity. If > 0.7, inject a "Clarification needed" step
 *    and flag assumptions heavily.
 * 2. Extract deliverables from goal + interviews + research.
 * 3. Identify assumptions and risks.
 * 4. Synthesize steps with dependencies, effort, and verification.
 * 5. Self-check completeness. If < 0.5, prepend a "Deep-dive research"
 *    step to buy more information before execution.
 * 6. Assemble and return the Plan.
 *
 * @param seed - Immutable user seed.
 * @param interviews - Q&A pairs from prior interviews.
 * @param research - Research summaries from web search.
 * @returns A fully populated initial Plan.
 */
export function generatePlan(
  seed: Seed,
  interviews: InterviewQA[] = [],
  research: ResearchItem[] = [],
): Promise<Plan> {
  // ── 1. Ambiguity check ──
  const ambiguity = analyzeGoalAmbiguity(seed.goal);

  // ── 2. Deliverables ──
  const deliverables = extractDeliverables(seed, interviews, research);

  // ── 3. Assumptions & Risks ──
  const assumptions = identifyAssumptions(seed, interviews, research);
  const risks = identifyRisks(seed, interviews, research);

  // ── 4. Steps ──
  let steps = synthesizeSteps(deliverables);

  // ── 5. Low-ambiguity guard ──
  // If the goal is extremely vague, the first step must be clarification
  // rather than blind execution.
  if (ambiguity > 0.7) {
    const clarifyId = crypto.randomUUID();
    steps.unshift({
      id: clarifyId,
      description: "CLARIFICATION REQUIRED: Goal is too vague to plan safely. Conduct targeted interviews or research before proceeding.",
      dependsOn: [],
      estimatedEffort: "30m–1h",
      verificationMethod: "At least 3 specific constraints, technologies, or features are documented and ambiguity score drops below 0.5.",
    });
    // Shift all other steps to depend on clarification.
    for (const s of steps) {
      if (s.id !== clarifyId && (!s.dependsOn || s.dependsOn.length === 0)) {
        s.dependsOn = [clarifyId];
      }
    }
  }

  // ── 6. Completeness guard ──
  const draftPlan: Plan = {
    id: crypto.randomUUID(),
    version: 1,
    goal: seed.goal,
    steps,
    assumptions,
    risks,
    interviews,
    research,
  };

  const completeness = scorePlanCompleteness(draftPlan, deliverables);
  if (completeness < 0.5 && steps[0]?.description !== "Deep-dive research before execution") {
    const researchId = crypto.randomUUID();
    steps.unshift({
      id: researchId,
      description: "Deep-dive research: Plan completeness is too low. Investigate missing technology, scope, or acceptance criteria before coding.",
      dependsOn: [],
      estimatedEffort: "1–2h",
      verificationMethod: "Completeness score rises to ≥ 0.5 or research items increase by ≥ 2 with direct impact on step definitions.",
    });
    for (const s of steps) {
      if (s.id !== researchId && (!s.dependsOn || s.dependsOn.length === 0)) {
        s.dependsOn = [researchId];
      }
    }
  }

  return Promise.resolve(draftPlan);
}
