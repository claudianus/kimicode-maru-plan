import { execSync } from 'child_process';
import { join } from 'path';

export function createWorktree(cwd: string, name: string): string {
  const worktreePath = join(cwd, '.kimi-harness-worktrees', name);
  execSync(`git worktree add "${worktreePath}" -b "${name}"`, { cwd, encoding: 'utf-8', stdio: 'pipe' });
  return worktreePath;
}

export function removeWorktree(cwd: string, name: string): void {
  try {
    const worktreePath = join(cwd, '.kimi-harness-worktrees', name);
    execSync(`git worktree remove "${worktreePath}" --force`, { cwd, encoding: 'utf-8', stdio: 'pipe' });
  } catch {
    // Best-effort cleanup
  }
}
