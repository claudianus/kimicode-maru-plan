import { execFileSync } from 'child_process';
import { join } from 'path';

function worktreePath(cwd: string, name: string): string {
  return join(cwd, '.kimi-harness-worktrees', name);
}

/**
 * Create a new Git worktree for isolated evolution.
 */
export function createWorktree(cwd: string, name: string): string {
  const path = worktreePath(cwd, name);
  execFileSync('git', ['worktree', 'add', path, '-b', name], { cwd, encoding: 'utf-8', stdio: 'pipe' });
  return path;
}

/**
 * Remove a previously created Git worktree (best-effort).
 */
export function removeWorktree(cwd: string, name: string): void {
  try {
    const path = worktreePath(cwd, name);
    execFileSync('git', ['worktree', 'remove', path, '--force'], { cwd, encoding: 'utf-8', stdio: 'pipe' });
  } catch {
    // Best-effort cleanup
  }
}
