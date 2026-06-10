import type { Plan, Seed, PersonaVerdict } from "../types.js";
import { evaluatePlan } from "../plan-evaluator.js";

export function evaluateUx(plan: Plan, seed: Seed): PersonaVerdict {
  const base = evaluatePlan(plan, seed);

  const score =
    (1 - base.ambiguity) * 0.40 +
    base.completeness * 0.20 +
    base.feasibility * 0.10 +
    base.goalAlignment * 0.30;

  const blockingIssues: string[] = [];

  if (plan.steps.length > 0) {
    const allVerbose = plan.steps.every(
      (s) => s.description.trim().split(/\s+/).length > 20
    );
    if (allVerbose) {
      blockingIssues.push(
        "All step descriptions > 20 words — too verbose for end-user clarity"
      );
    }
  }

  const allText = [
    plan.goal,
    ...plan.steps.map((s) => s.description),
    ...plan.assumptions,
  ]
    .join(" ")
    .toLowerCase();
  const a11yKeywords = [
    "accessibility",
    "a11y",
    "wcag",
    "screen reader",
    "aria",
    "usable",
    "user experience",
    "ux",
  ];
  const hasA11y = a11yKeywords.some((k) => allText.includes(k));
  if (!hasA11y) {
    blockingIssues.push("No accessibility consideration found in plan");
  }

  if (plan.steps.length > 0) {
    const shortSteps = plan.steps.filter(
      (s) => s.description.trim().split(/\s+/).length < 4
    ).length;
    if (shortSteps / plan.steps.length > 0.5) {
      blockingIssues.push(
        ">50% of step descriptions are too short (< 4 words) — end users cannot understand intent"
      );
    }
  }

  const passed = score >= 0.75 && blockingIssues.length === 0;

  const parts: string[] = [];
  parts.push(
    `UX lens — score ${score.toFixed(2)} (ambiguity ${base.ambiguity.toFixed(2)}, completeness ${base.completeness.toFixed(2)}, feasibility ${base.feasibility.toFixed(2)}, alignment ${base.goalAlignment.toFixed(2)}).`
  );
  if (blockingIssues.length > 0) {
    parts.push("Blocking issues:\n- " + blockingIssues.join("\n- "));
  } else {
    parts.push("No blocking issues from UX perspective.");
  }
  if (base.ambiguity > 0.4) {
    parts.push(
      "Reduce ambiguity — users need clear, concrete descriptions of what will be built."
    );
  }
  if (base.goalAlignment < 0.8) {
    parts.push("Ensure plan deliverables align with user-facing goals.");
  }

  return {
    persona: "ux",
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
