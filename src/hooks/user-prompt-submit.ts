/**
 * UserPromptSubmit Hook
 *
 * Detects planning intent in the user's prompt and injects maru-plan
 * workflow instructions via additionalContext.
 *
 * Kimi Code sends the prompt as ContentPart[]; we normalize to string.
 */

import type { HookPayload, HookResponse } from './index.js';

const PLANNING_TRIGGERS = [
  'plan', 'planning', 'how to', 'how should i', 'what\'s the best way to',
  'build', 'create', 'make', 'design', 'architect',
  'i want to build', 'i want to create', 'i want to make', 'let\'s build',
  'roadmap', 'timeline', 'execution strategy', 'project plan',
];

function normalizePrompt(payload: HookPayload): string {
  if (typeof payload.prompt === 'string') {
    return payload.prompt.toLowerCase();
  }
  if (Array.isArray(payload.prompt)) {
    return payload.prompt
      .map((p: unknown) => (typeof p === 'string' ? p : (p as { text?: string }).text || ''))
      .join(' ')
      .toLowerCase();
  }
  if (payload.content && typeof payload.content === 'string') {
    return payload.content.toLowerCase();
  }
  return '';
}

function hasPlanningIntent(prompt: string): boolean {
  return PLANNING_TRIGGERS.some((t) => prompt.includes(t));
}

export function handleUserPromptSubmit(payload: HookPayload): HookResponse {
  const prompt = normalizePrompt(payload);

  if (!hasPlanningIntent(prompt)) {
    return {};
  }

  return {
    additionalContext: `
[maru-plan] Planning intent detected. Activating 6-phase loop.

Phase 1 — PLANNER: Synthesize concrete Plan from goal + constraints + nonGoals.
Phase 2 — EVALUATORS: Run 4 personas (Developer, PM, Security, UX) in parallel.
  Hard rule: any persona < 0.75 = FAIL.
Phase 3 — GATES: Validate structure (>=3 steps, >=1 assumption, >=1 risk, no drift).
Phase 4 — INTERVIEW: AskUserQuestion for P0/P1 gaps. Memory-aware (avoid repeats).
Phase 5 — RESEARCH: WebSearch for best practices and compatibility.
Phase 6 — REFINER: Improve weakest dimension. Meta-evolution every 3rd gen.
  If stagnation (improvement < 0.05 for 3 gens): lateral thinking with 3 alternatives.

Loop until: consensus >= 0.85 AND all personas >= 0.75 AND all gates pass.
`,
  };
}
