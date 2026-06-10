import type { Seed, Plan, InterviewQA, PlanVerdict, PlanStep } from './types.js';

// ═══════════════════════════════════════════════════════════════════════════════
// INTERVIEWER — Comprehensive Question Generation Framework
// ═══════════════════════════════════════════════════════════════════════════════
//
// Role: Identifies ambiguities, missing constraints, vague steps, and missing
// effort estimates in the current plan, then generates clarifying questions.
//
// Where it fits in the loop:
//   plan → evaluate → **interview** → research → refine → repeat
//
// Design principles:
//   1. Every question must be actionable — vague questions produce vague answers.
//   2. Every question must have a clear reason — WHY we are asking.
//   3. Use concrete examples in comments so Kimi Code understands the threshold.
//   4. Score before asking — if ambiguity < 0.3, skip; if > 0.7, mandatory.
// ═══════════════════════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────────────────────
// Ambiguity Scoring Rubric (0.0 = crystal clear, 1.0 = completely vague)
// ─────────────────────────────────────────────────────────────────────────────
//
// | Score | Example Goal                                                  |
// |-------|---------------------------------------------------------------|
// | 0.0   | "Build Astro blog with Cloudflare Pages, Tailwind, MDX"       |
// | 0.2   | "Add OAuth2 GitHub login to existing Next.js 14 app"          |
// | 0.4   | "Refactor the auth module to use JWT instead of sessions"     |
// | 0.6   | "Improve website performance"                                 |
// | 0.8   | "Build a good website"                                        |
// | 1.0   | "Do something useful"                                         |
//
// Thresholds used in this module:
//   - CRITICAL (≥0.7):  Must ask a clarifying question. The plan cannot proceed.
//   - WARNING   (≥0.4):  Should ask if no mitigating context exists.
//   - MINOR     (≥0.2):  Ask only if time budget allows (optional).
//
// Kimi Code should treat these thresholds as guardrails, not hard rules.
// If the user has already provided extensive context, adjust downward.

// ─────────────────────────────────────────────────────────────────────────────
// Question Priority Levels
// ─────────────────────────────────────────────────────────────────────────────
//
// P0 — Blockers:  Missing goal, zero steps, no constraints on a complex task.
// P1 — Critical:  High ambiguity in goal or steps; missing verification methods.
// P2 — Important: Missing effort estimates, vague dependencies, missing risks.
// P3 — Polish:    Assumptions unchecked, context gaps, non-goals undefined.
//
// We generate questions in P0 → P3 order so the most important gaps are
// addressed first. The loop may not reach P3 if max generations is low.

type Priority = 'P0' | 'P1' | 'P2' | 'P3';

interface QuestionCandidate {
  priority: Priority;
  question: string;
  reason: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Interviewer module — defines the **interview** role in the planning harness.
 *
 * Role:
 * Identifies ambiguities, missing constraints, vague steps, and missing effort
 * estimates in the current plan, then generates clarifying questions for the user.
 *
 * How Kimi Code performs this role:
 * Kimi Code asks the user clarifying questions via `AskUserQuestion`.
 *
 * Where it fits in the loop:
 * Runs after evaluation (`plan-evaluator.ts`) and before research (`researcher.ts`).
 * The loop flow is: plan → evaluate → **interview** → research → refine → repeat.
 *
 * @param seed - The original user seed.
 * @param plan - The current plan iteration.
 * @param generationNumber - Current generation number for question IDs.
 * @param verdict - Optional plan verdict to include evaluator-identified questions.
 * @returns Array of InterviewQA items with ids like g1-q1, g1-q2.
 */
export function generateQuestions(
  seed: Seed,
  plan: Plan,
  generationNumber: number,
  verdict?: PlanVerdict,
): InterviewQA[] {
  const candidates: QuestionCandidate[] = [];

  // ── Phase 1: Gather candidates from all analysis dimensions ────────────────
  candidates.push(...analyzeGoal(seed, plan));
  candidates.push(...analyzeConstraints(seed, plan));
  candidates.push(...analyzeNonGoals(seed, plan));
  candidates.push(...analyzeContext(seed, plan));
  candidates.push(...analyzeSteps(seed, plan));
  candidates.push(...analyzeAssumptionsAndRisks(seed, plan));

  if (verdict) {
    candidates.push(...integrateVerdict(verdict));
  }

  // ── Phase 2: Sort by priority (P0 first) and deduplicate ───────────────────
  const sorted = sortByPriority(candidates);
  const deduped = deduplicateQuestions(sorted);

  // ── Phase 3: Assign stable IDs and convert to InterviewQA ──────────────────
  return deduped.map((c, idx) => ({
    id: `g${generationNumber}-q${idx + 1}`,
    question: c.question,
    reason: c.reason,
  }));
}

// ═══════════════════════════════════════════════════════════════════════════════
// ANALYSIS DIMENSIONS — One function per dimension
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Analyze the seed goal for ambiguity and specificity.
 *
 * WHY: The goal is immutable during evolution. If it is vague, every derived
 * plan will be vague. We must catch this early — ideally in generation 1.
 *
 * Checklist:
 *   [ ] Goal length — <30 chars is usually a headline, not a plan.
 *   [ ] Measurable outcomes — does it contain numbers, deadlines, or metrics?
 *   [ ] Tech stack specificity — are framework names, versions, or languages present?
 *   [ ] Action specificity — is the verb concrete ("refactor", "migrate") or vague ("improve", "make good")?
 *   [ ] Scope boundaries — does it hint at what's in vs out of scope?
 *
 * Scoring heuristic (Kimi Code should override with semantic judgment):
 *   - Start at 0.0.
 *   - +0.3 if goal <30 chars (too short for a complex project).
 *   - +0.2 if no measurable terms ("fast", "good", "better" without numbers).
 *   - +0.2 if no tech stack or platform mentioned AND the task is technical.
 *   - +0.1 if verb is vague ("improve", "optimize", "enhance", "do").
 *   - +0.2 if scope is open-ended ("website" vs "landing page with contact form").
 */
function analyzeGoal(seed: Seed, plan: Plan): QuestionCandidate[] {
  const out: QuestionCandidate[] = [];
  const goal = seed.goal.trim();

  // ── Check 1: Goal length ──────────────────────────────────────────────────
  // Threshold: <30 chars = headline, not a plan.
  // Example: "Build a good website" (22 chars) → needs elaboration.
  // Example: "Migrate Django 4.2 auth to OAuth2 with GitHub provider" (56 chars) → OK.
  if (goal.length < 30) {
    out.push({
      priority: 'P0',
      question:
        'The goal is quite short (' +
        goal.length +
        ' chars). Could you elaborate with specific outcomes, technologies, and boundaries? For example, instead of "Build a good website", try "Build an Astro blog with Cloudflare Pages, Tailwind, and MDX support"?',
      reason:
        'A short goal (<' +
        30 +
        ' chars) usually hides ambiguity. Every downstream plan step derives from the goal. If the goal is vague, the plan will be vague.',
    });
  }

  // ── Check 2: Measurable outcomes ──────────────────────────────────────────
  // Look for absence of numbers, dates, percentages, or concrete metrics.
  // Example without metrics: "Improve performance" → HOW much? By when?
  // Example with metrics: "Reduce LCP from 4.2s to under 1.5s by March 15".
  const hasMeasurable = /\d/.test(goal) || /\b(percent|percentage|fps|ms|seconds|minutes|hours|days|users|requests|reduction|increase|decrease|under|over|at least|at most)\b/i.test(goal);
  if (!hasMeasurable && goal.length >= 30) {
    out.push({
      priority: 'P1',
      question:
        'The goal does not mention any measurable outcome or deadline. What does "done" look like? For example, a specific load time, user count, feature list, or ship date?',
      reason:
        'Goals without measurable outcomes are impossible to verify. The evaluator cannot score completeness or feasibility without a definition of done.',
    });
  }

  // ── Check 3: Tech stack specificity ───────────────────────────────────────
  // For technical tasks, absence of framework/language names is a red flag.
  // Example vague: "Build an API" → which language? REST or GraphQL?
  // Example specific: "Build a Rust Axum REST API with OpenAPI docs".
  const techIndicators = /\b(next\.js|nuxt|astro|sveltekit|react|vue|angular|django|flask|rails|laravel|spring|express|fastapi|axum|actix|gin|fiber|graphql|rest|grpc|postgresql|mysql|mongo|redis|sqlite|prisma|drizzle|typeorm|tailwind|bootstrap|docker|kubernetes|aws|gcp|azure|cloudflare|vercel|netlify)\b/i;
  const hasTech = techIndicators.test(goal);
  const isLikelyTechnical = /\b(build|create|develop|implement|migrate|refactor|deploy|api|app|website|service|backend|frontend|database)\b/i.test(goal);
  if (isLikelyTechnical && !hasTech && goal.length > 15) {
    out.push({
      priority: 'P1',
      question:
        'The goal sounds technical but does not mention a tech stack. What languages, frameworks, platforms, or databases should be used? For example, "Next.js 14 with Prisma and PostgreSQL" or "Python FastAPI with Redis"?',
      reason:
        'Technical goals without stack specificity lead to incompatible plans. The planner may choose technologies the user does not want.',
    });
  }

  // ── Check 4: Vague action verbs ───────────────────────────────────────────
  // Verbs like "improve", "optimize", "enhance", "make", "do" are under-specified.
  // Example: "Improve the UI" → redesign? accessibility? performance? dark mode?
  // Example: "Migrate to TypeScript" → strict mode? incremental? full conversion?
  const vagueVerbs = /\b(improve|optimize|enhance|make better|do|handle|take care of|look into|consider|think about)\b/i;
  if (vagueVerbs.test(goal)) {
    const matched = goal.match(vagueVerbs)?.[0] ?? 'the action';
    out.push({
      priority: 'P1',
      question:
        'The goal uses the vague verb "' +
        matched +
        '" which can mean many things. What concrete action should be taken? For example, "refactor X into Y", "add Z feature", or "remove W dependency"?',
      reason:
        'Vague verbs create open-ended scope. The planner cannot generate specific steps from "improve" or "optimize" without knowing the intended mechanism.',
    });
  }

  // ── Check 5: Goal alignment drift ─────────────────────────────────────────
  // If the plan's goal diverges from the seed goal, that's a loop bug — but
  // we catch it here to ask the user for confirmation.
  if (plan.goal !== seed.goal) {
    out.push({
      priority: 'P0',
      question:
        'The current plan goal differs from the original seed goal. Seed: "' +
        seed.goal +
        '" vs Plan: "' +
        plan.goal +
        '". Was this intentional, or should the plan revert to the original goal?',
      reason:
        'Goal drift is a critical error. The seed.goal is immutable per harness rules. Any deviation must be explicitly confirmed by the user or treated as a bug.',
    });
  }

  return out;
}

/**
 * Analyze constraints for completeness, vagueness, and conflicts.
 *
 * WHY: Constraints are hard boundaries. Missing constraints cause scope creep.
 * Vague constraints are ignored during planning. Conflicting constraints make
 * the plan infeasible.
 *
 * Checklist:
 *   [ ] At least one constraint exists for non-trivial tasks.
 *   [ ] Each constraint is specific enough to enforce (not "be good").
 *   [ ] No two constraints directly contradict each other.
 *   [ ] Constraints mention time, budget, tech, or compliance if applicable.
 */
function analyzeConstraints(seed: Seed, plan: Plan): QuestionCandidate[] {
  const out: QuestionCandidate[] = [];
  const constraints = seed.constraints;

  // ── Check 1: Empty constraints on non-trivial goals ───────────────────────
  // A trivial goal is something like "Add a comma here" — no constraints needed.
  // Everything else should have at least one constraint (time, tech, budget, etc.).
  const isTrivial = seed.goal.length < 40 && /\b(fix typo|add comma|remove comment|rename variable)\b/i.test(seed.goal);
  if (constraints.length === 0 && !isTrivial) {
    out.push({
      priority: 'P0',
      question:
        'No constraints have been defined. Are there hard boundaries this plan must respect? Examples: "Must ship by Friday", "Cannot add new dependencies", "Must support IE11", "Budget is under $50/month"?',
      reason:
        'Constraints prevent scope creep and infeasible plans. A plan without constraints will grow until it hits an implicit boundary the user forgot to mention.',
    });
  }

  // ── Check 2: Vague constraints ────────────────────────────────────────────
  // A constraint like "be fast" or "use good practices" cannot be enforced.
  // Example bad: "High performance".
  // Example good: "API p95 latency <200ms at 1000 RPS".
  for (const constraint of constraints) {
    const trimmed = constraint.trim();
    const isVague =
      trimmed.length < 15 ||
      /\b(good|great|best|nice|fast|slow|cheap|expensive|better|worse|high quality|low quality)\b/i.test(trimmed);
    if (isVague) {
      out.push({
        priority: 'P1',
        question:
          'The constraint "' +
          trimmed +
          '" is vague. How would we verify it? Could you rephrase with a specific threshold or test? For example, instead of "be fast", use "page load <1.5s on 4G"?',
        reason:
          'Vague constraints are invisible to the planner. They provide no guardrails and cannot be checked during evaluation.',
      });
    }
  }

  // ── Check 3: Constraint conflicts (heuristic) ─────────────────────────────
  // Detect pairs that contradict each other. This is a shallow heuristic;
  // Kimi Code should do semantic conflict detection too.
  // Example conflict: "Must use zero dependencies" + "Must use Next.js".
  // Example conflict: "Must ship tomorrow" + "Must rewrite from scratch".
  const conflictPairs: Array<[RegExp, RegExp, string]> = [
    [/\bno (new )?dependencies\b/i, /\b(next\.js|react|vue|angular|django|rails|spring|express)\b/i, 'zero dependencies vs framework requirement'],
    [/\btomorrow|today|this week\b/i, /\brewrite|rebuild|from scratch|migrate\b/i, 'tight deadline vs large rewrite'],
    [/\bvanilla (js|javascript)\b/i, /\btypescript\b/i, 'vanilla JS vs TypeScript'],
  ];

  for (let i = 0; i < constraints.length; i++) {
    for (let j = i + 1; j < constraints.length; j++) {
      const ci = constraints[i]!;
      const cj = constraints[j]!;
      for (const [a, b, desc] of conflictPairs) {
        const aMatches = a.test(ci) && b.test(cj);
        const bMatches = b.test(ci) && a.test(cj);
        if (aMatches || bMatches) {
          out.push({
            priority: 'P0',
            question:
              'Constraints appear to conflict: "' +
              constraints[i] +
              '" and "' +
              constraints[j] +
              '" (' +
              desc +
              '). Which one takes priority, or is there a compromise?',
            reason:
              'Conflicting constraints make the plan infeasible. The planner cannot satisfy both simultaneously. The user must resolve the conflict before planning continues.',
          });
        }
      }
    }
  }

  // ── Check 4: Missing common constraint categories ─────────────────────────
  // For typical software projects, users often forget time, compliance, or infra.
  const categories = [
    { pattern: /\b(deadline|by |due |ship|launch|release|milestone|week|month|quarter|day)\b/i, name: 'time or deadline' },
    { pattern: /\b(budget|cost|\$|usd|eur|monthly|yearly|free)\b/i, name: 'budget or cost' },
    { pattern: /\b(gdpr|hipaa|soc2|iso|compliance|privacy|security audit|penetration test)\b/i, name: 'compliance or security' },
    { pattern: /\b(browser|chrome|firefox|safari|edge|ie11|mobile|ios|android|desktop)\b/i, name: 'platform or browser support' },
  ];

  const missingCategories = categories
    .filter((cat) => !constraints.some((c) => cat.pattern.test(c)))
    .map((cat) => cat.name);

  // Only ask about missing categories if the goal is substantial enough.
  const isSubstantial = seed.goal.length > 50 || plan.steps.length > 3;
  if (isSubstantial && missingCategories.length >= 3 && constraints.length > 0) {
    out.push({
      priority: 'P2',
      question:
        'The constraints do not mention ' +
        missingCategories.join(', ') +
        '. Are there any boundaries in these areas? Even a rough estimate (e.g., "ship by end of month") helps the planner sequence steps.',
      reason:
        'Common constraint categories are often overlooked but heavily influence plan feasibility and step ordering.',
    });
  }

  return out;
}

/**
 * Analyze non-goals (out-of-scope items) for boundary definition.
 *
 * WHY: Non-goals are the fence around the plan. Without them, scope creep is
 * inevitable. "We're NOT doing X" is as important as "We ARE doing Y".
 *
 * Checklist:
 *   [ ] Non-goals array exists (even if empty, its presence signals intent).
 *   [ ] Non-goals are specific, not "don't be bad".
 *   [ ] Non-goals cover likely expansion areas (e.g., "no mobile app yet").
 */
function analyzeNonGoals(seed: Seed, plan: Plan): QuestionCandidate[] {
  const out: QuestionCandidate[] = [];
  const nonGoals = seed.nonGoals ?? [];

  // ── Check 1: Missing non-goals on substantial plans ───────────────────────
  // If the plan has many steps, the scope is likely wide enough that some
  // things should be explicitly excluded.
  if (nonGoals.length === 0 && plan.steps.length > 2) {
    out.push({
      priority: 'P2',
      question:
        'No out-of-scope items (non-goals) have been defined. What should this plan explicitly NOT include? For example, "no mobile app yet", "no payment integration in v1", or "no migration of legacy data"?',
      reason:
        'Non-goals define boundaries. Without them, the planner and refiner may expand scope into areas the user intended to defer.',
    });
  }

  // ── Check 2: Vague non-goals ──────────────────────────────────────────────
  // A non-goal like "don't make it ugly" is not a boundary, it's a quality
  // statement. Boundaries are about features, platforms, or phases.
  for (const ng of nonGoals) {
    if (ng.length < 10 || /\b(bad|ugly|slow|poor|good|nice)\b/i.test(ng)) {
      out.push({
        priority: 'P2',
        question:
          'The non-goal "' +
          ng +
          '" is vague. Could you rephrase it as a specific feature or platform exclusion? For example, instead of "don\'t make it slow", use "no video processing in v1"?',
        reason:
          'Vague non-goals do not protect scope. They read as quality opinions rather than boundary definitions.',
      });
    }
  }

  return out;
}

/**
 * Analyze the seed context field for sufficiency.
 *
 * WHY: Context is the background knowledge the planner uses to avoid
 * asking questions the user already answered. Missing context forces the
 * loop to rediscover facts via interviews.
 *
 * Checklist:
 *   [ ] Context is provided for complex or brownfield tasks.
 *   [ ] Context mentions existing stack, prior decisions, or blockers.
 */
function analyzeContext(seed: Seed, plan: Plan): QuestionCandidate[] {
  const out: QuestionCandidate[] = [];
  const context = seed.context?.trim() ?? '';

  // ── Check 1: Missing context on brownfield or complex tasks ───────────────
  // Brownfield indicators: words like "existing", "current", "legacy", "refactor",
  // "migrate", "upgrade", "fix", "bug", "issue".
  const isBrownfield = /\b(existing|current|legacy|refactor|migrate|upgrade|fix|bug|issue|rewrite|convert|modernize)\b/i.test(seed.goal);
  const isComplex = plan.steps.length > 4 || seed.goal.length > 80;

  if (context.length === 0 && (isBrownfield || isComplex)) {
    out.push({
      priority: 'P1',
      question:
        'This appears to be a ' +
        (isBrownfield ? 'brownfield' : 'complex') +
        ' task, but no additional context was provided. What is the current state? For example: existing tech stack, prior decisions, known blockers, or relevant files/repos?',
      reason:
        'Brownfield tasks require knowledge of the current codebase. Without context, the planner may propose changes that conflict with existing architecture.',
    });
  }

  // ── Check 2: Context is too short to be useful ────────────────────────────
  // <20 chars is usually a placeholder or a single word.
  if (context.length > 0 && context.length < 20) {
    out.push({
      priority: 'P2',
      question:
        'The provided context is very short (' +
        context.length +
        ' chars). Could you expand with relevant background: current stack, prior attempts, constraints discovered mid-project, or links to docs?',
      reason:
        'Short context rarely contains actionable information. The planner needs enough detail to make informed decisions about step ordering and tech choices.',
    });
  }

  return out;
}

/**
 * Analyze plan steps for specificity, effort estimates, verification, and dependencies.
 *
 * WHY: Steps are the executable core of the plan. A plan with vague steps
 * cannot be executed. A plan without verification cannot be evaluated.
 *
 * Checklist:
 *   [ ] Every step has a description of at least ~15 meaningful chars.
 *   [ ] Every step has an estimatedEffort (even if rough like "~2h").
 *   [ ] Every step has a verificationMethod (even if "manual smoke test").
 *   [ ] Dependency graph is acyclic and makes sense.
 *   [ ] No orphan steps (steps depending on IDs that do not exist).
 *   [ ] Steps collectively cover the goal — no obvious gaps.
 */
function analyzeSteps(seed: Seed, plan: Plan): QuestionCandidate[] {
  const out: QuestionCandidate[] = [];
  const steps = plan.steps;

  // ── Check 1: Empty plan ───────────────────────────────────────────────────
  if (steps.length === 0) {
    out.push({
      priority: 'P0',
      question:
        'The plan has no steps yet. What are the first concrete actions you expect? For example, "Initialize Next.js project", "Set up CI on GitHub Actions", or "Write database schema"?',
      reason:
        'A plan without steps is not actionable. The loop cannot evaluate or refine an empty plan.',
    });
    return out; // Nothing else to check if there are no steps.
  }

  // ── Check 2: Vague step descriptions ──────────────────────────────────────
  // Threshold: <15 chars is usually a label, not a description.
  // Example bad: "Set up auth" (11 chars) → which auth? OAuth? Password? MFA?
  // Example good: "Implement GitHub OAuth2 login with NextAuth.js" (46 chars).
  const vagueSteps = steps.filter((s) => s.description.trim().length < 15);
  if (vagueSteps.length > 0) {
    const names = vagueSteps.map((s) => `"${s.description}"`).join(', ');
    out.push({
      priority: 'P1',
      question:
        'The following step(s) are too vague (' +
        vagueSteps.length +
        '): ' +
        names +
        '. Could you clarify what each involves? For example, add the technology, mechanism, or expected output.',
      reason:
        'Vague step descriptions make execution and verification impossible. A developer reading "Set up auth" cannot know whether to use OAuth, SAML, or password-based auth.',
    });
  }

  // ── Check 3: Missing effort estimates ─────────────────────────────────────
  // Even rough estimates ("~2h", "1 day", "half a sprint") help with scheduling.
  const missingEffort = steps.filter((s) => !s.estimatedEffort || s.estimatedEffort.trim().length === 0);
  if (missingEffort.length > 0) {
    out.push({
      priority: 'P1',
      question:
        missingEffort.length === steps.length
          ? 'All steps are missing effort estimates. Could you provide rough estimates (e.g., "2h", "1 day", "half a sprint") for each step?'
          : missingEffort.length +
            ' step(s) are missing effort estimates. Could you add rough estimates for those?',
      reason:
        'Effort estimates enable feasibility checks. If the total estimated effort exceeds the deadline constraint, the evaluator can flag the plan as infeasible early.',
    });
  }

  // ── Check 4: Missing verification methods ─────────────────────────────────
  // Without verification, we cannot know if a step is complete.
  // Example: "Implement login" → verify with: "Unit test + manual login on staging".
  const missingVerification = steps.filter((s) => !s.verificationMethod || s.verificationMethod.trim().length === 0);
  if (missingVerification.length > 0) {
    out.push({
      priority: 'P1',
      question:
        missingVerification.length === steps.length
          ? 'No steps have verification methods. How will you know each step is done? For example: "unit test passes", "PR reviewed", "manual smoke test on staging", "Lighthouse score >90"?'
          : missingVerification.length +
            ' step(s) lack verification methods. How will you know those steps are complete?',
      reason:
        'Verification methods define "done". Without them, the plan cannot be objectively evaluated, and scope creep occurs when steps are declared complete prematurely.',
    });
  }

  // ── Check 5: Invalid dependencies ─────────────────────────────────────────
  // Steps that depend on non-existent IDs are broken plans.
  const validIds = new Set(steps.map((s) => s.id));
  const invalidDeps = steps.filter((s) => s.dependsOn?.some((dep) => !validIds.has(dep)));
  if (invalidDeps.length > 0) {
    const stepNames = invalidDeps.map((s) => `"${s.description}"`).join(', ');
    out.push({
      priority: 'P0',
      question:
        'The following step(s) reference dependencies that do not exist in the plan: ' +
        stepNames +
        '. Please fix the dependency IDs or add the missing prerequisite steps.',
      reason:
        'Invalid dependencies break the plan graph. The scheduler cannot order steps if prerequisites are missing.',
    });
  }

  // ── Check 6: Dependency cycles (simple DFS) ───────────────────────────────
  // Cycles make the plan impossible to execute sequentially.
  if (hasCycle(steps)) {
    out.push({
      priority: 'P0',
      question:
        'The plan contains a dependency cycle (e.g., step A depends on B, and B depends on A). Please review the dependsOn fields and break the cycle.',
      reason:
        'Cyclic dependencies make the plan infeasible. No valid execution order exists for a cyclic graph.',
    });
  }

  // ── Check 7: Coverage gap heuristic ───────────────────────────────────────
  // If the goal mentions something but no step references it, that's a gap.
  // This is a shallow keyword match; Kimi Code should do semantic matching.
  const goalWords = seed.goal
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 4 && !STOP_WORDS.has(w));
  const stepText = steps.map((s) => s.description.toLowerCase()).join(' ');
  const uncovered = goalWords.filter((w) => !stepText.includes(w));
  // If many important words from the goal never appear in steps, ask.
  if (uncovered.length >= 3 && steps.length >= 2) {
    out.push({
      priority: 'P2',
      question:
        'The goal mentions concepts that do not appear in any step description: ' +
        uncovered.slice(0, 5).join(', ') +
        '. Are these covered implicitly, or are there missing steps?',
      reason:
        'Coverage gaps indicate the plan may be incomplete. The goal mentions work that no step seems to address.',
    });
  }

  // ── Check 8: Sequential fallback pattern ──────────────────────────────────
  // If every step depends only on the previous step, the plan is just a list.
  // That may be fine, but for parallelizable work it suggests the planner
  // did not think about concurrency.
  const sequential = isSequential(steps);
  if (steps.length > 4 && sequential) {
    out.push({
      priority: 'P3',
      question:
        'All steps appear to be strictly sequential. Are there any steps that could run in parallel? For example, "design mockups" and "set up CI" can often happen simultaneously.',
      reason:
        'Overly sequential plans may underutilize time. Identifying parallelizable work can significantly reduce total project duration.',
    });
  }

  return out;
}

/**
 * Analyze assumptions and risks for explicitness.
 *
 * WHY: Assumptions are silent requirements. When they break, the plan fails.
 * Risks are early warnings. Documenting them upfront lets the evaluator score
 * feasibility more accurately.
 *
 * Checklist:
 *   [ ] The plan lists at least one assumption for non-trivial work.
 *   [ ] The plan lists at least one risk for non-trivial work.
 *   [ ] Assumptions are stated as testable facts, not wishes.
 *   [ ] Risks include a mitigation or at least a detection method.
 */
function analyzeAssumptionsAndRisks(seed: Seed, plan: Plan): QuestionCandidate[] {
  const out: QuestionCandidate[] = [];

  const isTrivial = seed.goal.length < 40 && plan.steps.length <= 2;
  if (isTrivial) return out;

  // ── Check 1: Missing assumptions ──────────────────────────────────────────
  // Example assumption: "API keys for Stripe are already configured".
  // Example bad assumption: "Everything will go well" (not testable).
  if (plan.assumptions.length === 0) {
    out.push({
      priority: 'P2',
      question:
        'No assumptions have been documented. What are you taking for granted? For example: "User already has AWS account", "Database schema v3 is deployed", "Design mockups are approved"?',
      reason:
        'Assumptions are preconditions. If they fail, the plan must change. Documenting them lets the loop detect shifts in feasibility early.',
    });
  } else {
    // Check for wishful assumptions.
    for (const assumption of plan.assumptions) {
      if (/\b(everything|all|always|never|will go well|assume best|perfect)\b/i.test(assumption)) {
        out.push({
          priority: 'P2',
          question:
            'The assumption "' +
            assumption +
            '" sounds optimistic. Could you rephrase it as a verifiable fact? For example, instead of "Assume everything works", use "Assume Node.js 20 is installed and network is reachable"?',
          reason:
            'Wishful assumptions provide no value. Testable assumptions can be verified before execution begins.',
        });
      }
    }
  }

  // ── Check 2: Missing risks ────────────────────────────────────────────────
  // Example risk: "Third-party API rate limits may block bulk import".
  // Example mitigation: "Add exponential backoff and batching".
  if (plan.risks.length === 0) {
    out.push({
      priority: 'P2',
      question:
        'No risks have been identified. What could go wrong? For example: "API rate limits", "dependency incompatible with Node 20", "design approval delayed", "key person unavailable"?',
      reason:
        'Risk-aware planning is more robust. The evaluator scores feasibility higher when risks are acknowledged and mitigated.',
    });
  }

  return out;
}

/**
 * Integrate evaluator-identified questions into the candidate pool.
 *
 * WHY: The evaluator may detect semantic gaps that the rule-based checks above
 * miss (e.g., "This plan contradicts the user's stated preference for React").
 * We treat evaluator questions as P1 by default because they come from
 * semantic analysis rather than shallow heuristics.
 */
function integrateVerdict(verdict: PlanVerdict): QuestionCandidate[] {
  const out: QuestionCandidate[] = [];

  if (verdict.missingQuestions.length > 0) {
    for (const mq of verdict.missingQuestions) {
      out.push({
        priority: 'P1',
        question: mq,
        reason:
          'Identified by plan-evaluator (semantic analysis). Evaluator questions often catch subtleties that heuristic checks miss.',
      });
    }
  }

  // If the evaluator flags high ambiguity, add a meta-question.
  if (verdict.ambiguity > 0.7) {
    out.push({
      priority: 'P0',
      question:
        'The evaluator scored this plan as highly ambiguous (' +
        verdict.ambiguity.toFixed(2) +
        ' / 1.0). Which part of the goal or plan is unclear to you?',
      reason:
        'High ambiguity scores (>0.7) from the evaluator indicate the planner failed to interpret the user intent. We must ask the user to clarify before the loop wastes generations.',
    });
  }

  // If completeness is low, ask about missing pieces.
  if (verdict.completeness < 0.4) {
    out.push({
      priority: 'P0',
      question:
        'The evaluator scored completeness as low (' +
        verdict.completeness.toFixed(2) +
        ' / 1.0). What major pieces of work are missing from the plan?',
      reason:
        'Low completeness (<0.4) means critical work is absent. The user likely knows what is missing even if the planner does not.',
    });
  }

  return out;
}

// ═══════════════════════════════════════════════════════════════════════════════
// UTILITY FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Detect cycles in a step dependency graph using DFS.
 *
 * WHY: Cyclic dependencies make topological sorting impossible. The plan
 * cannot be executed in any order. This is a hard blocker.
 *
 * Algorithm: For each unvisited node, run DFS. If we revisit a node in the
 * current recursion stack, a cycle exists.
 */
function hasCycle(steps: PlanStep[]): boolean {
  const adj = new Map<string, string[]>();
  for (const s of steps) {
    adj.set(s.id, s.dependsOn ?? []);
  }

  const visited = new Set<string>();
  const stack = new Set<string>();

  function dfs(node: string): boolean {
    visited.add(node);
    stack.add(node);
    for (const neighbor of adj.get(node) ?? []) {
      if (!visited.has(neighbor)) {
        if (dfs(neighbor)) return true;
      } else if (stack.has(neighbor)) {
        return true;
      }
    }
    stack.delete(node);
    return false;
  }

  for (const s of steps) {
    if (!visited.has(s.id)) {
      if (dfs(s.id)) return true;
    }
  }
  return false;
}

/**
 * Check if every step depends only on the immediately preceding step,
 * forming a simple linear chain.
 *
 * WHY: A purely sequential plan may be under-optimized. If work can be
 * parallelized, total duration shrinks. We only flag this as a suggestion,
 * never a blocker — some work genuinely is linear.
 */
function isSequential(steps: PlanStep[]): boolean {
  if (steps.length < 2) return false;
  // Build a quick index of id -> index for O(1) lookups.
  const indexById = new Map(steps.map((s, i) => [s.id, i]));

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i]!;
    const deps = step.dependsOn ?? [];
    if (deps.length === 0 && i > 0) {
      // A non-first step with no deps could be parallel — not strictly sequential.
      return false;
    }
    if (deps.length > 1) return false; // Branching means not strictly sequential.
    if (deps.length === 1) {
      const depId = deps[0]!;
      const depIdx = indexById.get(depId);
      if (depIdx !== i - 1) return false; // Depends on something other than previous step.
    }
  }
  return true;
}

/**
 * Sort question candidates by priority.
 *
 * Order: P0 < P1 < P2 < P3 (P0 first).
 */
function sortByPriority(candidates: QuestionCandidate[]): QuestionCandidate[] {
  const order: Record<Priority, number> = { P0: 0, P1: 1, P2: 2, P3: 3 };
  return [...candidates].sort((a, b) => order[a.priority] - order[b.priority]);
}

/**
 * Deduplicate questions by normalized question text.
 *
 * WHY: Multiple heuristics may generate the same question (e.g., both the
 * goal analyzer and the verdict integrator flag ambiguity). Asking twice
 * wastes the user's time and a loop generation.
 *
 * Normalization: lower-case, remove extra whitespace, strip trailing punctuation.
 */
function deduplicateQuestions(candidates: QuestionCandidate[]): QuestionCandidate[] {
  const seen = new Set<string>();
  const out: QuestionCandidate[] = [];

  for (const c of candidates) {
    const key = c.question
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .replace(/[?.!]+$/g, '')
      .trim();
    if (!seen.has(key)) {
      seen.add(key);
      out.push(c);
    }
  }
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// Stop words for coverage-gap heuristic
// ─────────────────────────────────────────────────────────────────────────────
const STOP_WORDS = new Set([
  'build',
  'create',
  'develop',
  'implement',
  'using',
  'with',
  'from',
  'into',
  'that',
  'this',
  'will',
  'should',
  'would',
  'could',
  'about',
  'after',
  'before',
  'during',
  'through',
  'between',
  'under',
  'over',
  'above',
  'below',
  'within',
  'without',
  'against',
  'among',
  'around',
  'because',
  'since',
  'until',
  'while',
]);
