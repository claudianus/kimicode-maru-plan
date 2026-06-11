# 🐍 maru-plan

> **Ouroboros-grade Planning Mode for Kimi Code**
>
> Turn vague ideas into concrete, actionable plans — automatically, inside your Kimi Code conversations.
> Multi-persona consensus. Generational memory. Meta-evolution. Hard gates.

[![npm version](https://img.shields.io/npm/v/kimicode-maru-plan.svg)](https://www.npmjs.com/package/kimicode-maru-plan)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Kimi Code's default planning mode is good. **maru-plan makes it great.**

Install once. After that, every time you start a vague project idea in Kimi Code, it automatically runs a 6-phase loop: **Planner → Multi-Persona Evaluation → Hard Gates → Interview → Research → Refiner** — until your plan is solid.

---

## Install (One-Line)

**Option A — curl | bash (recommended, no npm needed):**
```bash
curl -fsSL https://raw.githubusercontent.com/claudianus/kimicode-maru-plan/main/install.sh | bash
```

**Option B — npm:**
```bash
npm install -g kimicode-maru-plan && maru-plan setup
```

**Option C — project-local:**
```bash
npx kimicode-maru-plan init
```

**Option D — Kimi Code Plugin:**
```bash
kimi plugin install https://github.com/claudianus/kimicode-maru-plan.git
```

> See [INSTALL.md](docs/INSTALL.md) for detailed steps and troubleshooting.  
> See [EXECUTION.md](docs/EXECUTION.md) for connecting plans to actual work.

---

## Usage (Just Talk)

No files. No commands. Just talk to Kimi Code as usual.

```
> "블로그 만들고 싶어. Astro 쓰고 싶은데 배포는 어디로 해야 할지 모르겠어."

Kimi Code (maru-plan auto-activated):
  1. Planner:     Plan 초안 작성
  2. Evaluators:  Developer 0.92 ✅ | PM 0.88 ✅ | Security 0.95 ✅ | UX 0.70 ❌
                  → Consensus FAILED (UX < 0.75 threshold)
  3. Gates:       Post-evaluation gate pass
  4. Interviewer: "다크모드 토글 방식을 구체적으로 알려주세요." (AskUserQuestion)
  5. Researcher:  (WebSearch) Astro 다크모드 최신 패턴
  6. Refiner:     UX 개선 + 메모리 기록
  7. Planner:     개선된 Plan
  8. Evaluators:  UX 0.85 → Consensus PASSED
  9. 최종 Plan 제시
```

**Auto-triggers:** `plan`, `build`, `how to`, `I want to build`, `roadmap`, `design`, `create`, `make`...

**Explicit command:** `/maru-plan "내가 만들고 싶은 것..."`

**CLI wrapper:** `maru-plan` (starts `kimi --plan` with maru-plan skill loaded)

> See [USAGE.md](docs/USAGE.md) for all 4 usage modes.

---

## Architecture: 6 Phases

```
Your Idea (seed.yaml or conversation)
    ↓
┌──────────────────────────────────────────────────────────────────────────┐
│ Phase 1: PLANNER                                                         │
│   → Detect archetype (web/api/cli/mobile) from goal keywords             │
│   → Select template, customize with constraints/nonGoals                 │
│   → Output: Plan with steps, assumptions, risks                          │
├──────────────────────────────────────────────────────────────────────────┤
│ Phase 2: MULTI-PERSONA EVALUATION                                        │
│   → Developer evaluates: completeness + feasibility                      │
│   → PM evaluates: goal alignment + ambiguity                             │
│   → Security evaluates: constraint enforcement + feasibility             │
│   → UX evaluates: clarity + goal alignment                               │
│   → Aggregator: consensus score + disagreement detection                 │
│   → Hard rule: any persona < 0.75 = automatic fail                       │
├──────────────────────────────────────────────────────────────────────────┤
│ Phase 3: HARD QUALITY GATES                                              │
│   → Pre-Generation:  seed validation (noun/verb, no contradictions)      │
│   → Post-Evaluation: plan validation (≥3 steps, no drift, no dupes)      │
│   → Consensus Gate:  all personas ≥ 0.75                                 │
│   → Gate violation = fail regardless of score                            │
├──────────────────────────────────────────────────────────────────────────┤
│ Phase 4: INTERVIEW (Clarify)                                             │
│   → Memory-aware question generation (avoids repeating failed questions) │
│   → AskUserQuestion for P0/P1 priority gaps                              │
├──────────────────────────────────────────────────────────────────────────┤
│ Phase 5: RESEARCH (Validate)                                             │
│   → WebSearch for best practices and compatibility                       │
│   → Unknown technology warnings                                          │
├──────────────────────────────────────────────────────────────────────────┤
│ Phase 6: REFINER + META-EVOLUTION (Improve)                              │
│   → Identify weakest dimension, update plan                              │
│   → Meta-evolution every 3rd gen: adjust rubric weights                  │
│   → Lateral thinking on stagnation: 3 alternative approaches             │
│   → Read generational memory to avoid discarded ideas                    │
└──────────────────────────────────────────────────────────────────────────┘
    ↓
(Loop back to Phase 2 if consensus < 0.85)
    ↓
Final Plan (score ≥ 0.85, all gates pass)
```

---

## Integration Layers

maru-plan integrates with Kimi Code at three levels:

```
┌─────────────────────────────────────────────────────────────┐
│ Layer 1: Kimi Code Plugin                                   │
│   • Install: kimi plugin install <repo>                     │
│   • Auto-loads skill on every session via sessionStart      │
│   • Managed through /plugins in TUI                         │
├─────────────────────────────────────────────────────────────┤
│ Layer 2: npm CLI + Auto-Setup                               │
│   • Install: npm install -g kimicode-maru-plan              │
│   • maru-plan setup → skill + hooks + config.toml           │
│   • maru-plan init  → project-local skill copy              │
├─────────────────────────────────────────────────────────────┤
│ Layer 3: Hook Interception (deepest)                        │
│   • UserPromptSubmit hook detects planning intent           │
│   • Injects 6-phase instructions via additionalContext      │
│   • PreToolUse hook runs gate checks before execution       │
│   • Stop hook records generation memory                     │
└─────────────────────────────────────────────────────────────┘
```

---

## What You Get

A concrete `Plan` with:

- **steps[]** — actionable items with effort estimates, dependencies, and verification methods
- **assumptions[]** — what the plan relies on
- **risks[]** — identified risks with mitigations
- **interviews[]** — clarifying questions that were asked
- **research[]** — web research findings that informed the plan

---

## Batch Mode (Optional)

If you prefer writing a `seed.yaml` and getting a `plan.yaml` without conversation:

```bash
# Write a seed.yaml
cat > seed.yaml << 'EOF'
goal: "Build a personal tech blog with dark mode"
constraints:
  - "Use Astro"
  - "Deploy to Cloudflare Pages"
maxGenerations: 5
EOF

# Run
maru-plan seed.yaml --cwd=./my-project
# → generates ./my-project/plan.yaml
```

This is useful for CI pipelines or pre-commit planning hooks.

---

## Seed Format

```yaml
goal: "One-sentence mission"

constraints:        # Hard rules the plan must respect
  - "Use Postgres, not MongoDB"
  - "Must work offline"

nonGoals:           # Explicitly out-of-scope
  - "Mobile app"
  - "Real-time sync"

context: |          # Free-form background (optional)
  The team is 2 backend devs, no frontend experience.

maxGenerations: 5   # Loop limit (default: 5)
```

---

## Programmatic API

```typescript
import { parseSeed, runLoop } from 'kimicode-maru-plan';

const seed = parseSeed('./seed.yaml');
const plan = await runLoop(seed, { cwd: './my-project', maxGenerations: 5 });

console.log(plan.steps);
```

---

## Benchmark Results

| Project Type | Score | Generations |
|---|---|---|
| Astro blog | 0.90 | 1 |
| Go API server | 0.95 | 1 |
| Rust CLI | 1.00 | 1 |
| React Native app | 0.90 | 1 |
| Python research | 0.95 | 1 |
| **Average** | **0.94** | **1.0** |

Run your own: `bun run tests/benchmark/run-benchmark.ts`

---

## Project Structure

```
kimicode-maru-plan/
├── kimi.plugin.json          # Kimi Code Plugin manifest
├── package.json              # npm package
├── skills/
│   └── maru-plan/
│       └── SKILL.md          # Kimi Code Skill definition
├── src/
│   ├── cli.ts                # maru-plan CLI (setup/init/mcp/batch)
│   ├── config-manager.ts     # ~/.kimi-code/config.toml manipulation
│   ├── hooks/                # Kimi Code lifecycle hooks
│   │   ├── index.ts          # Hook router (JSON stdio)
│   │   ├── session-start.ts
│   │   ├── user-prompt-submit.ts
│   │   ├── pre-tool-use.ts
│   │   └── stop.ts
│   ├── types.ts              # Seed, Plan, PlanVerdict, PersonaVerdict, ConsensusVerdict, GenerationMemory
│   ├── parser.ts             # YAML seed → typed Seed
│   ├── planner.ts            # Rule-based Plan synthesis
│   ├── plan-evaluator.ts     # 4-dimension scoring rubric
│   ├── plan-refiner.ts       # Score-driven refinement
│   ├── interviewer.ts        # Gap-driven question generation
│   ├── researcher.ts         # Tech knowledge base
│   ├── loop.ts               # Orchestrates the 6-phase loop
│   ├── index.ts              # Library exports
│   ├── gates.ts              # Pre / Post / Consensus hard gates
│   ├── memory.ts             # Generational memory archive + drift detection
│   ├── evaluators/           # 4 persona evaluators + consensus aggregator
│   ├── meta/                 # Meta-evolution
│   └── exploration/          # Lateral thinking + branch management
├── tests/                    # 105 unit tests
├── docs/
│   ├── INSTALL.md
│   ├── USAGE.md
│   └── examples/
└── README.md
```

---

## Uninstall

```bash
maru-plan uninstall
```

---

## License

MIT
