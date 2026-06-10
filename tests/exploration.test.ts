import { test, expect } from "bun:test";
import {
  createBranch,
  pruneBranches,
  getBestBranch,
  detectStagnation,
  generateAlternatives,
} from "../src/exploration/index.ts";
import type { Plan, Seed } from "../src/types.ts";

function makePlan(partial: Partial<Plan> = {}): Plan {
  return {
    id: "plan-1",
    version: 1,
    goal: "build a thing",
    steps: [],
    assumptions: [],
    risks: [],
    interviews: [],
    research: [],
    ...partial,
  };
}

function makeSeed(partial: Partial<Seed> = {}): Seed {
  return {
    goal: "build a thing",
    constraints: [],
    ...partial,
  };
}

// ───────────────────────────────────────────────
// branch-manager
// ───────────────────────────────────────────────

test("createBranch returns a branch with given properties", () => {
  const plan = makePlan();
  const branch = createBranch(plan, "conservative", 0.75);
  expect(branch.plan).toBe(plan);
  expect(branch.strategy).toBe("conservative");
  expect(branch.score).toBe(0.75);
});

test("createBranch handles empty strategy and zero score", () => {
  const plan = makePlan();
  const branch = createBranch(plan, "", 0);
  expect(branch.strategy).toBe("");
  expect(branch.score).toBe(0);
});

test("pruneBranches filters branches below minScore", () => {
  const branches = [
    createBranch(makePlan(), "a", 0.9),
    createBranch(makePlan(), "b", 0.5),
    createBranch(makePlan(), "c", 0.7),
  ];
  const result = pruneBranches(branches, 0.7);
  expect(result.map((b) => b.strategy)).toEqual(["a", "c"]);
});

test("pruneBranches includes branches exactly at minScore", () => {
  const branches = [
    createBranch(makePlan(), "a", 0.7),
    createBranch(makePlan(), "b", 0.69),
  ];
  const result = pruneBranches(branches, 0.7);
  expect(result.map((b) => b.strategy)).toEqual(["a"]);
});

test("pruneBranches returns empty array when all branches are below minScore", () => {
  const branches = [
    createBranch(makePlan(), "a", 0.1),
    createBranch(makePlan(), "b", 0.2),
  ];
  expect(pruneBranches(branches, 0.5)).toEqual([]);
});

test("pruneBranches returns empty array for empty input", () => {
  expect(pruneBranches([], 0.5)).toEqual([]);
});

test("getBestBranch returns the branch with the highest score", () => {
  const branches = [
    createBranch(makePlan(), "low", 0.3),
    createBranch(makePlan(), "high", 0.9),
    createBranch(makePlan(), "mid", 0.6),
  ];
  const best = getBestBranch(branches);
  expect(best?.strategy).toBe("high");
  expect(best?.score).toBe(0.9);
});

test("getBestBranch returns undefined for empty array", () => {
  expect(getBestBranch([])).toBeUndefined();
});

test("getBestBranch returns the only branch for a single-element array", () => {
  const branches = [createBranch(makePlan(), "only", 0.5)];
  expect(getBestBranch(branches)?.strategy).toBe("only");
});

test("getBestBranch returns the first branch in a tie", () => {
  const branches = [
    createBranch(makePlan(), "first", 0.8),
    createBranch(makePlan(), "second", 0.8),
  ];
  const best = getBestBranch(branches);
  expect(best?.strategy).toBe("first");
});

// ───────────────────────────────────────────────
// lateral-thinker
// ───────────────────────────────────────────────

test("detectStagnation returns false for fewer than 3 scores", () => {
  expect(detectStagnation([])).toBe(false);
  expect(detectStagnation([0.5])).toBe(false);
  expect(detectStagnation([0.5, 0.6])).toBe(false);
});

test("detectStagnation returns true when last two deltas are below 0.05", () => {
  expect(detectStagnation([0.5, 0.52, 0.54])).toBe(true);
});

test("detectStagnation returns false when any delta is >= 0.05", () => {
  expect(detectStagnation([0.5, 0.55, 0.6])).toBe(false);
  expect(detectStagnation([0, 0, 0.1])).toBe(false);
});

test("detectStagnation returns false when delta is exactly 0.05", () => {
  expect(detectStagnation([0.5, 0.55, 0.6])).toBe(false);
});

test("detectStagnation considers only the last three scores", () => {
  // Early big jump, then stagnation
  expect(detectStagnation([0.1, 0.5, 0.51, 0.52])).toBe(true);
  // Early stagnation, then jump
  expect(detectStagnation([0.5, 0.51, 0.52, 0.6])).toBe(false);
});

test("detectStagnation handles negative and mixed deltas", () => {
  // Slight decline counts as stagnation (deltas < 0.05)
  expect(detectStagnation([0.6, 0.58, 0.56])).toBe(true);
  // Big decline also counts as stagnation because negative deltas are < 0.05
  expect(detectStagnation([0.6, 0.5, 0.4])).toBe(true);
  // Mixed: one small delta, one large positive delta → not stagnation
  expect(detectStagnation([0.6, 0.5, 0.7])).toBe(false);
});

test("generateAlternatives returns exactly three alternatives", () => {
  const seed = makeSeed({ goal: "launch a rocket" });
  const plan = makePlan();
  const alts = generateAlternatives(seed, plan);
  expect(alts).toHaveLength(3);
});

test("generateAlternatives includes seed goal in each alternative", () => {
  const goal = "launch a rocket";
  const seed = makeSeed({ goal });
  const plan = makePlan();
  const alts = generateAlternatives(seed, plan);
  expect(alts[0]).toContain(goal);
  expect(alts[1]).not.toContain(goal); // aggressive doesn't include goal text
  expect(alts[2]).not.toContain(goal); // lateral doesn't include goal text
});

test("generateAlternatives is deterministic", () => {
  const seed = makeSeed({ goal: "x" });
  const plan = makePlan();
  const a = generateAlternatives(seed, plan);
  const b = generateAlternatives(seed, plan);
  expect(a).toEqual(b);
});

test("generateAlternatives handles empty goal", () => {
  const seed = makeSeed({ goal: "" });
  const plan = makePlan();
  const alts = generateAlternatives(seed, plan);
  expect(alts).toHaveLength(3);
  expect(alts[0]).toContain('""');
});
