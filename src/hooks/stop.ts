/**
 * Stop Hook
 *
 * Fires when the agent turn ends.
 * Records generation memory for meta-evolution tracking.
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import type { HookPayload, HookResponse } from './index.js';

const MEMORY_DIR = join(homedir(), '.kimi-code', 'maru-plan-memory');

export async function handleStop(_payload: HookPayload): Promise<HookResponse> {
  try {
    mkdirSync(MEMORY_DIR, { recursive: true });
    const timestamp = new Date().toISOString();
    const entry = {
      timestamp,
      event: 'turn-end',
      note: 'Kimi Code turn completed. maru-plan was active.',
    };
    const file = join(MEMORY_DIR, `memory-${Date.now()}.json`);
    writeFileSync(file, JSON.stringify(entry, null, 2));
  } catch {
    // Silent fail — hooks should never crash the host
  }

  return {};
}
