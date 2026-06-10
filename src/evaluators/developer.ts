import type { Plan, Seed, PersonaVerdict } from "../types.js";
import { evaluatePlan } from "../plan-evaluator.js";

const TIME_UNIT_PATTERN =
  /\b(\d+(?:\.\d+)?)\s*(min|minute|hour|h|day|d|week|wk|month|mo)\b/i;

function parseEffortToHours(text: string): number | undefined {
  const match = text.match(TIME_UNIT_PATTERN);
  if (!match) return undefined;
  const value = parseFloat(match[1]!);
  const unit = match[2]!.toLowerCase();
  if (unit.startsWith("min")) return value / 60;
  if (unit === "h" || unit.startsWith("hour")) return value;
  if (unit === "d" || unit.startsWith("day")) return value * 8;
  if (unit.startsWith("wk") || unit.startsWith("week")) return value * 40;
  if (unit.startsWith("mo") || unit.startsWith("month")) return value * 160;
  return undefined;
}

export function evaluateDeveloper(plan: Plan, seed: Seed): PersonaVerdict {
  const base = evaluatePlan(plan, seed);

  const score =
    (1 - base.ambiguity) * 0.15 +
    base.completeness * 0.40 +
    base.feasibility * 0.35 +
    base.goalAlignment * 0.10;

  const blockingIssues: string[] = [];

  const totalSteps = plan.steps.length;
  if (totalSteps > 0) {
    const missingVerify = plan.steps.filter(
      (s) => !s.verificationMethod || s.verificationMethod.trim().length === 0
    ).length;
    if (missingVerify / totalSteps > 0.5) {
      blockingIssues.push("Missing verificationMethod on >50% of steps");
    }
  }

  for (const step of plan.steps) {
    const effort = step.estimatedEffort?.trim();
    if (effort) {
      const hours = parseEffortToHours(effort);
      if (hours !== undefined && hours > 80) {
        blockingIssues.push(
          `Estimated effort exceeds 2 weeks for a single step: "${step.description}"`
        );
        break;
      }
    }
  }

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
      if (dfs(step.id)) {
        blockingIssues.push(
          "Dependency cycle detected — plan is not executable"
        );
        break;
      }
    }
  }

  let hasUnparseable = false;
  for (const step of plan.steps) {
    const effort = step.estimatedEffort?.trim();
    if (effort && parseEffortToHours(effort) === undefined) {
      hasUnparseable = true;
      break;
    }
  }
  if (hasUnparseable) {
    blockingIssues.push("Unparseable estimatedEffort on one or more steps");
  }

  const passed = score >= 0.75 && blockingIssues.length === 0;

  const parts: string[] = [];
  parts.push(
    `Developer lens — score ${score.toFixed(2)} (ambiguity ${base.ambiguity.toFixed(2)}, completeness ${base.completeness.toFixed(2)}, feasibility ${base.feasibility.toFixed(2)}, alignment ${base.goalAlignment.toFixed(2)}).`
  );
  if (blockingIssues.length > 0) {
    parts.push("Blocking issues:\n- " + blockingIssues.join("\n- "));
  } else {
    parts.push("No blocking issues from implementation perspective.");
  }
  if (base.completeness < 0.6) {
    parts.push(
      "Consider adding more implementation detail, dependencies, and effort estimates."
    );
  }
  if (base.feasibility < 0.6) {
    parts.push("Break down large steps and validate dependency graph.");
  }

  return {
    persona: "developer",
    passed,
    score: Math.round(score * 100) / 100,
    ambiguity: base.ambiguity,
    completeness: base.completeness,
    feasibility: base.feasibility,
    goalAlignment: base.goalAlignment,
    feedback: parts.join("\n\n"),
    blockingIssues,
  };
}
