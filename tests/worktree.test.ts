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
