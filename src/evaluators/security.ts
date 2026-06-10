import type { Plan, Seed, PersonaVerdict } from "../types.js";
import { evaluatePlan } from "../plan-evaluator.js";

export function evaluateSecurity(plan: Plan, seed: Seed): PersonaVerdict {
  const base = evaluatePlan(plan, seed);

  const score =
    (1 - base.ambiguity) * 0.10 +
    base.completeness * 0.30 +
    base.feasibility * 0.40 +
    base.goalAlignment * 0.20;

  const blockingIssues: string[] = [];

  if (seed.nonGoals && seed.nonGoals.length > 0) {
    const allPlanText = [plan.goal, ...plan.steps.map((s) => s.description)]
      .join(" ")
      .toLowerCase();
    for (const ng of seed.nonGoals) {
      const keywords = ng
        .toLowerCase()
        .split(/\W+/)
        .filter((w) => w.length > 2);
      if (keywords.length === 0) continue;
      const hit = keywords.some((k) => allPlanText.includes(k));
      if (hit) {
        blockingIssues.push(
          `Constraints violated by plan steps — nonGoal "${ng}" is addressed`
        );
      }
    }
  }

  const securityKeywords = [
    "security",
    "auth",
    "authentication",
    "authorization",
    "oauth",
    "gdpr",
    "soc2",
    "hipaa",
    "pci",
    "encryption",
    "ssl",
    "tls",
    "audit",
    "compliance",
  ];
  const hasSecurityConstraint = seed.constraints.some((c) =>
    securityKeywords.some((sk) => c.toLowerCase().includes(sk))
  );

  if (hasSecurityConstraint) {
    const descriptions = plan.steps.map((s) => s.description.toLowerCase()).join(" ");
    const covered = securityKeywords.some((sk) => descriptions.includes(sk));
    if (!covered) {
      blockingIssues.push("Security constraints not covered by any plan step");
    }
  }

  const allDescriptions = plan.steps.map((s) => s.description.toLowerCase()).join(" ");
  const hasSecurityStep =
    /\b(security|auth|audit|penetration test|vulnerability|compliance|gdpr|soc2|hipaa|pci)\b/.test(
      allDescriptions
    );
  if (!hasSecurityStep && hasSecurityConstraint) {
    blockingIssues.push(
      "No security/audit step found despite security-related constraints"
    );
  }

  const passed = score >= 0.75 && blockingIssues.length === 0;

  const parts: string[] = [];
  parts.push(
    `Security lens — score ${score.toFixed(2)} (ambiguity ${base.ambiguity.toFixed(2)}, completeness ${base.completeness.toFixed(2)}, feasibility ${base.feasibility.toFixed(2)}, alignment ${base.goalAlignment.toFixed(2)}).`
  );
  if (blockingIssues.length > 0) {
    parts.push("Blocking issues:\n- " + blockingIssues.join("\n- "));
  } else {
    parts.push("No blocking issues from security perspective.");
  }
  if (base.feasibility < 0.6) {
    parts.push(
      "Review feasibility — security controls must be realistically implementable."
    );
  }
  if (base.completeness < 0.6) {
    parts.push("Add security verification steps and constraint coverage.");
  }

  return {
    persona: "security",
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
