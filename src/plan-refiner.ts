/**
 * Plan refiner — defines the role Kimi Code performs to improve a plan.
 *
 * In the planning harness, this module sits in the loop after evaluation,
 * interview, and research. Kimi Code uses the evaluation verdict to identify
 * improvements, generates follow-up questions via AskUserQuestion, and
 * formulates research queries via WebSearch. The resulting PlanEvolution
 * feeds back into the next planning iteration.
 *
 * ---------------------------------------------------------------------------
 * REFINEMENT PHILOSOPHY
 * ---------------------------------------------------------------------------
 * A plan evolves through targeted mutations. Each dimension (ambiguity,
 * completeness, feasibility, alignment) has its own threshold-based strategy.
 * The refiner acts as a "triage doctor": it diagnoses the weakest dimension,
 * prescribes the right mix of interview, research, and structural edits, and
 * produces an updated plan ready for the next generation.
 *
 * Concrete score mapping (examples):
 * - ambiguity 0.8  → "Build a good website" (vague adjective, no stack)
 * - ambiguity 0.2  → "Build Astro blog with Cloudflare Pages, MDX, RSS"
 * - completeness 0.3 → Steps: ["Build backend"] (no DB, auth, API surface)
 * - completeness 0.9 → Every step has deps, effort, verification criteria
 * - feasibility 0.2  → "Rewrite Linux kernel in 1 day by one junior dev"
 * - feasibility 0.9  → "Add CSS utility class to existing Button component"
 * - goalAlignment 0.3 → Seed: "landing page", Plan: "SaaS billing system"
 * - goalAlignment 0.9 → Seed: "landing page", Plan: "Astro marketing site"
 */

import type { Plan, PlanVerdict, PlanEvolution, PlanStep, MemoryArchive } from "./types.js";
import { getLastMemories } from './memory.js';

// ───────────────────────────────────────────────
// Thresholds & rubrics
// ───────────────────────────────────────────────

/** Score bands that dictate refinement intensity. */
const SCORE_BANDS = {
  /** Plan is excellent; only cosmetic polish is allowed. */
  EXCELLENT: 0.85,
  /** Plan is viable but needs material improvement before execution. */
  ACCEPTABLE: 0.6,
  /** Plan is dangerously vague or misaligned; aggressive intervention required. */
  CRITICAL: 0.4,
} as const;

/** Per-dimension severity thresholds. */
const DIM = {
  ambiguity: { CRITICAL: 0.7, HIGH: 0.5, LOW: 0.3 },
  completeness: { CRITICAL: 0.4, LOW: 0.7, EXCELLENT: 0.9 },
  feasibility: { CRITICAL: 0.3, LOW: 0.6, EXCELLENT: 0.85 },
  goalAlignment: { CRITICAL: 0.5, LOW: 0.75, EXCELLENT: 0.9 },
} as const;

// ───────────────────────────────────────────────
// Strategy types
// ───────────────────────────────────────────────

type Severity = "critical" | "major" | "minor" | "none";
type ActionKind = "interview" | "research" | "structural" | "polish" | "prune";

interface DimensionStrategy {
  /** Which dimension this strategy addresses. */
  dimension: keyof typeof DIM;
  /** How badly this dimension is scored. */
  severity: Severity;
  /** Primary lever to pull. */
  primaryAction: ActionKind;
  /** Secondary lever (often mixed with primary). */
  secondaryAction?: ActionKind;
  /** Human-readable diagnosis for logging / JSDoc. */
  diagnosis: string;
  /** Concrete fix prescriptions. */
  prescriptions: string[];
}

// ───────────────────────────────────────────────
// Decision tree: classify each dimension
// ───────────────────────────────────────────────

/**
 * Map a single dimension score to a {@link DimensionStrategy}.
 *
 * WHY: Different scores require different interventions. A plan with high
 * ambiguity needs user clarification (interview), whereas low feasibility
 * needs external validation (research) or scope reduction (structural).
 *
 * @param dimension - The quality dimension being assessed.
 * @param score     - 0.0–1.0 score for that dimension.
 * @returns A strategy describing what to do about this dimension.
 */
function classifyDimension(
  dimension: keyof typeof DIM,
  score: number,
): DimensionStrategy {
  switch (dimension) {
    case "ambiguity": {
      if (score > DIM.ambiguity.CRITICAL) {
        return {
          dimension,
          severity: "critical",
          primaryAction: "interview",
          secondaryAction: "structural",
          diagnosis:
            "Goal or steps are hopelessly vague. Example: 'Build a good website' — 'good' is subjective, stack undefined.",
          prescriptions: [
            "Ask user: target audience, tech stack, success metrics.",
            "Replace adjectives with measurable criteria (e.g., 'good' → 'Lighthouse score ≥ 90').",
            "Add assumptions documenting every interpretation the planner made.",
          ],
        };
      }
      if (score > DIM.ambiguity.HIGH) {
        return {
          dimension,
          severity: "major",
          primaryAction: "interview",
          secondaryAction: "polish",
          diagnosis:
            "Some terms are undefined. Example: 'Integrate AI' — which model? Hosted or self-hosted?",
          prescriptions: [
            "Generate 2–3 targeted questions about undefined nouns in steps.",
            "Add fallback assumptions so the plan can proceed if user is slow to answer.",
          ],
        };
      }
      if (score > DIM.ambiguity.LOW) {
        return {
          dimension,
          severity: "minor",
          primaryAction: "polish",
          diagnosis:
            "Minor phrasing could be tighter. Example: 'Set up DB' → 'Provision PostgreSQL 16 via Docker Compose'.",
          prescriptions: [
            "Clarify step descriptions without adding new questions.",
          ],
        };
      }
      return {
        dimension,
        severity: "none",
        primaryAction: "polish",
        diagnosis: "Ambiguity is low. Preserve clarity, do not regress.",
        prescriptions: ["Audit each step for subjective adjectives."],
      };
    }

    case "completeness": {
      if (score < DIM.completeness.CRITICAL) {
        return {
          dimension,
          severity: "critical",
          primaryAction: "structural",
          secondaryAction: "interview",
          diagnosis:
            "Plan is a skeleton. Example: only one step 'Build backend' with no auth, DB, API, deployment.",
          prescriptions: [
            "Decompose every vague step into 3–5 concrete sub-steps.",
            "Add missing standard phases: setup, implementation, testing, deployment.",
            "Ask user about implicit requirements (auth, analytics, SEO).",
          ],
        };
      }
      if (score < DIM.completeness.LOW) {
        return {
          dimension,
          severity: "major",
          primaryAction: "structural",
          secondaryAction: "research",
          diagnosis:
            "Core pieces exist but gaps remain. Example: steps have descriptions but no verificationMethod or deps.",
          prescriptions: [
            "Add dependsOn links so execution order is unambiguous.",
            "Add estimatedEffort to every step.",
            "Add verificationMethod ('unit tests pass', 'preview URL loads').",
          ],
        };
      }
      if (score < DIM.completeness.EXCELLENT) {
        return {
          dimension,
          severity: "minor",
          primaryAction: "polish",
          diagnosis:
            "Nearly complete. Example: one step lacks effort estimate, or rollback plan is missing.",
          prescriptions: [
            "Fill missing metadata fields (effort, verification).",
            "Add contingency / rollback step if deployment is involved.",
          ],
        };
      }
      return {
        dimension,
        severity: "none",
        primaryAction: "polish",
        diagnosis: "Completeness is high. Guard against over-engineering.",
        prescriptions: [
          "Ensure steps are MECE (Mutually Exclusive, Collectively Exhaustive).",
        ],
      };
    }

    case "feasibility": {
      if (score < DIM.feasibility.CRITICAL) {
        return {
          dimension,
          severity: "critical",
          primaryAction: "research",
          secondaryAction: "structural",
          diagnosis:
            "Plan is effectively impossible. Example: 'Rewrite Linux kernel in 1 day by one junior dev'.",
          prescriptions: [
            "Research actual time budgets for comparable tasks.",
            "Reduce scope to an MVP that fits the constraint.",
            "Add a spike / proof-of-concept step before commitment.",
          ],
        };
      }
      if (score < DIM.feasibility.LOW) {
        return {
          dimension,
          severity: "major",
          primaryAction: "research",
          secondaryAction: "interview",
          diagnosis:
            "Plan is risky. Example: 'Migrate 10 TB production DB with zero downtime in 2 hours'.",
          prescriptions: [
            "Research known migration patterns and downtime windows.",
            "Ask user: what is the maximum acceptable downtime?",
            "Add risk mitigations: backup step, rollback procedure, canary deployment.",
          ],
        };
      }
      if (score < DIM.feasibility.EXCELLENT) {
        return {
          dimension,
          severity: "minor",
          primaryAction: "polish",
          secondaryAction: "research",
          diagnosis:
            "Minor friction. Example: unfamiliar library mentioned but version unspecified.",
          prescriptions: [
            "Research latest stable version of proposed dependencies.",
            "Add step for local environment validation.",
          ],
        };
      }
      return {
        dimension,
        severity: "none",
        primaryAction: "polish",
        diagnosis: "Feasibility is high. Look for parallelization wins.",
        prescriptions: [
          "Identify steps with no shared deps and mark as parallelizable.",
        ],
      };
    }

    case "goalAlignment": {
      if (score < DIM.goalAlignment.CRITICAL) {
        return {
          dimension,
          severity: "critical",
          primaryAction: "prune",
          secondaryAction: "interview",
          diagnosis:
            "Severe drift. Example: Seed says 'landing page', plan builds 'SaaS billing system'.",
          prescriptions: [
            "Prune every step that does not directly serve the seed.goal.",
            "Re-derive the plan from seed.goal as if starting from scratch.",
            "Ask user: did the goal change, or did the planner hallucinate scope?",
          ],
        };
      }
      if (score < DIM.goalAlignment.LOW) {
        return {
          dimension,
          severity: "major",
          primaryAction: "structural",
          secondaryAction: "interview",
          diagnosis:
            "Scope creep or tangential steps. Example: Seed says 'landing page', plan includes user dashboard.",
          prescriptions: [
            "Move tangential steps to a 'Future work' risk note.",
            "Rephrase step descriptions to tie back to the seed goal.",
            "Ask user: is the dashboard a hard requirement or nice-to-have?",
          ],
        };
      }
      if (score < DIM.goalAlignment.EXCELLENT) {
        return {
          dimension,
          severity: "minor",
          primaryAction: "polish",
          diagnosis:
            "Minor wording drift. Example: seed mentions 'fast', plan never defines a performance budget.",
          prescriptions: [
            "Add a performance-budget or acceptance-criteria step.",
            "Reference seed.goal explicitly in the plan preamble.",
          ],
        };
      }
      return {
        dimension,
        severity: "none",
        primaryAction: "polish",
        diagnosis: "Alignment is excellent. Prevent future drift.",
        prescriptions: [
          "Tag each step with the seed constraint it satisfies.",
        ],
      };
    }

    default: {
      // Exhaustiveness guard. TypeScript ensures we never hit this,
      // but the explicit error prevents silent failures if DIM is extended.
      const _exhaustive: never = dimension;
      throw new Error(`Unhandled dimension: ${_exhaustive}`);
    }
  }
}

// ───────────────────────────────────────────────
// Aggregate strategy selection
// ───────────────────────────────────────────────

/**
 * Rank dimension strategies by severity so the most critical problem
 * is addressed first. This prevents "polishing prose while the house
 * is on fire" — i.e., fixing wording when the plan is completely
 * infeasible.
 *
 * @param verdict - The evaluation result.
 * @returns Array of strategies ordered from most to least severe.
 */
function rankStrategies(verdict: PlanVerdict): DimensionStrategy[] {
  const strategies: DimensionStrategy[] = [
    classifyDimension("ambiguity", verdict.ambiguity),
    classifyDimension("completeness", verdict.completeness),
    classifyDimension("feasibility", verdict.feasibility),
    classifyDimension("goalAlignment", verdict.goalAlignment),
  ];

  // Severity ranking: critical > major > minor > none.
  const rankOrder: Record<Severity, number> = {
    critical: 0,
    major: 1,
    minor: 2,
    none: 3,
  };

  return strategies.sort((a, b) => rankOrder[a.severity] - rankOrder[b.severity]);
}

/**
 * Decide whether the plan needs a cosmetic update or a structural overhaul.
 *
 * WHY: Bumping `version` is not enough. If the composite score is below
 * CRITICAL, we must reset assumptions and risks because the old plan
 * was built on false premises.
 *
 * @param compositeScore - The overall verdict.score.
 * @returns True if the plan should undergo aggressive mutation.
 */
function needsAggressiveRefinement(compositeScore: number): boolean {
  return compositeScore < SCORE_BANDS.CRITICAL;
}

/**
 * Decide whether the plan is in the "polish zone" where only metadata
 * and wording should change.
 *
 * @param compositeScore - The overall verdict.score.
 * @returns True if the plan is nearly ready.
 */
function isPolishOnly(compositeScore: number): boolean {
  return compositeScore >= SCORE_BANDS.EXCELLENT;
}

// ───────────────────────────────────────────────
// Plan mutations
// ───────────────────────────────────────────────

/**
 * Audit every step and inject missing metadata based on completeness
 * and feasibility scores.
 *
 * WHY: A step without verificationMethod is a wish, not a plan.
 * A step without estimatedEffort cannot be scheduled.
 *
 * @param steps     - Current plan steps.
 * @param verdict   - Evaluation verdict.
 * @returns Mutated steps with gaps filled where possible.
 */
function injectMissingMetadata(steps: PlanStep[], verdict: PlanVerdict): PlanStep[] {
  // If completeness is high, we trust the existing shape and only patch holes.
  const patchOnly = verdict.completeness >= DIM.completeness.LOW;

  return steps.map((step, index) => {
    const patches: Partial<PlanStep> = {};

    if (!step.estimatedEffort) {
      // Default heuristic: assume 2h for implementation steps, 1h for setup.
      // WHY: Something is better than nothing; it forces the planner to think
      // in concrete time boxes rather than hand-waving.
      patches.estimatedEffort = index === 0 ? "1h" : "2h";
    }

    if (!step.verificationMethod) {
      // Tie verification to the step's verb.
      // WHY: Verifiable steps prevent "done-but-not-really" syndrome.
      const lower = step.description.toLowerCase();
      if (lower.includes("test") || lower.includes("spec")) {
        patches.verificationMethod = "All tests pass in CI.";
      } else if (lower.includes("deploy") || lower.includes("release")) {
        patches.verificationMethod = "Production URL returns 200 OK.";
      } else if (lower.includes("setup") || lower.includes("install")) {
        patches.verificationMethod = "Local dev server starts without errors.";
      } else {
        patches.verificationMethod = "Code review approved and merged to main.";
      }
    }

    if (!step.dependsOn && index > 0 && !patchOnly) {
      // Chain steps linearly as a safe default when deps are missing.
      // WHY: Parallelism is an optimization; correctness requires ordering.
      const prevId = steps[index - 1]?.id;
      if (prevId) {
        patches.dependsOn = [prevId];
      }
    }

    return { ...step, ...patches };
  });
}

/**
 * Prune or rephrase steps that violate goal alignment.
 *
 * WHY: Goal drift kills projects. If the user asked for a landing page,
 * steps about building a payment gateway must be removed or quarantined.
 *
 * @param plan    - Current plan.
 * @param verdict - Evaluation verdict.
 * @returns Tuple of [pruned steps, quarantined descriptions].
 */
function alignStepsToGoal(
  plan: Plan,
  verdict: PlanVerdict,
): { steps: PlanStep[]; quarantined: string[] } {
  if (verdict.goalAlignment >= DIM.goalAlignment.EXCELLENT) {
    return { steps: plan.steps, quarantined: [] };
  }

  const quarantined: string[] = [];
  const seedGoalLower = plan.goal.toLowerCase();

  const filtered = plan.steps.filter((step) => {
    const stepLower = step.description.toLowerCase();

    // Heuristic: if the step contains keywords that are clearly alien to the goal,
    // flag it. This is a lightweight guardrail, not NLP.
    // Example: seed "landing page", step "implement Stripe billing" → quarantine.
    const alienKeywords: Record<string, string[]> = {
      "landing page": ["billing", "subscription", "payment gateway", "invoice"],
      api: ["ui", "frontend", "css", "component"],
      frontend: ["database schema", "migration", "orm"],
    };

    let isAlien = false;
    for (const [goalFrag, aliens] of Object.entries(alienKeywords)) {
      if (seedGoalLower.includes(goalFrag)) {
        if (aliens.some((a) => stepLower.includes(a))) {
          isAlien = true;
          break;
        }
      }
    }

    if (isAlien && verdict.goalAlignment < DIM.goalAlignment.CRITICAL) {
      quarantined.push(step.description);
      return false;
    }

    return true;
  });

  return { steps: filtered, quarantined };
}

/**
 * Build assumptions and risks based on the weakest dimensions.
 *
 * WHY: Every plan rests on assumptions. Explicitly writing them down
 * turns hidden risks into manageable issues.
 *
 * @param plan       - Current plan.
 * @param strategies - Ranked dimension strategies.
 * @param verdict    - Evaluation verdict.
 * @returns Updated assumptions and risks arrays.
 */
function deriveAssumptionsAndRisks(
  plan: Plan,
  strategies: DimensionStrategy[],
  verdict: PlanVerdict,
): { assumptions: string[]; risks: string[] } {
  const assumptions = [...plan.assumptions];
  const risks = [...plan.risks];

  // De-duplicate via manual guard (arrays are small, Set overhead is negligible
  // but keeping insertion order is useful for readability).
  const addAssumption = (text: string) => {
    if (!assumptions.includes(text)) assumptions.push(text);
  };
  const addRisk = (text: string) => {
    if (!risks.includes(text)) risks.push(text);
  };

  for (const s of strategies) {
    if (s.severity === "none") continue;

    switch (s.dimension) {
      case "ambiguity": {
        addAssumption(
          "Planner interpreted ambiguous requirements conservatively. Re-evaluate if user answers contradict these interpretations.",
        );
        addRisk("Scope may expand once ambiguous terms are clarified.");
        break;
      }
      case "completeness": {
        addAssumption(
          `All standard project phases (dev, test, deploy) are covered by generation ${plan.version}.`,
        );
        addRisk(
          "Missing implicit requirements (auth, observability, analytics) may surface during execution.",
        );
        break;
      }
      case "feasibility": {
        addAssumption(
          "Time and resource estimates are based on publicly available benchmarks, not team velocity.",
        );
        addRisk("Schedule slip if benchmarks do not match local environment or skill level.");
        break;
      }
      case "goalAlignment": {
        addAssumption(`Current plan steps are strictly scoped to: "${plan.goal}".`);
        addRisk("User may perceive pruned steps as lost value; document rationale.");
        break;
      }
    }
  }

  // If feasibility is critically low, add a hard constraint assumption.
  if (verdict.feasibility < DIM.feasibility.CRITICAL) {
    addAssumption(
      "Scope was reduced to fit feasibility constraints; full feature set requires a follow-up plan.",
    );
    addRisk("MVP may not satisfy stakeholder expectations used to the original scope.");
  }

  return { assumptions, risks };
}

// ───────────────────────────────────────────────
// Question synthesis
// ───────────────────────────────────────────────

/**
 * Generate additional interview questions beyond what the evaluator provided.
 *
 * WHY: The evaluator identifies gaps, but the refiner knows *why* those gaps
 * matter and can ask sharper, more contextual questions.
 *
 * @param plan       - Current plan.
 * @param verdict    - Evaluation verdict.
 * @param strategies - Ranked strategies.
 * @returns Array of question strings.
 */
function synthesizeQuestions(
  plan: Plan,
  verdict: PlanVerdict,
  strategies: DimensionStrategy[],
  archive?: MemoryArchive,
): string[] {
  const questions: string[] = [...verdict.missingQuestions];

  const add = (q: string) => {
    if (!questions.includes(q)) questions.push(q);
  };

  // Walk strategies from most to least severe.
  for (const s of strategies) {
    if (s.severity === "none") continue;

    switch (s.dimension) {
      case "ambiguity": {
        if (s.severity === "critical") {
          add("What does success look like for this project? List 3 measurable outcomes.");
          add("Which tech stack (framework, runtime, database) is preferred or forbidden?");
        } else if (s.severity === "major") {
          // Scan steps for vague nouns/adjectives.
          const vaguePatterns = [
            "good",
            "fast",
            "secure",
            "scalable",
            "nice",
            "better",
            "improve",
          ];
          const vagueHits = plan.steps
            .filter((st) => vaguePatterns.some((p) => st.description.toLowerCase().includes(p)))
            .map((st) => st.description);
          if (vagueHits.length > 0) {
            add(
              `The steps mention subjective terms (${vagueHits
                .slice(0, 2)
                .join("; ")}). Can you define quantifiable targets?`,
            );
          }
        }
        break;
      }
      case "completeness": {
        if (s.severity === "critical") {
          add("Are there implicit requirements like authentication, rate-limiting, or audit logging?");
          add(
            "What is the definition of 'done'? Do you need code review, QA, or compliance sign-off?",
          );
        } else if (s.severity === "major") {
          if (
            plan.steps.some((st) => !st.dependsOn || st.dependsOn.length === 0) &&
            plan.steps.length > 1
          ) {
            add(
              "Several steps lack dependencies. Are any of them parallelizable, or must they run sequentially?",
            );
          }
        }
        break;
      }
      case "feasibility": {
        if (s.severity === "critical") {
          add(
            "Given the current timeline, which feature is the absolute minimum viable product (MVP)?",
          );
          add("What is the hard deadline, and what happens if it slips?");
        } else if (s.severity === "major") {
          add("Have you done a similar migration/implementation before? What was the actual effort?");
        }
        break;
      }
      case "goalAlignment": {
        if (s.severity === "critical") {
          add("The plan seems to diverge significantly from the original goal. Has the goal changed?");
        } else if (s.severity === "major") {
          add("Some steps feel tangential to the core goal. Should they be moved to a future phase?");
        }
        break;
      }
    }
  }

  if (archive) {
    const last3 = getLastMemories(archive, 3);
    for (const mem of last3) {
      if (mem.failures.length > 0) {
        add(`Previous attempt (gen ${mem.generation}) failed because: ${mem.failures.join('; ')}. We will try a different approach.`);
      }
      if (mem.discardedIdeas.length > 0) {
        add(`Previous attempt (gen ${mem.generation}) discarded these ideas: ${mem.discardedIdeas.join(', ')}. Do not reintroduce them.`);
      }
    }
  }

  return questions;
}

// ───────────────────────────────────────────────
// Research synthesis
// ───────────────────────────────────────────────

/**
 * Generate research queries beyond what the evaluator provided.
 *
 * WHY: Research is expensive (web search latency). The refiner should only
 * ask questions that directly unblock plan refinement.
 *
 * @param plan       - Current plan.
 * @param verdict    - Evaluation verdict.
 * @param strategies - Ranked strategies.
 * @returns Array of research query strings.
 */
function synthesizeResearch(
  plan: Plan,
  verdict: PlanVerdict,
  strategies: DimensionStrategy[],
): string[] {
  const queries: string[] = [...verdict.missingResearch];

  const add = (q: string) => {
    if (!queries.includes(q)) queries.push(q);
  };

  for (const s of strategies) {
    if (s.severity === "none") continue;

    switch (s.dimension) {
      case "ambiguity": {
        if (s.severity === "major") {
          // If the plan mentions a technology but not a version, research it.
          const techMentions = ["framework", "library", "database", "cms", "platform"];
          const hasTech = plan.steps.some((st) =>
            techMentions.some((t) => st.description.toLowerCase().includes(t)),
          );
          if (hasTech) {
            add("Latest stable version and deprecation status of technologies mentioned in the plan");
          }
        }
        break;
      }
      case "feasibility": {
        if (s.severity === "critical" || s.severity === "major") {
          add("Industry benchmarks for effort and risk of comparable projects");
          add("Common failure modes and rollback strategies for this type of project");
        } else if (s.severity === "minor") {
          add("Best practices and latest stable releases for dependencies used in the plan");
        }
        break;
      }
      case "completeness": {
        if (s.severity === "critical") {
          add("Standard checklist for this type of project (e.g., 'web app launch checklist')");
        }
        break;
      }
      case "goalAlignment": {
        // Alignment issues are rarely solvable by web research; they need user input.
        break;
      }
    }
  }

  return queries;
}

// ───────────────────────────────────────────────
// Main entrypoint
// ───────────────────────────────────────────────

/**
 * Evolve a plan based on evaluation feedback.
 *
 * This is the refinement step in the planning loop. Kimi Code reads the
 * verdict's missing questions and research topics, then produces an updated
 * plan along with new interview questions (AskUserQuestion) and research
 * queries (WebSearch) for the next cycle.
 *
 * ---------------------------------------------------------------------------
 * REFINEMENT PIPELINE (executed in order)
 * ---------------------------------------------------------------------------
 * 1. **Classify** each dimension (ambiguity, completeness, feasibility,
 *    goalAlignment) into a severity + action strategy.
 * 2. **Rank** strategies so critical issues are handled before cosmetic ones.
 * 3. **Mutate** the plan:
 *    - If score < 0.40 → aggressive reset (clear assumptions, realign steps).
 *    - If score ≥ 0.85 → polish only (metadata, wording).
 *    - Otherwise → balanced mutation (metadata injection + targeted pruning).
 * 4. **Synthesize** follow-up interview questions based on severity.
 * 5. **Synthesize** research queries that unblock the weakest dimensions.
 * 6. **Return** PlanEvolution with incremented version.
 *
 * Concrete examples of threshold behavior:
 * - Score 0.30 / ambiguity 0.80 → 5+ interview questions, 3+ research queries,
 *   assumptions cleared, steps pruned if misaligned.
 * - Score 0.75 / completeness 0.60 → 2 interview questions, 1 research query,
 *   missing deps and verification methods injected.
 * - Score 0.90 / all dims green → 0 questions, 0 research, version bumped,
 *   minor wording audit only.
 *
 * @param plan    — the current plan to refine.
 * @param verdict — evaluation result with feedback / missing items.
 * @returns PlanEvolution — updated plan + follow-up questions & research.
 */
export async function refinePlan(plan: Plan, verdict: PlanVerdict, archive?: MemoryArchive): Promise<PlanEvolution> {
  // Step 1 & 2: classify and rank dimensions.
  const strategies = rankStrategies(verdict);
  const topStrategy = strategies[0];

  // Decide mutation intensity.
  const aggressive = needsAggressiveRefinement(verdict.score);
  const polishOnly = isPolishOnly(verdict.score);

  // Start from a shallow copy so we can mutate fields incrementally.
  let updatedPlan: Plan = { ...plan };

  // Step 3a: version bump (always).
  updatedPlan.version = plan.version + 1;

  // Step 3b: if aggressive, reset assumptions/risks because old premises
  // are likely invalid. Example: feasibility 0.2 means the plan was built
  // on impossible time estimates; keeping old assumptions is dangerous.
  if (aggressive) {
    updatedPlan.assumptions = [];
    updatedPlan.risks = [];
  }

  // Step 3c: align steps to goal (prune if alignment is critical).
  const { steps: alignedSteps, quarantined } = alignStepsToGoal(updatedPlan, verdict);
  updatedPlan.steps = alignedSteps;

  // If steps were quarantined, add a risk note so the user knows why.
  if (quarantined.length > 0) {
    updatedPlan.risks = [
      ...updatedPlan.risks,
      `Quarantined steps due to goal drift: ${quarantined.join("; ")}`,
    ];
  }

  // Step 3d: inject metadata (effort, verification, deps) unless polish-only.
  if (!polishOnly) {
    updatedPlan.steps = injectMissingMetadata(updatedPlan.steps, verdict);
  }

  // Step 3e: derive assumptions and risks from dimension strategies.
  const { assumptions, risks } = deriveAssumptionsAndRisks(updatedPlan, strategies, verdict);
  updatedPlan.assumptions = assumptions;
  updatedPlan.risks = risks;

  // Surface the top priority as an assumption so the next planning generation
  // knows exactly what to focus on.
  if (topStrategy && topStrategy.severity !== "none") {
    updatedPlan.assumptions = [
      ...updatedPlan.assumptions,
      `Top refinement priority (${topStrategy.dimension}): ${topStrategy.diagnosis}`,
    ];
  }

  // Step 3f: if polish-only, do a lightweight audit comment (no structural change).
  if (polishOnly) {
    updatedPlan.assumptions = [
      ...updatedPlan.assumptions,
      `Polish pass (v${updatedPlan.version}): no structural changes; verify wording and estimates are still current.`,
    ];
  }

  // Step 4 & 5: synthesize questions and research.
  const interviewQuestions = synthesizeQuestions(updatedPlan, verdict, strategies, archive);
  const researchQueries = synthesizeResearch(updatedPlan, verdict, strategies);

  // Warn if previously discarded ideas are reintroduced
  if (archive) {
    const recentDiscarded = new Set(
      getLastMemories(archive, 3).flatMap(m => m.discardedIdeas)
    );
    for (const idea of recentDiscarded) {
      const ideaLower = idea.toLowerCase();
      for (const step of updatedPlan.steps) {
        const descLower = step.description.toLowerCase();
        if (descLower.includes(ideaLower) || ideaLower.includes(descLower)) {
          console.warn(`⚠️ Warning: Previously discarded idea "${idea}" may be reintroduced in step: ${step.description}`);
        }
      }
      for (const assumption of updatedPlan.assumptions) {
        const assLower = assumption.toLowerCase();
        if (assLower.includes(ideaLower) || ideaLower.includes(assLower)) {
          console.warn(`⚠️ Warning: Previously discarded idea "${idea}" may be reintroduced in assumption: ${assumption}`);
        }
      }
      for (const risk of updatedPlan.risks) {
        const riskLower = risk.toLowerCase();
        if (riskLower.includes(ideaLower) || ideaLower.includes(riskLower)) {
          console.warn(`⚠️ Warning: Previously discarded idea "${idea}" may be reintroduced in risk: ${risk}`);
        }
      }
    }
  }

  return {
    updatedPlan,
    interviewQuestions,
    researchQueries,
  };
}
