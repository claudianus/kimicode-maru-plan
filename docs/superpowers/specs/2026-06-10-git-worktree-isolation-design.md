# Git Worktree Isolation Per Generation — Design

## Goal
Ensure every generation applies code changes inside a temporary git worktree so the host working tree never gets polluted by untested or failed generations.

## Architecture
A new `src/worktree.ts` module wraps `git worktree add/remove`. The loop creates a worktree at the start of each generation, passes its path down to `executor` (for disk writes) and `evaluator` (for build/test commands), and unconditionally removes it after evaluation. This keeps the host repo clean and allows parallel generation experiments in the future.

## Components
- **worktree.ts** — `createWorktree(cwd, name)` and `removeWorktree(path)` using `git worktree` + `bun` `child_process`.
- **types.ts** — Extend `LoopOptions` with `useWorktree?: boolean` (default true).
- **executor.ts** — Accept an optional `worktreePath` in `ExecutorOptions`; write `CodeChange` files there instead of `cwd`.
- **evaluator.ts** — Accept an optional `worktreePath` in `EvaluatorOptions`; run mechanical commands inside it.
- **loop.ts** — Before each generation: `createWorktree`. After evaluation: `removeWorktree`. Cleanup runs even on exceptions.

## Error Handling
- If `createWorktree` fails (e.g., not a git repo), throw and abort the loop.
- If `removeWorktree` fails, log a warning but do not abort (the worktree may already be gone).
- Use `try/finally` in the loop to guarantee cleanup.

## Testing
- Unit test for `createWorktree` / `removeWorktree` in a temp git repo.
- Integration test verifying that `executeGeneration` with `worktreePath` writes to the worktree and leaves the original repo untouched.
