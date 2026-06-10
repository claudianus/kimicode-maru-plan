#!/usr/bin/env bun
import { parseArgs } from 'util';
import { parseSeed } from './parser.js';
import { runLoop } from './loop.js';

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
kimi-harness — Ouroboros-inspired self-improving harness for Kimi Code

Usage:
  kimi-harness <seed.yaml> [options]

Options:
  --cwd <path>           Working directory (default: current)
  --max-generations <n>  Override seed.maxGenerations
  -h, --help             Show this help

Example:
  bun run src/cli.ts seed.yaml --cwd=./apps/web --max-generations=10
`);
  process.exit(0);
}

const seedPath = positionals[0];
if (!seedPath) {
  console.error('Error: seed.yaml path required');
  console.error('Run with --help for usage');
  process.exit(1);
}

const seed = parseSeed(seedPath);
await runLoop(seed, {
  cwd: values.cwd!,
  maxGenerations: values['max-generations'] ? parseInt(values['max-generations']) : undefined,
});
