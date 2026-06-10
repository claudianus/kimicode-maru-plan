import type { Generation, Seed } from './types.js';
import { writeFileSync, mkdirSync, rmSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { execSync } from 'child_process';

export interface ExecutorOptions {
  cwd: string;
  /** If provided, writes changes to disk and runs tests. */
  applyChanges?: boolean;
  /** If set, writes changes to this path instead of cwd. */
  worktreePath?: string;
}

/**
 * Execute one generation.
 *
 * In a real implementation this would call Kimi Code (or another agent)
 * to produce code changes. For the scaffold we accept a mock function.
 */
export async function executeGeneration(
  seed: Seed,
  generationNumber: number,
  previousFeedback?: string,
  options?: ExecutorOptions
): Promise<Generation> {
  const generation: Generation = {
    id: `gen-${generationNumber}-${Date.now()}`,
    generationNumber,
    codeChanges: [],
  };

  // TODO: Replace with actual Kimi Code / LLM invocation.
  // Example:
  //   const prompt = buildPrompt(seed, previousFeedback);
  //   const response = await callKimiCode(prompt);
  //   generation.codeChanges = parseChanges(response);

  if (previousFeedback) {
    console.log(`[Executor] Generation ${generationNumber} received feedback: ${previousFeedback.slice(0, 80)}...`);
  }

  if (options?.applyChanges && generation.codeChanges.length > 0) {
    for (const change of generation.codeChanges) {
      const basePath = options.worktreePath ?? options.cwd;
      const fullPath = join(basePath, change.path);
      if (change.operation === 'delete') {
        if (existsSync(fullPath)) rmSync(fullPath);
      } else {
        mkdirSync(dirname(fullPath), { recursive: true });
        writeFileSync(fullPath, change.content, 'utf-8');
      }
    }
  }

  return generation;
}

export function runCommand(command: string, cwd: string): { stdout: string; stderr: string; exitCode: number; durationMs: number } {
  const start = Date.now();
  try {
    const stdout = execSync(command, { cwd, encoding: 'utf-8', stdio: 'pipe' });
    return { stdout, stderr: '', exitCode: 0, durationMs: Date.now() - start };
  } catch (err: any) {
    return {
      stdout: err.stdout?.toString() ?? '',
      stderr: err.stderr?.toString() ?? '',
      exitCode: err.status ?? 1,
      durationMs: Date.now() - start,
    };
  }
}
