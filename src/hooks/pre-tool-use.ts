/**
 * PreToolUse Hook
 *
 * Runs before a tool is executed. Can block or modify the tool call.
 * Light-weight gate check for plan-mode tool sequences.
 */

import type { HookPayload, HookResponse } from './index.js';

export function handlePreToolUse(payload: HookPayload): HookResponse {
  const toolName = payload.tool?.name || payload.name || '';
  const args = payload.tool?.args || payload.args || {};

  // Gate: Prevent destructive operations during plan mode without explicit user confirmation
  if (toolName === 'Bash' || toolName === 'Shell') {
    const command = (args.command || args.cmd || '').toString().toLowerCase();
    const dangerous = [
      'rm -rf',
      'rm -r /',
      'dd if=',
      ':(){ :|:& };:',
      '> /dev/null',
    ];
    if (dangerous.some((d) => command.includes(d))) {
      return {
        permissionDecision: 'deny',
        additionalContext: '[maru-plan] Blocked dangerous command during planning phase. Confirm with user before destructive operations.',
      };
    }
  }

  return {};
}
