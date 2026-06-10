/**
 * SessionStart Hook
 *
 * Injected when a Kimi Code session starts or resumes.
 * Notifies the agent that maru-plan is available and should be used
 * for all planning tasks.
 */

import type { HookPayload, HookResponse } from './index.js';

export function handleSessionStart(_payload: HookPayload): HookResponse {
  return {
    additionalContext: `
[maru-plan] Ouroboros-grade planning mode is active.

When the user is planning, building, designing, or asking "how to" do something:
1. Run the 6-phase maru-plan loop: Planner → Evaluators → Gates → Interview → Research → Refiner
2. Use multi-persona consensus (Developer, PM, Security, UX) with hard threshold 0.75
3. Never skip evaluation or gates
4. Use AskUserQuestion for P0/P1 interview questions
5. Use WebSearch for technology validation
6. Repeat until consensus score >= 0.85 and all gates pass

If the user explicitly says "just do it" or "no planning needed", skip maru-plan.
`,
  };
}
