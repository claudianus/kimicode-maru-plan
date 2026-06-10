import type { PlanVerdict, PersonaVerdict, ConsensusVerdict } from "../types.js";

export function aggregateVerdicts(
  personaVerdicts: PersonaVerdict[],
  baseVerdict: PlanVerdict
): ConsensusVerdict {
  const consensusScore =
    personaVerdicts.reduce((sum, pv) => sum + pv.score, 0) /
    personaVerdicts.length;

  const anyBelowThreshold = personaVerdicts.some((pv) => pv.score < 0.75);
  const passed = baseVerdict.passed && !anyBelowThreshold;

  const disagreements: string[] = [];
  for (let i = 0; i < personaVerdicts.length; i++) {
    for (let j = i + 1; j < personaVerdicts.length; j++) {
      const a = personaVerdicts[i]!;
      const b = personaVerdicts[j]!;
      const diff = Math.abs(a.score - b.score);
      if (diff > 0.3) {
        disagreements.push(
          `${a.persona} (${a.score.toFixed(2)}) vs ${b.persona} (${b.score.toFixed(2)}) — difference ${diff.toFixed(2)}`
        );
      }
    }
  }

  const parts: string[] = [];
  parts.push(`Consensus score: ${consensusScore.toFixed(2)}`);
  parts.push(
    `Base verdict: ${baseVerdict.passed ? "PASSED" : "FAILED"} (score ${baseVerdict.score.toFixed(2)})`
  );

  for (const pv of personaVerdicts) {
    parts.push(
      `[${pv.persona.toUpperCase()}] score=${pv.score.toFixed(2)} passed=${pv.passed}`
    );
    if (pv.blockingIssues.length > 0) {
      parts.push(`  Blockers: ${pv.blockingIssues.join("; ")}`);
    }
  }

  if (disagreements.length > 0) {
    parts.push(`Disagreements detected:\n- ${disagreements.join("\n- ")}`);
  } else {
    parts.push("No significant disagreements between personas.");
  }

  const consensusFeedback = parts.join("\n");

  return {
    ...baseVerdict,
    passed,
    score: Math.round(consensusScore * 100) / 100,
    personaVerdicts,
    consensusFeedback,
    disagreements,
  };
}
