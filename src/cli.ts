#!/usr/bin/env bun
import { parseArgs } from 'util';
import { join, dirname } from 'path';
import { homedir } from 'os';
import { existsSync, mkdirSync, cpSync, rmSync } from 'fs';
import { parseSeed } from './parser.js';
import { runLoop } from './loop.js';
import type { Plan } from './types.js';
import { stringify } from 'yaml';

const SKILL_DIR = join(homedir(), '.kimi-code/skills/kimi-harness');
const PKG_ROOT = join(dirname(new URL(import.meta.url).pathname), '..');

const { values, positionals } = parseArgs({
  args: process.argv.slice(2),
  options: {
    cwd: { type: 'string', default: process.cwd() },
    'max-generations': { type: 'string' },
    help: { type: 'boolean', short: 'h' },
  },
  allowPositionals: true,
});

if (values.help) {
  console.log(`
🐍 kimi-harness — Enhanced Planning Mode for Kimi Code

Usage:
  kimi-harness setup                          Install skill into Kimi Code
  kimi-harness uninstall                      Remove skill from Kimi Code
  kimi-harness <seed.yaml> [options]          Run batch planning

Options:
  --cwd <path>           Working directory (default: current)
  --max-generations <n>  Override seed.maxGenerations
  -h, --help             Show this help

Examples:
  kimi-harness setup
  kimi-harness seed.yaml --cwd=./apps/web --max-generations=10
`);
  process.exit(0);
}

const command = positionals[0];

if (command === 'setup') {
  if (existsSync(SKILL_DIR)) {
    rmSync(SKILL_DIR, { recursive: true, force: true });
  }
  mkdirSync(SKILL_DIR, { recursive: true });

  cpSync(join(PKG_ROOT, 'SKILL.md'), join(SKILL_DIR, 'SKILL.md'));
  cpSync(join(PKG_ROOT, 'src'), join(SKILL_DIR, 'src'), { recursive: true });

  console.log(`✅ kimi-harness skill installed to ${SKILL_DIR}`);
  console.log(`   Kimi Code will now auto-activate Enhanced Planning Mode on planning triggers.`);
  process.exit(0);
}

if (command === 'uninstall') {
  if (existsSync(SKILL_DIR)) {
    rmSync(SKILL_DIR, { recursive: true, force: true });
    console.log(`✅ kimi-harness skill removed from ${SKILL_DIR}`);
  } else {
    console.log(`ℹ️  No skill found at ${SKILL_DIR}`);
  }
  process.exit(0);
}

const seedPath = command;
if (!seedPath) {
  console.error('Error: seed.yaml path required (or use "setup"/"uninstall")');
  console.error('Run with --help for usage');
  process.exit(1);
}

const seed = parseSeed(seedPath);
const plan: Plan = await runLoop(seed, {
  cwd: values.cwd!,
  maxGenerations: values['max-generations'] ? parseInt(values['max-generations']) : undefined,
});

const yamlOutput = stringify(plan, { sortMapEntries: true });
const planPath = join(values.cwd!, 'plan.yaml');
await Bun.write(planPath, yamlOutput);
console.log(`📄 Final plan written to ${planPath}`);
