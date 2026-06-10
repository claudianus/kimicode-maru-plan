import type { Plan, Seed, PersonaVerdict } from "../types.js";
import { evaluatePlan } from "../plan-evaluator.js";

export function evaluatePm(plan: Plan, seed: Seed): PersonaVerdict {
  const base = evaluatePlan(plan, seed);

  const score =
    (1 - base.ambiguity) * 0.30 +
    base.completeness * 0.20 +
    base.feasibility * 0.10 +
    base.goalAlignment * 0.40;

  const blockingIssues: string[] = [];

  if (base.goalAlignment < 0.7) {
    blockingIssues.push(
      "Goal misalignment > 0.3 — plan diverges from business objective"
    );
  }

  const totalSteps = plan.steps.length;
  if (totalSteps > 0) {
    const missingVerify = plan.steps.filter(
      (s) => !s.verificationMethod || s.verificationMethod.trim().length === 0
    ).length;
    if (missingVerify / totalSteps > 0.5) {
      blockingIssues.push(
        "No clear success criteria — >50% of steps lack verificationMethod"
      );
    }
  } else {
    blockingIssues.push("No steps defined — cannot assess success criteria");
  }

  const goalWords = plan.goal.trim().split(/\s+/).length;
  if (goalWords > 10 && plan.steps.length < 3) {
    blockingIssues.push(
      "Plan is under-specified for a complex goal — fewer than 3 steps"
    );
  }

  const passed = score >= 0.75 && blockingIssues.length === 0;

  const parts: string[] = [];
  parts.push(
    `PM lens — score ${score.toFixed(2)} (ambiguity ${base.ambiguity.toFixed(2)}, completeness ${base.completeness.toFixed(2)}, feasibility ${base.feasibility.toFixed(2)}, alignment ${base.goalAlignment.toFixed(2)}).`
  );
  if (blockingIssues.length > 0) {
    parts.push("Blocking issues:\n- " + blockingIssues.join("\n- "));
  } else {
    parts.push("No blocking issues from product management perspective.");
  }
  if (base.goalAlignment < 0.8) {
    parts.push(
      "Re-align plan steps with the core business goal and seed constraints."
    );
  }
  if (base.ambiguity > 0.4) {
    parts.push(
      "Reduce ambiguity so stakeholders can understand scope and outcomes."
    );
  }

  return {
    persona: "pm",
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
