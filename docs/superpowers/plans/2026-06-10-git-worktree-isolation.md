# Git Worktree Isolation Per Generation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Each generation writes and evaluates code inside a temporary git worktree, leaving the host repository untouched.

**Architecture:** A new `worktree.ts` module wraps `git worktree add/remove`. The loop creates a worktree per generation, passes its path to executor and evaluator, and unconditionally cleans it up afterward.

**Tech Stack:** Bun, TypeScript, git CLI, `bun:test`.

---

### Task 1: Extend LoopOptions in types.ts

**Files:**
- Modify: `src/types.ts`

- [ ] **Step 1: Add `useWorktree` to LoopOptions**

```typescript
export interface LoopOptions {
  cwd: string;
  maxGenerations?: number;
  stopOnPass?: boolean;
  /** If true (default), use a git worktree per generation. */
  useWorktree?: boolean;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/types.ts
git commit -m "feat: add useWorktree to LoopOptions"
```

---

### Task 2: Create worktree.ts module

**Files:**
- Create: `src/worktree.ts`

- [ ] **Step 1: Implement createWorktree and removeWorktree**

```typescript
import { execSync } from 'child_process';
import { existsSync } from 'fs';

export function createWorktree(cwd: string, name: string): string {
  const worktreePath = `${cwd}/.git/worktrees/${name}`;
  // Git worktree add expects the directory to not exist yet
  execSync(`git worktree add "${worktreePath}" -b "${name}"`, { cwd, encoding: 'utf-8', stdio: 'pipe' });
  return worktreePath;
}

export function removeWorktree(cwd: string, name: string): void {
  try {
    execSync(`git worktree remove "${name}" --force`, { cwd, encoding: 'utf-8', stdio: 'pipe' });
  } catch {
    // Best-effort cleanup
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/worktree.ts
git commit -m "feat: add worktree isolation helpers"
```

---

### Task 3: Unit test worktree.ts

**Files:**
- Create: `tests/worktree.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
import { test, expect, beforeAll, afterAll } from 'bun:test';
import { mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { execSync } from 'child_process';
import { createWorktree, removeWorktree } from '../src/worktree.js';

let repoDir: string;

beforeAll(() => {
  repoDir = mkdtempSync(join(tmpdir(), 'kh-test-'));
  execSync('git init', { cwd: repoDir });
  writeFileSync(join(repoDir, 'README.md'), '# test');
  execSync('git add . && git commit -m "init"', { cwd: repoDir });
});

afterAll(() => {
  try {
    execSync(`rm -rf "${repoDir}"`);
  } catch { /* ignore */ }
});

test('createWorktree creates an isolated worktree', () => {
  const wtPath = createWorktree(repoDir, 'gen-1');
  expect(wtPath).toContain('gen-1');
});

test('removeWorktree cleans up the worktree', () => {
  removeWorktree(repoDir, 'gen-1');
  const list = execSync('git worktree list', { cwd: repoDir, encoding: 'utf-8' });
  expect(list).not.toContain('gen-1');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test tests/worktree.test.ts`
Expected: FAIL because `worktree.ts` is not compiled / import path issues may surface.

- [ ] **Step 3: Fix any import/path issues and rerun**

Run: `bun test tests/worktree.test.ts`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add tests/worktree.test.ts
git commit -m "test: worktree isolation helpers"
```

---

### Task 4: Integrate worktree into executor.ts

**Files:**
- Modify: `src/executor.ts`

- [ ] **Step 1: Add `worktreePath` to ExecutorOptions**

```typescript
export interface ExecutorOptions {
  cwd: string;
  applyChanges?: boolean;
  /** If set, writes changes to this path instead of cwd. */
  worktreePath?: string;
}
```

- [ ] **Step 2: Use worktreePath when applying changes**

In `executeGeneration`, replace the existing `applyChanges` block with:

```typescript
  if (options?.applyChanges && generation.codeChanges.length > 0) {
    const basePath = options.worktreePath ?? options.cwd;
    for (const change of generation.codeChanges) {
      const fullPath = join(basePath, change.path);
      if (change.operation === 'delete') {
        if (existsSync(fullPath)) rmSync(fullPath);
      } else {
        mkdirSync(dirname(fullPath), { recursive: true });
        writeFileSync(fullPath, change.content, 'utf-8');
      }
    }
  }
```

- [ ] **Step 3: Commit**

```bash
git add src/executor.ts
git commit -m "feat: executor supports writing into a worktree"
```

---

### Task 5: Integrate worktree into evaluator.ts

**Files:**
- Modify: `src/evaluator.ts`

- [ ] **Step 1: Add `worktreePath` to EvaluatorOptions**

```typescript
export interface EvaluatorOptions {
  cwd: string;
  /** If set, run mechanical checks inside this path. */
  worktreePath?: string;
}
```

- [ ] **Step 2: Use worktreePath in evaluateMechanical**

In `evaluateMechanical`, change every `runCommand(..., options.cwd)` to:

```typescript
const targetCwd = options.worktreePath ?? options.cwd;
```

And pass `targetCwd` into `runCommand`.

- [ ] **Step 3: Commit**

```bash
git add src/evaluator.ts
git commit -m "feat: evaluator runs checks inside a worktree"
```

---

### Task 6: Wire worktree lifecycle into loop.ts

**Files:**
- Modify: `src/loop.ts`

- [ ] **Step 1: Import worktree helpers**

```typescript
import { createWorktree, removeWorktree } from './worktree.js';
```

- [ ] **Step 2: Update loop body**

Wrap the generation body in a try/finally and create/remove worktree when `useWorktree` is true (default true):

```typescript
  for (let i = 1; i <= maxGenerations; i++) {
    const useWorktree = options.useWorktree !== false;
    const worktreeName = `kimi-harness-gen-${i}-${Date.now()}`;
    let worktreePath: string | undefined;

    try {
      if (useWorktree) {
        worktreePath = createWorktree(options.cwd, worktreeName);
      }

      const generation = await executeGeneration(currentSeed, i, previousFeedback, {
        cwd: options.cwd,
        applyChanges: true,
        worktreePath,
      });

      const verdict = await evaluateGeneration(generation, currentSeed, { cwd: options.cwd, worktreePath });
      generation.verdict = verdict;
      lastVerdict = verdict;

      // ... existing logging ...

      if (verdict.passed) {
        console.log(`\n✅ All acceptance criteria passed at generation ${i}!`);
        return;
      }

      const evolution = evolveSeed(currentSeed, generation, verdict);
      currentSeed = evolution.updatedSeed;
      previousFeedback = evolution.prompt;
    } finally {
      if (worktreePath) {
        removeWorktree(options.cwd, worktreeName);
      }
    }
  }
```

- [ ] **Step 3: Commit**

```bash
git add src/loop.ts
git commit -m "feat: loop creates and cleans up a worktree per generation"
```

---

### Task 7: Export worktree from index.ts

**Files:**
- Modify: `src/index.ts`

- [ ] **Step 1: Add export**

```typescript
export * from './worktree.js';
```

- [ ] **Step 2: Commit**

```bash
git add src/index.ts
git commit -m "chore: export worktree module"
```

---

### Task 8: Verify type-check and tests

**Files:**
- All of the above

- [ ] **Step 1: Run type-check**

Run: `bun run type-check`
Expected: No errors.

- [ ] **Step 2: Run unit tests**

Run: `bun test`
Expected: worktree tests pass.

- [ ] **Step 3: Final commit**

```bash
git add .
git commit -m "feat: complete git worktree isolation per generation"
```
