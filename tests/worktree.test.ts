import { test, expect, describe, beforeEach, afterEach } from 'bun:test';
import { mkdtempSync, writeFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { execSync } from 'child_process';
import { createWorktree, removeWorktree } from '../src/worktree.js';

describe('worktree', () => {
  let repoDir: string;

  beforeEach(() => {
    repoDir = mkdtempSync(join(tmpdir(), 'kh-test-'));
    execSync('git init', { cwd: repoDir });
    execSync('git config user.email "test@kimi-harness.local"', { cwd: repoDir });
    execSync('git config user.name "Test"', { cwd: repoDir });
    writeFileSync(join(repoDir, 'README.md'), '# test');
    execSync('git add . && git commit -m "init"', { cwd: repoDir });
  });

  afterEach(() => {
    try {
      rmSync(repoDir, { recursive: true, force: true });
    } catch { /* ignore */ }
  });

  test('createWorktree creates an isolated worktree', () => {
    const name = `gen-${Date.now()}`;
    const wtPath = createWorktree(repoDir, name);
    expect(wtPath).toContain(name);
    const list = execSync('git worktree list', { cwd: repoDir, encoding: 'utf-8' });
    expect(list).toContain(name);
  });

  test('removeWorktree cleans up the worktree', () => {
    const name = `gen-${Date.now()}`;
    createWorktree(repoDir, name);
    removeWorktree(repoDir, name);
    const list = execSync('git worktree list', { cwd: repoDir, encoding: 'utf-8' });
    expect(list).not.toContain(name);
  });
});
