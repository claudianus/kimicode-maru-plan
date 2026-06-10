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
// Section 1 — Goal Analysis & Template Selection
// ═══════════════════════════════════════════════

/**
 * Supported project archetypes for template selection.
 */
type ProjectType = "web" | "api" | "cli" | "mobile" | "generic";

/**
 * Detect the project archetype from the seed goal using keyword heuristics.
 *
 * Rules:
 * - Web/blog keywords: "blog", "website", "web", "frontend", "landing page",
 *   "portfolio", "site", "saas"
 * - API/backend keywords: "api", "backend", "server", "microservice", "rest",
 *   "graphql", "grpc"
 * - CLI/tool keywords: "cli", "command line", "tool", "script", "utility",
 *   "terminal"
 * - Mobile keywords: "mobile", "ios", "android", "react native", "flutter",
 *   "app", "pwa"
 * - Fallback: "generic"
 *
 * @param goal - The seed goal string.
 * @returns One of the supported project types.
 */
function detectProjectType(goal: string): ProjectType {
  const lower = goal.toLowerCase();
  if (/\b(blog|website|web|frontend|landing page|portfolio|site|saas)\b/.test(lower)) return "web";
  if (/\b(api|backend|server|microservice|rest|graphql|grpc)\b/.test(lower)) return "api";
  if (/\b(cli|command.?line|tool|script|utility|terminal)\b/.test(lower)) return "cli";
  if (/\b(mobile|ios|android|react native|flutter|app|pwa)\b/.test(lower)) return "mobile";
  return "generic";
}

/**
 * Build a base template of steps for a given project type.
 *
 * Each template follows a logical execution order:
 * - Web/blog: init → design → implement → optimize → deploy
 * - API/backend: spec → implement → test → deploy → monitor
 * - CLI/tool: init → parse-args → core-logic → test → package
 * - Mobile: init → UI → state → API → deploy
 * - Generic: research → design → implement → test → deploy
 *
 * @param type - Detected project type.
 * @returns Ordered array of partial steps (no ids or dependsOn yet).
 */
function getBaseTemplate(type: ProjectType): Array<Omit<PlanStep, "id" | "dependsOn">> {
  switch (type) {
    case "web":
      return [
        {
          description: "Initialize project, tooling, and dependencies",
          estimatedEffort: "1–2h",
          verificationMethod: "Dev server starts without errors; lint and type-check pass.",
        },
        {
          description: "Design system, layout structure, and component hierarchy",
          estimatedEffort: "2–4h",
          verificationMethod: "Style guide or component catalog is documented and renders correctly.",
        },
        {
          description: "Implement core pages, features, and content",
          estimatedEffort: "4–8h",
          verificationMethod: "All primary user flows work in dev build; no console errors.",
        },
        {
          description: "Optimize performance, SEO, and accessibility",
          estimatedEffort: "2–4h",
          verificationMethod: "Lighthouse score meets target; manual a11y audit passes.",
        },
        {
          description: "Build and deploy to production or staging",
          estimatedEffort: "1–2h",
          verificationMethod: "Live URL accessible; smoke tests pass.",
        },
      ];
    case "api":
      return [
        {
          description: "Define API specification and data models",
          estimatedEffort: "2–4h",
          verificationMethod: "OpenAPI or schema document reviewed and agreed upon.",
        },
        {
          description: "Implement endpoints, business logic, and persistence",
          estimatedEffort: "4–8h",
          verificationMethod: "All endpoints return expected responses via manual or automated tests.",
        },
        {
          description: "Write unit and integration tests",
          estimatedEffort: "2–4h",
          verificationMethod: "Test suite passes with ≥ 80 % coverage of critical paths.",
        },
        {
          description: "Configure infrastructure and deploy",
          estimatedEffort: "1–3h",
          verificationMethod: "Service is live and health-check endpoint returns 200.",
        },
        {
          description: "Set up monitoring, logging, and alerting",
          estimatedEffort: "1–2h",
          verificationMethod: "Alerts fire on simulated error; logs are queryable.",
        },
      ];
    case "cli":
      return [
        {
          description: "Initialize project and install dependencies",
          estimatedEffort: "30m–1h",
          verificationMethod: "Build succeeds and binary is generated.",
        },
        {
          description: "Implement CLI argument parsing and help text",
          estimatedEffort: "1–2h",
          verificationMethod: "--help output is accurate; unknown flags produce errors.",
        },
        {
          description: "Implement core logic and functionality",
          estimatedEffort: "3–6h",
          verificationMethod: "All documented commands produce correct output for sample inputs.",
        },
        {
          description: "Write unit tests and edge-case coverage",
          estimatedEffort: "2–3h",
          verificationMethod: "Test suite passes; edge cases (empty input, large files) handled.",
        },
        {
          description: "Package and publish or distribute",
          estimatedEffort: "1–2h",
          verificationMethod: "Installation from registry or binary download works on target platforms.",
        },
      ];
    case "mobile":
      return [
        {
          description: "Initialize mobile project and dependencies",
          estimatedEffort: "1–2h",
          verificationMethod: "Simulator or emulator launches app without crashes.",
        },
        {
          description: "Build UI screens, components, and navigation",
          estimatedEffort: "4–8h",
          verificationMethod: "All screens render correctly; navigation flows match design.",
        },
        {
          description: "Implement state management and local data layer",
          estimatedEffort: "3–5h",
          verificationMethod: "State persists across screen changes; offline mode works where applicable.",
        },
        {
          description: "Integrate backend APIs and handle errors",
          estimatedEffort: "3–5h",
          verificationMethod: "API calls succeed; error states (network, 401, 500) are handled visibly.",
        },
        {
          description: "Build and deploy to store or device",
          estimatedEffort: "2–4h",
          verificationMethod: "Release build succeeds; app installs and runs on physical device.",
        },
      ];
    case "generic":
    default:
      return [
        {
          description: "Research technologies, approaches, and constraints",
          estimatedEffort: "1–2h",
          verificationMethod: "Decision record documents chosen stack and rejected alternatives.",
        },
        {
          description: "Design architecture, data model, and user experience",
          estimatedEffort: "2–4h",
          verificationMethod: "Diagrams or documents reviewed; acceptance criteria defined.",
        },
        {
          description: "Implement core functionality",
          estimatedEffort: "4–8h",
          verificationMethod: "Primary use cases work end-to-end in dev environment.",
        },
        {
          description: "Test, validate, and fix issues",
          estimatedEffort: "2–4h",
          verificationMethod: "All known bugs resolved; QA checklist passes.",
        },
        {
          description: "Deploy, release, and document",
          estimatedEffort: "1–2h",
          verificationMethod: "Users can access or install the deliverable; README is complete.",
        },
      ];
  }
}

// ═══════════════════════════════════════════════
// Section 2 — Template Customization
// ═══════════════════════════════════════════════

/**
 * Customize template steps using seed constraints, nonGoals, interviews, and
 * research.
 *
 * Customization rules:
 * 1. Inject seed.constraints into the first step so they are visible early.
 * 2. Remove any step whose description matches a seed.nonGoals keyword
 *    (e.g., nonGoal "CMS integration" removes a step mentioning "CMS").
 * 3. Add steps for new needs surfaced in interview answers.
 * 4. Add steps for best practices or common requirements found in research.
 *
 * @param steps - Base template steps (already have ids).
 * @param seed - The user seed.
 * @param interviews - Completed interviews.
 * @param research - Research items.
 * @returns Customized steps array.
 */
function customizeSteps(
  steps: PlanStep[],
  seed: Seed,
  interviews: InterviewQA[],
  research: ResearchItem[],
): PlanStep[] {
  const customized = steps.map((s) => ({ ...s }));
  const nonGoalsLower = (seed.nonGoals ?? []).map((ng) => ng.toLowerCase());

  // Rule 1: Inject constraints into the first step.
  if (customized.length > 0 && seed.constraints.length > 0) {
    const first = customized[0];
    if (first) {
      const constraintList = seed.constraints.join("; ");
      first.description += ` (constraints: ${constraintList})`;
    }
  }

  // Rule 2: Filter out steps that match nonGoals.
  const filtered = customized.filter((step) => {
    const stepLower = step.description.toLowerCase();
    return !nonGoalsLower.some((ng) => {
      const keywords = ng.split(/\s+/).filter((w) => w.length > 3);
      return keywords.some((kw) => stepLower.includes(kw.toLowerCase()));
    });
  });

  // Rule 3: Add interview-driven steps for unmet needs.
  for (const qa of interviews) {
    if (!qa.answer) continue;
    const existingDescriptions = filtered.map((s) => s.description.toLowerCase());

    const newReqMatch = qa.answer.match(/\b(?:also need|additionally|should also|we also|need to|require)\s+([^,.]+)/i);
    if (newReqMatch && newReqMatch[1]) {
      const feature = newReqMatch[1].trim();
      const featureLower = feature.toLowerCase();
      const isDuplicate = existingDescriptions.some((d) =>
        d.includes(featureLower.substring(0, Math.min(20, featureLower.length)))
      );
      if (!isDuplicate) {
        filtered.push({
          id: `interview-${qa.id}`,
          description: `Address interview need: ${feature}`,
          estimatedEffort: "1–3h",
          verificationMethod: `Requirement from interview "${qa.question}" is satisfied and verified.`,
        });
      }
    }
  }

  // Rule 4: Add research-driven steps for commonly needed items.
  for (const ri of research) {
    const existingDescriptions = filtered.map((s) => s.description.toLowerCase());
    const commonMatch = ri.summary.match(
      /\b(?:commonly needs|typically requires|usually requires|best practice is|standard pattern is)\s+([^,.]+)/i,
    );
    if (commonMatch && commonMatch[1]) {
      const item = commonMatch[1].trim();
      const itemLower = item.toLowerCase();
      const isDuplicate = existingDescriptions.some((d) =>
        d.includes(itemLower.substring(0, Math.min(20, itemLower.length)))
      );
      if (!isDuplicate) {
        filtered.push({
          id: `research-${ri.id}`,
          description: `Incorporate research finding: ${item}`,
          estimatedEffort: "1–2h",
          verificationMethod: `Findings from "${ri.query}" are implemented and validated.`,
        });
      }
    }
  }

  return filtered.length > 0 ? filtered : customized;
}

// ═══════════════════════════════════════════════
// Section 3 — DAG Construction
// ═══════════════════════════════════════════════

/**
 * Assign sequential dependencies to form a valid DAG.
 *
 * Every step after the first depends on its immediate predecessor. This
 * guarantees acyclicity and produces a simple, easy-to-follow execution order.
 *
 * @param steps - Steps to link (must already have ids).
 */
function assignDependsOn(steps: PlanStep[]): void {
  for (let i = 1; i < steps.length; i++) {
    const prev = steps[i - 1];
    const curr = steps[i];
    if (prev && curr) {
      curr.dependsOn = [prev.id];
    }
  }
}

// ═══════════════════════════════════════════════
// Section 4 — Assumption & Risk Identification
// ═══════════════════════════════════════════════

/**
 * Generate relevant assumptions based on seed context.
 *
 * Produces at least 3 assumptions covering:
 * - Tech stack and constraints compatibility
 * - Authentication requirements (if any)
 * - Deployment target suitability
 * - Testing approach
 * - Scale expectations
 *
 * @param seed - The user seed.
 * @param interviews - Completed interviews.
 * @param research - Research items.
 * @returns Array of assumption strings (minimum 3).
 */
function generateAssumptions(seed: Seed, interviews: InterviewQA[], research: ResearchItem[]): string[] {
  const assumptions: string[] = [];
  const goalLower = seed.goal.toLowerCase();

  const hasInterviewTopic = (topic: string): boolean =>
    interviews.some(
      (qa) =>
        qa.question.toLowerCase().includes(topic) ||
        (qa.answer?.toLowerCase().includes(topic) ?? false),
    );
  const hasResearchTopic = (topic: string): boolean =>
    research.some(
      (ri) => ri.query.toLowerCase().includes(topic) || ri.summary.toLowerCase().includes(topic),
    );

  // Assumption 1: Stack compatibility.
  if (seed.constraints.length > 0) {
    assumptions.push(
      `The chosen stack (${seed.constraints.join(", ")}) is compatible with the deployment target and team expertise.`,
    );
  } else {
    assumptions.push("No specific tech stack is mandated; the plan assumes widely adopted, stable technologies.");
  }

  // Assumption 2: Authentication.
  if (
    goalLower.includes("user") ||
    goalLower.includes("account") ||
    goalLower.includes("dashboard") ||
    goalLower.includes("admin")
  ) {
    if (!hasInterviewTopic("auth") && !hasInterviewTopic("login")) {
      assumptions.push(
        "Authentication and authorization requirements will be clarified before implementation; plan assumes standard OAuth or email/password.",
      );
    }
  } else {
    assumptions.push("No user authentication is required unless explicitly mentioned in later interviews.");
  }

  // Assumption 3: Deployment target.
  if (!hasInterviewTopic("deploy") && !hasInterviewTopic("host") && !hasResearchTopic("deploy")) {
    assumptions.push("Deployment target supports the chosen stack without proprietary lock-in.");
  }

  // Assumption 4: Testing approach.
  if (!hasInterviewTopic("test") && !hasInterviewTopic("testing")) {
    assumptions.push("Manual verification is sufficient for initial delivery; automated tests are a stretch goal.");
  }

  // Assumption 5: Scale expectations.
  if (!goalLower.includes("scale") && !goalLower.includes("million") && !goalLower.includes("high traffic")) {
    assumptions.push("Traffic and data volume are modest; horizontal scaling is out of scope for the initial plan.");
  }

  return assumptions;
}

/**
 * Generate relevant risks based on constraints and nonGoals.
 *
 * Produces at least 2 risks covering:
 * - Constraint rigidity limiting options
 * - Scope creep from vague or missing boundaries
 * - External integration fragility
 * - Timeline uncertainty
 * - Research-flagged instability
 *
 * @param seed - The user seed.
 * @param interviews - Completed interviews.
 * @param research - Research items.
 * @returns Array of risk strings (minimum 2).
 */
function generateRisks(seed: Seed, interviews: InterviewQA[], research: ResearchItem[]): string[] {
  const risks: string[] = [];
  const goalLower = seed.goal.toLowerCase();

  // Risk 1: Constraint-related.
  if (seed.constraints.length > 0) {
    const strict = seed.constraints.filter(
      (c) => c.toLowerCase().includes("must") || c.toLowerCase().includes("only"),
    );
    if (strict.length > 0) {
      risks.push(
        `Strict constraints (${strict.join("; ")}) may limit library choices or hosting options. Mitigation: validate constraint compatibility in the first step.`,
      );
    } else {
      risks.push(
        `Constraints (${seed.constraints.join("; ")}) could conflict with optimal solutions. Mitigation: document trade-offs early.`,
      );
    }
  }

  // Risk 2: Scope creep.
  if (!seed.nonGoals || seed.nonGoals.length === 0) {
    risks.push(
      "Missing nonGoals increases scope creep risk. Mitigation: define at least 3 out-of-scope items before implementation starts.",
    );
  } else {
    risks.push(
      "Explicit nonGoals are defined, but team must vigilantly reject additions that fall outside them. Mitigation: gate new requirements through a review step.",
    );
  }

  // Risk 3: External integration fragility.
  if (
    goalLower.includes("integrate") ||
    goalLower.includes("api") ||
    goalLower.includes("third-party") ||
    goalLower.includes("external")
  ) {
    risks.push(
      "External API or service integration may fail due to rate limits, breaking changes, or auth complexity. Mitigation: mock integrations during development; test against real service early.",
    );
  }

  // Risk 4: Timeline uncertainty.
  const hasEstimate = interviews.some(
    (qa) => qa.answer && /\b(hour|day|week|month)\b/i.test(qa.answer),
  );
  if (!hasEstimate) {
    risks.push(
      "No effort estimates were provided by the user. Mitigation: treat initial estimates as guesses and re-evaluate after the first milestone.",
    );
  }

  // Risk 5: Research-flagged instability.
  for (const ri of research) {
    if (/\b(breaking change|deprecated|unstable|buggy|alpha|beta|limited support)\b/i.test(ri.summary)) {
      risks.push(
        `Research on "${ri.query}" flagged potential instability. Mitigation: downgrade to stable LTS or isolate behind an abstraction layer.`,
      );
      break;
    }
  }

  return risks;
}

// ═══════════════════════════════════════════════
// Section 5 — Main Export
// ═══════════════════════════════════════════════

/**
 * Generate an initial Plan from a raw Seed, incorporating any interviews
 * and research gathered so far.
 *
 * Algorithm:
 * 1. Detect project type from goal keywords.
 * 2. Select a base template matching the type.
 * 3. Customize the template using constraints, nonGoals, interviews, and
 *    research findings.
 * 4. Assign dependencies to form a sequential DAG.
 * 5. Generate assumptions and risks.
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
  // 1. Detect project type.
  const type = detectProjectType(seed.goal);

  // 2. Select base template.
  const baseTemplate = getBaseTemplate(type);

  // 3. Convert to PlanStep with temporary ids.
  let steps: PlanStep[] = baseTemplate.map((partial, idx) => ({
    id: `step-${idx + 1}`,
    description: partial.description,
    estimatedEffort: partial.estimatedEffort,
    verificationMethod: partial.verificationMethod,
  }));

  // 4. Customize using constraints, nonGoals, interviews, research.
  steps = customizeSteps(steps, seed, interviews, research);

  // 5. Assign sequential dependencies (guaranteed DAG).
  assignDependsOn(steps);

  // 6. Generate assumptions and risks.
  const assumptions = generateAssumptions(seed, interviews, research);
  const risks = generateRisks(seed, interviews, research);

  // 7. Assemble plan.
  const plan: Plan = {
    id: `plan-${Date.now()}`,
    version: 1,
    goal: seed.goal,
    steps,
    assumptions,
    risks,
    interviews,
    research,
  };

  return Promise.resolve(plan);
}
