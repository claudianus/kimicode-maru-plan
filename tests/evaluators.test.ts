import { test, expect } from "bun:test";
import {
  evaluateAsDeveloper,
  evaluateAsPM,
  evaluateAsSecurity,
  evaluateAsUX,
  aggregateVerdicts,
} from "../src/evaluators/index.js";
import type { Plan, Seed, PlanVerdict, PersonaVerdict } from "../src/types.js";

// ─── Fixtures ─────────────────────────────────────────────────────────

function makeGoodSeed(): Seed {
  return {
    goal: "Build an Astro 4.x blog with Cloudflare Pages Tailwind CSS and MDX content including RSS feed and sitemap",
    constraints: ["Use Astro v4.2", "Deploy to Cloudflare Pages", "Use Tailwind CSS"],
    nonGoals: ["Mobile app", "User authentication system"],
    maxGenerations: 5,
  };
}

function makeGoodPlan(): Plan {
  return {
    id: "plan-1",
    version: 1,
    goal: "Build an Astro 4.x blog with Cloudflare Pages Tailwind CSS and MDX content including RSS feed and sitemap",
    steps: [
      {
        id: "s1",
        description: "Initialize Astro v4.2 project with TypeScript and configure base structure",
        dependsOn: [],
        estimatedEffort: "2h",
        verificationMethod: "astro build completes without errors",
      },
      {
        id: "s2",
        description: "Install and configure Tailwind CSS with Astro integration for styling",
        dependsOn: ["s1"],
        estimatedEffort: "1h",
        verificationMethod: "Tailwind classes render correctly in dev server",
      },
      {
        id: "s3",
        description: "Set up MDX content collection and create sample blog posts",
        dependsOn: ["s1"],
        estimatedEffort: "3h",
        verificationMethod: "MDX files compile and display in browser",
      },
      {
        id: "s4",
        description: "Implement RSS feed generation using Astro RSS package and run test",
        dependsOn: ["s3"],
        estimatedEffort: "1h",
        verificationMethod: "RSS endpoint returns valid XML feed",
      },
      {
        id: "s5",
        description: "Generate sitemap and deploy to Cloudflare Pages pipeline",
        dependsOn: ["s2", "s4"],
        estimatedEffort: "2h",
        verificationMethod: "Site live on Cloudflare with sitemap accessible",
      },
    ],
    assumptions: ["Developer has Node.js 20 installed", "Ensure WCAG 2.1 accessibility compliance"],
    risks: ["Astro v4.2 may have breaking changes from v4.1"],
    interviews: [],
    research: [],
  };
}

// ─── Developer Evaluator ──────────────────────────────────────────────

test("evaluateAsDeveloper: good plan passes with high score", () => {
  const verdict = evaluateAsDeveloper(makeGoodPlan(), makeGoodSeed());
  expect(verdict.persona).toBe("developer");
  expect(verdict.passed).toBe(true);
  expect(verdict.score).toBe(0.99);
  expect(verdict.blockingIssues).toHaveLength(0);
  expect(verdict.ambiguity).toBe(0);
  expect(verdict.completeness).toBe(1);
  expect(verdict.feasibility).toBe(1);
  expect(verdict.goalAlignment).toBe(0.85);
});

test("evaluateAsDeveloper: >50% missing verificationMethod is blocking", () => {
  const plan = makeGoodPlan();
  plan.steps[0].verificationMethod = "";
  plan.steps[1].verificationMethod = "  ";
  plan.steps[2].verificationMethod = undefined;
  // 3/5 missing = 60% > 50%
  const verdict = evaluateAsDeveloper(plan, makeGoodSeed());
  expect(verdict.passed).toBe(false);
  expect(verdict.blockingIssues).toContain(
    "Missing verificationMethod on >50% of steps",
  );
});

test("evaluateAsDeveloper: single step effort exceeding 80h is blocking", () => {
  const plan = makeGoodPlan();
  plan.steps[0].estimatedEffort = "3 month";
  const verdict = evaluateAsDeveloper(plan, makeGoodSeed());
  expect(verdict.passed).toBe(false);
  expect(verdict.blockingIssues.some((b) => b.includes("exceeds 2 weeks"))).toBe(
    true,
  );
});

test("evaluateAsDeveloper: dependency cycle is blocking", () => {
  const plan = makeGoodPlan();
  plan.steps[0].dependsOn = ["s2"];
  plan.steps[1].dependsOn = ["s1"];
  const verdict = evaluateAsDeveloper(plan, makeGoodSeed());
  expect(verdict.passed).toBe(false);
  expect(verdict.blockingIssues).toContain(
    "Dependency cycle detected — plan is not executable",
  );
});

test("evaluateAsDeveloper: self-loop is blocking", () => {
  const plan = makeGoodPlan();
  plan.steps[0].dependsOn = ["s1"];
  const verdict = evaluateAsDeveloper(plan, makeGoodSeed());
  expect(verdict.passed).toBe(false);
  expect(verdict.blockingIssues).toContain(
    "Dependency cycle detected — plan is not executable",
  );
});

test("evaluateAsDeveloper: unparseable estimatedEffort is blocking", () => {
  const plan = makeGoodPlan();
  plan.steps[0].estimatedEffort = "a while";
  const verdict = evaluateAsDeveloper(plan, makeGoodSeed());
  expect(verdict.passed).toBe(false);
  expect(verdict.blockingIssues).toContain(
    "Unparseable estimatedEffort on one or more steps",
  );
});

test("evaluateAsDeveloper: empty plan fails due to low score, no blocking issues", () => {
  const plan: Plan = {
    id: "plan-empty",
    version: 1,
    goal: "Build good website",
    steps: [],
    assumptions: [],
    risks: [],
    interviews: [],
    research: [],
  };
  const seed: Seed = { goal: "Build good website", constraints: [] };
  const verdict = evaluateAsDeveloper(plan, seed);
  expect(verdict.passed).toBe(false);
  expect(verdict.blockingIssues).toHaveLength(0);
  expect(verdict.score).toBeLessThan(0.75);
});

// ─── PM Evaluator ─────────────────────────────────────────────────────

test("evaluateAsPM: good plan passes with high score", () => {
  const verdict = evaluateAsPM(makeGoodPlan(), makeGoodSeed());
  expect(verdict.persona).toBe("pm");
  expect(verdict.passed).toBe(true);
  expect(verdict.score).toBe(0.94);
  expect(verdict.blockingIssues).toHaveLength(0);
});

test("evaluateAsPM: goal alignment below 0.7 is blocking", () => {
  const plan = makeGoodPlan();
  plan.goal = "Create a mobile application for iOS and Android platforms";
  const seed = makeGoodSeed();
  seed.constraints = ["Must support offline mode"]; // uncovered to push alignment lower
  const verdict = evaluateAsPM(plan, seed);
  expect(verdict.passed).toBe(false);
  expect(verdict.blockingIssues).toContain(
    "Goal misalignment > 0.3 — plan diverges from business objective",
  );
});

test("evaluateAsPM: >50% missing verificationMethod is blocking", () => {
  const plan = makeGoodPlan();
  for (const step of plan.steps) {
    step.verificationMethod = "";
  }
  const verdict = evaluateAsPM(plan, makeGoodSeed());
  expect(verdict.passed).toBe(false);
  expect(verdict.blockingIssues).toContain(
    "No clear success criteria — >50% of steps lack verificationMethod",
  );
});

test("evaluateAsPM: no steps is blocking", () => {
  const plan = makeGoodPlan();
  plan.steps = [];
  const verdict = evaluateAsPM(plan, makeGoodSeed());
  expect(verdict.passed).toBe(false);
  expect(verdict.blockingIssues).toContain(
    "No steps defined — cannot assess success criteria",
  );
});

test("evaluateAsPM: complex goal with fewer than 3 steps is blocking", () => {
  const plan = makeGoodPlan();
  plan.goal =
    "Build a comprehensive enterprise SaaS platform with real-time analytics and AI powered insights";
  plan.steps = [plan.steps[0], plan.steps[1]]; // 2 steps
  const seed: Seed = {
    goal: plan.goal,
    constraints: ["Use Astro v4.2"],
  };
  const verdict = evaluateAsPM(plan, seed);
  expect(verdict.passed).toBe(false);
  expect(verdict.blockingIssues).toContain(
    "Plan is under-specified for a complex goal — fewer than 3 steps",
  );
});

// ─── Security Evaluator ───────────────────────────────────────────────

test("evaluateAsSecurity: good plan without security constraints passes", () => {
  const verdict = evaluateAsSecurity(makeGoodPlan(), makeGoodSeed());
  expect(verdict.persona).toBe("security");
  expect(verdict.passed).toBe(true);
  expect(verdict.blockingIssues).toHaveLength(0);
});

test("evaluateAsSecurity: nonGoal violation is blocking", () => {
  const plan = makeGoodPlan();
  plan.goal = "Build a mobile app for iOS";
  const seed = makeGoodSeed();
  seed.nonGoals = ["mobile app"];
  const verdict = evaluateAsSecurity(plan, seed);
  expect(verdict.passed).toBe(false);
  expect(verdict.blockingIssues.some((b) => b.includes("nonGoal"))).toBe(true);
});

test("evaluateAsSecurity: uncovered security constraint is blocking", () => {
  const plan = makeGoodPlan();
  const seed = makeGoodSeed();
  seed.constraints = ["Must use OAuth 2.0 for authentication"];
  // plan steps have no security keywords at all
  const verdict = evaluateAsSecurity(plan, seed);
  expect(verdict.passed).toBe(false);
  expect(verdict.blockingIssues).toContain(
    "Security constraints not covered by any plan step",
  );
  expect(verdict.blockingIssues).toContain(
    "No security/audit step found despite security-related constraints",
  );
});

test("evaluateAsSecurity: missing security step despite covered constraint is blocking", () => {
  const plan = makeGoodPlan();
  const seed = makeGoodSeed();
  seed.constraints = ["Must use encryption for data at rest"];
  // "encryption" covers the constraint in the first check but is not in the security-step regex
  plan.steps[0].description =
    "Initialize Astro v4.2 project with TypeScript and encryption support";
  const verdict = evaluateAsSecurity(plan, seed);
  expect(verdict.passed).toBe(false);
  expect(verdict.blockingIssues).toContain(
    "No security/audit step found despite security-related constraints",
  );
  expect(verdict.blockingIssues).not.toContain(
    "Security constraints not covered by any plan step",
  );
});

// ─── UX Evaluator ─────────────────────────────────────────────────────

test("evaluateAsUX: good plan passes with high score", () => {
  const verdict = evaluateAsUX(makeGoodPlan(), makeGoodSeed());
  expect(verdict.persona).toBe("ux");
  expect(verdict.passed).toBe(true);
  expect(verdict.score).toBe(0.96);
  expect(verdict.blockingIssues).toHaveLength(0);
});

test("evaluateAsUX: all step descriptions > 20 words is blocking", () => {
  const plan = makeGoodPlan();
  for (const step of plan.steps) {
    step.description =
      "This is an extremely verbose and unnecessarily long step description that contains far too many words and will definitely exceed the twenty word threshold set by the UX evaluator for maximum clarity and end user accessibility comprehension";
  }
  const verdict = evaluateAsUX(plan, makeGoodSeed());
  expect(verdict.passed).toBe(false);
  expect(verdict.blockingIssues).toContain(
    "All step descriptions > 20 words — too verbose for end-user clarity",
  );
});

test("evaluateAsUX: missing accessibility consideration is blocking", () => {
  const plan = makeGoodPlan();
  plan.assumptions = ["Developer has Node.js 20 installed"];
  const verdict = evaluateAsUX(plan, makeGoodSeed());
  expect(verdict.passed).toBe(false);
  expect(verdict.blockingIssues).toContain(
    "No accessibility consideration found in plan",
  );
});

test("evaluateAsUX: >50% short step descriptions (< 4 words) is blocking", () => {
  const plan = makeGoodPlan();
  plan.steps = [
    {
      id: "s1",
      description: "Setup project",
      dependsOn: [],
      estimatedEffort: "2h",
      verificationMethod: "ok",
    },
    {
      id: "s2",
      description: "Add styles",
      dependsOn: [],
      estimatedEffort: "1h",
      verificationMethod: "ok",
    },
    {
      id: "s3",
      description: "Write content",
      dependsOn: [],
      estimatedEffort: "3h",
      verificationMethod: "ok",
    },
    {
      id: "s4",
      description:
        "This step has enough words to pass the short description threshold easily",
      dependsOn: [],
      estimatedEffort: "1h",
      verificationMethod: "ok",
    },
  ];
  plan.assumptions = [
    "Developer has Node.js 20 installed",
    "Ensure accessibility compliance",
  ];
  // 3/4 = 75% > 50% short
  const verdict = evaluateAsUX(plan, makeGoodSeed());
  expect(verdict.passed).toBe(false);
  expect(verdict.blockingIssues).toContain(
    ">50% of step descriptions are too short (< 4 words) — end users cannot understand intent",
  );
});

// ─── Aggregator ───────────────────────────────────────────────────────

test("aggregateVerdicts: all passing personas yields consensus pass", () => {
  const base: PlanVerdict = {
    passed: true,
    score: 0.9,
    ambiguity: 0.1,
    completeness: 0.95,
    feasibility: 0.9,
    goalAlignment: 0.95,
    feedback: "Good plan",
    missingQuestions: [],
    missingResearch: [],
  };
  const personas: PersonaVerdict[] = [
    {
      persona: "developer",
      passed: true,
      score: 0.9,
      ambiguity: 0.1,
      completeness: 0.95,
      feasibility: 0.9,
      goalAlignment: 0.95,
      feedback: "",
      blockingIssues: [],
    },
    {
      persona: "pm",
      passed: true,
      score: 0.85,
      ambiguity: 0.1,
      completeness: 0.95,
      feasibility: 0.9,
      goalAlignment: 0.95,
      feedback: "",
      blockingIssues: [],
    },
    {
      persona: "security",
      passed: true,
      score: 0.88,
      ambiguity: 0.1,
      completeness: 0.95,
      feasibility: 0.9,
      goalAlignment: 0.95,
      feedback: "",
      blockingIssues: [],
    },
    {
      persona: "ux",
      passed: true,
      score: 0.92,
      ambiguity: 0.1,
      completeness: 0.95,
      feasibility: 0.9,
      goalAlignment: 0.95,
      feedback: "",
      blockingIssues: [],
    },
  ];
  const consensus = aggregateVerdicts(personas, base);
  expect(consensus.passed).toBe(true);
  expect(consensus.score).toBe(0.89); // (0.9+0.85+0.88+0.92)/4 = 0.8875 -> 0.89
  expect(consensus.disagreements).toHaveLength(0);
  expect(consensus.personaVerdicts).toHaveLength(4);
  expect(consensus.consensusFeedback).toContain("Consensus score: 0.89");
});

test("aggregateVerdicts: one persona below threshold fails consensus", () => {
  const base: PlanVerdict = {
    passed: true,
    score: 0.9,
    ambiguity: 0.1,
    completeness: 0.95,
    feasibility: 0.9,
    goalAlignment: 0.95,
    feedback: "Good plan",
    missingQuestions: [],
    missingResearch: [],
  };
  const personas: PersonaVerdict[] = [
    {
      persona: "developer",
      passed: true,
      score: 0.9,
      ambiguity: 0.1,
      completeness: 0.95,
      feasibility: 0.9,
      goalAlignment: 0.95,
      feedback: "",
      blockingIssues: [],
    },
    {
      persona: "pm",
      passed: false,
      score: 0.6,
      ambiguity: 0.1,
      completeness: 0.95,
      feasibility: 0.9,
      goalAlignment: 0.95,
      feedback: "",
      blockingIssues: ["Bad alignment"],
    },
  ];
  const consensus = aggregateVerdicts(personas, base);
  expect(consensus.passed).toBe(false);
  expect(consensus.score).toBe(0.75); // (0.9+0.6)/2 = 0.75
});

test("aggregateVerdicts: detects disagreements when persona scores differ by >0.3", () => {
  const base: PlanVerdict = {
    passed: true,
    score: 0.9,
    ambiguity: 0.1,
    completeness: 0.95,
    feasibility: 0.9,
    goalAlignment: 0.95,
    feedback: "Good plan",
    missingQuestions: [],
    missingResearch: [],
  };
  const personas: PersonaVerdict[] = [
    {
      persona: "developer",
      passed: true,
      score: 0.95,
      ambiguity: 0.1,
      completeness: 0.95,
      feasibility: 0.9,
      goalAlignment: 0.95,
      feedback: "",
      blockingIssues: [],
    },
    {
      persona: "ux",
      passed: false,
      score: 0.5,
      ambiguity: 0.1,
      completeness: 0.95,
      feasibility: 0.9,
      goalAlignment: 0.95,
      feedback: "",
      blockingIssues: ["Verbose"],
    },
  ];
  const consensus = aggregateVerdicts(personas, base);
  expect(consensus.disagreements.length).toBeGreaterThan(0);
  for (const d of consensus.disagreements) {
    expect(d).toContain("developer");
    expect(d).toContain("ux");
  }
});

test("aggregateVerdicts: base verdict failure fails consensus regardless of personas", () => {
  const base: PlanVerdict = {
    passed: false,
    score: 0.5,
    ambiguity: 0.6,
    completeness: 0.5,
    feasibility: 0.5,
    goalAlignment: 0.5,
    feedback: "Bad plan",
    missingQuestions: [],
    missingResearch: [],
  };
  const personas: PersonaVerdict[] = [
    {
      persona: "developer",
      passed: true,
      score: 0.9,
      ambiguity: 0.1,
      completeness: 0.95,
      feasibility: 0.9,
      goalAlignment: 0.95,
      feedback: "",
      blockingIssues: [],
    },
  ];
  const consensus = aggregateVerdicts(personas, base);
  expect(consensus.passed).toBe(false);
});

test("aggregateVerdicts: empty persona array yields NaN score and base pass state", () => {
  const base: PlanVerdict = {
    passed: true,
    score: 0.9,
    ambiguity: 0.1,
    completeness: 0.95,
    feasibility: 0.9,
    goalAlignment: 0.95,
    feedback: "Good plan",
    missingQuestions: [],
    missingResearch: [],
  };
  const consensus = aggregateVerdicts([], base);
  expect(consensus.passed).toBe(true);
  expect(Number.isNaN(consensus.score)).toBe(true);
});
