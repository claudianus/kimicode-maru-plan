/**
 * Kimi Code Config Manager
 *
 * Idempotent read/write operations for ~/.kimi-code/config.toml.
 * Uses string manipulation (no TOML parser dependency).
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

const CONFIG_PATH = join(homedir(), '.kimi-code', 'config.toml');

export function readConfig(): string {
  if (!existsSync(CONFIG_PATH)) return '';
  return readFileSync(CONFIG_PATH, 'utf-8');
}

export function writeConfig(content: string): void {
  writeFileSync(CONFIG_PATH, content, 'utf-8');
}

/**
 * Enable or disable default plan mode in config.toml
 */
export function setDefaultPlanMode(enabled: boolean): void {
  let config = readConfig();
  const line = `default_plan_mode = ${enabled}`;

  if (config.includes('default_plan_mode')) {
    config = config.replace(/default_plan_mode\s*=\s*(true|false)/, line);
  } else {
    config = `${line}\n${config}`;
  }
  writeConfig(config);
}

/**
 * Add a directory to extra_skill_dirs (idempotent)
 */
export function addExtraSkillDir(dir: string): void {
  let config = readConfig();
  const quoted = JSON.stringify(dir);

  if (config.includes('extra_skill_dirs')) {
    // Already exists — check if dir is already in the array
    const regex = /extra_skill_dirs\s*=\s*\[(.*?)\]/s;
    const match = config.match(regex);
    if (match && match[1]) {
      const arrContent = match[1];
      if (!arrContent.includes(quoted)) {
        const newArr = arrContent.trim() ? `${arrContent.trim()}, ${quoted}` : quoted;
        config = config.replace(regex, `extra_skill_dirs = [${newArr}]`);
      }
    }
  } else {
    config += `\nextra_skill_dirs = [${quoted}]\n`;
  }
  writeConfig(config);
}

/**
 * Remove a directory from extra_skill_dirs
 */
export function removeExtraSkillDir(dir: string): void {
  let config = readConfig();
  const quoted = JSON.stringify(dir);

  const regex = /extra_skill_dirs\s*=\s*\[(.*?)\]/s;
  const match = config.match(regex);
  if (match && match[1]) {
    let arrContent = match[1];
    arrContent = arrContent
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s !== quoted && s !== '')
      .join(', ');
    if (arrContent) {
      config = config.replace(regex, `extra_skill_dirs = [${arrContent}]`);
    } else {
      config = config.replace(regex, '');
    }
  }
  writeConfig(config);
}

const MARU_HOOKS = `
[[hooks]]
event = "SessionStart"
command = "maru-plan hook session-start"
timeout = 30

[[hooks]]
event = "UserPromptSubmit"
command = "maru-plan hook user-prompt-submit"
timeout = 30

[[hooks]]
event = "PreToolUse"
command = "maru-plan hook pre-tool-use"
timeout = 30

[[hooks]]
event = "Stop"
command = "maru-plan hook stop"
timeout = 30
`;

/**
 * Register maru-plan hooks in config.toml (idempotent)
 */
export function addHooks(): void {
  let config = readConfig();
  if (config.includes('maru-plan hook')) {
    return; // Already registered
  }
  config += `\n# maru-plan hooks\n${MARU_HOOKS}\n`;
  writeConfig(config);
}

/**
 * Remove maru-plan hooks from config.toml
 */
export function removeHooks(): void {
  let config = readConfig();
  // Remove all lines between "# maru-plan hooks" and the next blank line or section
  config = config.replace(/# maru-plan hooks\n([\s\S]*?)(?=\n\[|\n*$)/, '');
  // Also clean up any standalone maru-plan hook entries
  config = config.replace(/\[\[hooks\]\]\nevent = "(SessionStart|UserPromptSubmit|PreToolUse|Stop)"\ncommand = "maru-plan hook[^"]*"\ntimeout = 30\n/g, '');
  writeConfig(config);
}
