/**
 * Kimi Code Hook Router
 *
 * Reads JSON events from stdin, dispatches to the appropriate handler,
 * and writes JSON responses to stdout.
 *
 * Wire protocol: JSON stdin/stdout (same as Claude Code / Codex hooks)
 */

import { handleSessionStart } from './session-start.js';
import { handleUserPromptSubmit } from './user-prompt-submit.js';
import { handlePreToolUse } from './pre-tool-use.js';
import { handleStop } from './stop.js';

export interface HookPayload {
  event: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

export interface HookResponse {
  additionalContext?: string;
  updatedInput?: string;
  permissionDecision?: 'allow' | 'deny' | 'ask';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  process.stdin.on('data', (chunk) => chunks.push(chunk as Buffer));
  return new Promise((resolve) => {
    process.stdin.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
  });
}

async function main() {
  const raw = await readStdin();
  if (!raw.trim()) {
    console.log(JSON.stringify({}));
    return;
  }

  let payload: HookPayload;
  try {
    payload = JSON.parse(raw);
  } catch {
    console.log(JSON.stringify({}));
    return;
  }

  let response: HookResponse = {};

  switch (payload.event) {
    case 'SessionStart':
      response = handleSessionStart(payload);
      break;
    case 'UserPromptSubmit':
      response = handleUserPromptSubmit(payload);
      break;
    case 'PreToolUse':
      response = handlePreToolUse(payload);
      break;
    case 'Stop':
      response = await handleStop(payload);
      break;
    default:
      response = {};
  }

  console.log(JSON.stringify(response));
}

main().catch(() => {
  console.log(JSON.stringify({}));
});
