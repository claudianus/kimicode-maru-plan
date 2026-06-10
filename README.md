# 🐍 kimi-harness

> **Enhanced Planning Mode for Kimi Code**
>
> Turn vague ideas into concrete, actionable plans — automatically, inside your Kimi Code conversations.
> Multi-persona consensus. Generational memory. Meta-evolution. Hard gates. Ouroboros-grade.

[![npm version](https://img.shields.io/npm/v/kimi-harness.svg)](https://www.npmjs.com/package/kimi-harness)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Kimi Code's default planning mode is good. This makes it **great**.

Install once. After that, every time you start a vague project idea in Kimi Code, it automatically runs a 6-phase loop: **Planner → Multi-Persona Evaluation → Hard Gates → Interview → Research → Refiner** — until your plan is solid.

---

## Install (One-Time)

```bash
npm install -g kimi-harness
kimi-harness setup
```

This copies the skill into `~/.kimi-code/skills/kimi-harness/`. Kimi Code picks it up automatically.

---

## Usage (Just Talk)

No files. No commands. Just talk to Kimi Code as usual.

```
> "블로그 만들고 싶어. Astro 쓰고 싶은데 배포는 어디로 해야 할지 모르겠어."

Kimi Code (auto-activated):
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

**Auto-triggers:** "plan", "how to", "I want to build", "roadmap", "what's the best way to"...

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
kimi-harness seed.yaml --cwd=./my-project
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
import { parseSeed, runLoop } from 'kimi-harness';

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
src/
├── types.ts              # Seed, Plan, PlanVerdict, PersonaVerdict, ConsensusVerdict, GenerationMemory
├── parser.ts             # YAML seed → typed Seed
├── planner.ts            # Rule-based Plan synthesis (templates: web/api/cli/mobile)
├── plan-evaluator.ts     # 4-dimension scoring rubric + budget/scope realism
├── plan-refiner.ts       # Score-driven refinement + memory-aware strategy
├── interviewer.ts        # Gap-driven question generation (memory-aware)
├── researcher.ts         # Tech knowledge base (24 terms) + unknown tech warnings
├── loop.ts               # Orchestrates the 6-phase planning loop
├── cli.ts                # CLI entrypoint (setup / uninstall / batch)
├── index.ts              # Library exports
├── gates.ts              # Pre / Post / Consensus hard gates
├── memory.ts             # Generational memory archive + drift detection
├── evaluators/           # 4 persona evaluators + consensus aggregator
│   ├── developer.ts
│   ├── pm.ts
│   ├── security.ts
│   ├── ux.ts
│   ├── aggregator.ts
│   └── index.ts
├── meta/                 # Meta-evolution (self-improving rubrics & prompts)
│   ├── rubric-evolver.ts
│   ├── prompt-evolver.ts
│   └── index.ts
└── exploration/          # Lateral thinking + branch management
    ├── lateral-thinker.ts
    ├── branch-manager.ts
    └── index.ts

tests/
├── benchmark/            # Automated benchmark suite
│   ├── seed-corpus.ts
│   ├── scoring.ts
│   └── run-benchmark.ts
├── gates.test.ts         # 22 tests
├── memory.test.ts        # 16 tests
├── evaluators.test.ts    # 25 tests
├── exploration.test.ts   # 20 tests
└── meta.test.ts          # 22 tests
```

---

## Roadmap

- [x] Multi-persona consensus evaluation (Developer / PM / Security / UX)
- [x] Generational memory & drift prevention
- [x] Meta-evolution of rubrics and prompts
- [x] Lateral thinking on stagnation
- [x] Hard quality gates (pre / post / consensus)
- [x] Benchmark suite with automated scoring
- [ ] LLM-augmented planner adapter (OpenAI / Anthropic)
- [ ] Interactive interview mode (pause for user input mid-loop)
- [ ] Web research adapter (Serper / Tavily)

---

## Uninstall

```bash
kimi-harness uninstall
```

---

## License

MIT
