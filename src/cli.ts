#!/usr/bin/env bun
import { parseArgs } from 'util';
import { join, dirname } from 'path';
import { homedir } from 'os';
import { existsSync, mkdirSync, cpSync, rmSync } from 'fs';
import { spawn } from 'child_process';
import { parseSeed } from './parser.js';
import { runLoop } from './loop.js';
import type { Plan } from './types.js';
import { stringify } from 'yaml';
import {
  setDefaultPlanMode,
  addExtraSkillDir,
  removeExtraSkillDir,
  addHooks,
  removeHooks,
} from './config-manager.js';

const GLOBAL_SKILL_DIR = join(homedir(), '.kimi-code/skills/maru-plan');
const LOCAL_SKILL_DIR = join(process.cwd(), '.kimi-code/skills/maru-plan');
const PKG_ROOT = join(dirname(new URL(import.meta.url).pathname), '..');
const SKILL_SRC = join(PKG_ROOT, 'skills', 'maru-plan');

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
🐍 maru-plan — Ouroboros-grade Planning Mode for Kimi Code

Usage:
  maru-plan setup                             Install skill & hooks globally
  maru-plan init                              Install skill into current project
  maru-plan uninstall                         Remove skill & hooks globally
  maru-plan <seed.yaml> [options]             Run batch planning
  maru-plan                                   Start Kimi Code with maru-plan active
  maru-plan hook <event>                      Run Kimi Code hook handler
  maru-plan mcp                               Start MCP server (for plugin)

Options:
  --cwd <path>           Working directory (default: current)
  --max-generations <n>  Override seed.maxGenerations
  -h, --help             Show this help

Examples:
  maru-plan setup
  maru-plan init
  maru-plan seed.yaml --cwd=./apps/web --max-generations=10
  maru-plan
`);
  process.exit(0);
}

const command = positionals[0];

if (command === 'setup') {
  if (existsSync(GLOBAL_SKILL_DIR)) {
    rmSync(GLOBAL_SKILL_DIR, { recursive: true, force: true });
  }
  mkdirSync(GLOBAL_SKILL_DIR, { recursive: true });
  cpSync(SKILL_SRC, GLOBAL_SKILL_DIR, { recursive: true });

  setDefaultPlanMode(true);
  addExtraSkillDir(GLOBAL_SKILL_DIR);
  addHooks();

  console.log(`✅ maru-plan installed globally`);
  console.log(`   Skill: ${GLOBAL_SKILL_DIR}`);
  console.log(`   Config: ~/.kimi-code/config.toml`);
  console.log(`   Hooks: SessionStart, UserPromptSubmit, PreToolUse, Stop`);
  console.log(`   default_plan_mode: true`);
  console.log(`\n   Restart Kimi Code (or run /new) to activate.`);
  process.exit(0);
} else if (command === 'init') {
  if (existsSync(LOCAL_SKILL_DIR)) {
    rmSync(LOCAL_SKILL_DIR, { recursive: true, force: true });
  }
  mkdirSync(LOCAL_SKILL_DIR, { recursive: true });
  cpSync(SKILL_SRC, LOCAL_SKILL_DIR, { recursive: true });

  console.log(`✅ maru-plan installed into current project`);
  console.log(`   Skill: ${LOCAL_SKILL_DIR}`);
  console.log(`   Kimi Code will auto-discover this skill when working in this directory.`);
  process.exit(0);
} else if (command === 'uninstall') {
  if (existsSync(GLOBAL_SKILL_DIR)) {
    rmSync(GLOBAL_SKILL_DIR, { recursive: true, force: true });
  }
  removeHooks();
  removeExtraSkillDir(GLOBAL_SKILL_DIR);

  console.log(`✅ maru-plan uninstalled globally`);
  console.log(`   Skill removed from ${GLOBAL_SKILL_DIR}`);
  console.log(`   Hooks removed from ~/.kimi-code/config.toml`);
  process.exit(0);
} else if (command === 'hook') {
  const hookPath = join(PKG_ROOT, 'dist', 'hooks', 'index.js');
  if (existsSync(hookPath)) {
    const hook = spawn('bun', [hookPath], {
      stdio: ['inherit', 'inherit', 'inherit'],
    });
    hook.on('exit', (code) => process.exit(code ?? 0));
  } else {
    console.log(JSON.stringify({}));
    process.exit(0);
  }
} else if (command === 'mcp') {
  process.stdin.setEncoding('utf-8');
  let buffer = '';

  function send(msg: unknown) {
    const json = JSON.stringify(msg);
    process.stdout.write(`Content-Length: ${Buffer.byteLength(json)}\r\n\r\n${json}`);
  }

  process.stdin.on('data', (chunk) => {
    buffer += chunk;
    while (true) {
      const headerEnd = buffer.indexOf('\r\n\r\n');
      if (headerEnd === -1) break;
      const header = buffer.slice(0, headerEnd);
      const match = header.match(/Content-Length: (\d+)/);
      if (!match || !match[1]) break;
      const length = parseInt(match[1], 10);
      const messageStart = headerEnd + 4;
      if (buffer.length < messageStart + length) break;
      const message = buffer.slice(messageStart, messageStart + length);
      buffer = buffer.slice(messageStart + length);

      try {
        const req = JSON.parse(message);
        if (req.method === 'initialize') {
          send({ jsonrpc: '2.0', id: req.id, result: { protocolVersion: '2024-11-05', capabilities: {}, serverInfo: { name: 'maru-plan', version: '0.2.0' } } });
        } else if (req.method === 'tools/list') {
          send({ jsonrpc: '2.0', id: req.id, result: { tools: [] } });
        } else if (req.method === 'tools/call') {
          send({ jsonrpc: '2.0', id: req.id, error: { code: -32601, message: 'Tool not implemented yet' } });
        } else {
          send({ jsonrpc: '2.0', id: req.id, error: { code: -32601, message: 'Method not found' } });
        }
      } catch {
        // Ignore malformed messages
      }
    }
  });

  setInterval(() => {}, 60_000);
  // Keep process alive — do not fall through
} else if (!command) {
  const args: string[] = ['--plan'];
  if (existsSync(GLOBAL_SKILL_DIR)) {
    args.push('--skills-dir', GLOBAL_SKILL_DIR);
  }
  console.log(`🐍 Starting Kimi Code with maru-plan...`);
  const kimi = spawn('kimi', args, { stdio: 'inherit' });
  kimi.on('exit', (code) => process.exit(code ?? 0));
} else {
  const seedPath = command;
  const seed = parseSeed(seedPath);
  const plan: Plan = await runLoop(seed, {
    cwd: values.cwd!,
    maxGenerations: values['max-generations'] ? parseInt(values['max-generations']) : undefined,
  });

  const yamlOutput = stringify(plan, { sortMapEntries: true });
  const planPath = join(values.cwd!, 'plan.yaml');
  await Bun.write(planPath, yamlOutput);
  console.log(`📄 Final plan written to ${planPath}`);
}
