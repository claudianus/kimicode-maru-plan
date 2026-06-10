# Install maru-plan

> Three ways to install. Pick one.

---

## Method A: npm + Auto-Setup (Recommended)

Requires: Node.js ≥ 18, Kimi Code CLI installed.

```bash
npm install -g kimicode-maru-plan
maru-plan setup
```

**What `setup` does:**
1. Copies `skills/maru-plan/` → `~/.kimi-code/skills/maru-plan/`
2. Sets `default_plan_mode = true` in `~/.kimi-code/config.toml`
3. Adds `~/.kimi-code/skills/maru-plan/` to `extra_skill_dirs`
4. Registers 4 hooks in `config.toml`:
   - `SessionStart` — injects maru-plan activation context
   - `UserPromptSubmit` — detects planning intent, injects 6-phase instructions
   - `PreToolUse` — light gate checks before tool execution
   - `Stop` — records generation memory

**Verify:**
```bash
cat ~/.kimi-code/config.toml | grep maru-plan
```

**Activate:** Restart Kimi Code or run `/new` in an existing session.

---

## Method B: Project-Local (npx)

No global install needed. Adds maru-plan only to the current project.

```bash
cd your-project
npx kimicode-maru-plan init
```

**What `init` does:**
1. Copies `skills/maru-plan/` → `./.kimi-code/skills/maru-plan/`

Kimi Code auto-discovers project-level skills when working in this directory.

---

## Method C: Kimi Code Plugin

Install directly through Kimi Code's plugin system.

```bash
kimi plugin install https://github.com/user/kimicode-maru-plan.git
```

Or from a local path:
```bash
kimi plugin install /path/to/kimicode-maru-plan
```

**What the plugin does:**
1. Loads `kimi.plugin.json` manifest
2. Auto-loads `skills/maru-plan/SKILL.md` on every session via `sessionStart.skill`
3. Appends `skillInstructions` whenever the skill is active

**Verify:**
```bash
/plugins info kimicode-maru-plan
```

---

## Troubleshooting

### "maru-plan command not found"

Ensure npm global bin is in your PATH:
```bash
npm bin -g
# Add to ~/.bashrc or ~/.zshrc:
export PATH="$(npm bin -g):$PATH"
```

### "Skill not auto-activating"

1. Check skill is installed:
   ```bash
   ls ~/.kimi-code/skills/maru-plan/SKILL.md
   ```
2. Restart Kimi Code: `/new` or `kimi --plan`
3. Check `extra_skill_dirs` in `~/.kimi-code/config.toml`

### "Hooks not firing"

1. Check config.toml has hooks:
   ```bash
   grep -A2 "maru-plan hook" ~/.kimi-code/config.toml
   ```
2. Ensure `maru-plan` binary is in PATH
3. Restart Kimi Code after config changes

### Plugin install fails

- Git must be installed for `kimi plugin install <git-url>`
- Use Method A (npm) as fallback

### Uninstall cleanly

```bash
maru-plan uninstall
```

This removes skill, hooks, and config entries. It does **not** remove project-local skills (use `rm -rf .kimi-code/skills/maru-plan/` for those).
