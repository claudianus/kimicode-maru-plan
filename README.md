# 🐍 kimi-harness

> **Enhanced Planning Mode for Kimi Code**
>
> Turn vague ideas into concrete, actionable plans — automatically, inside your Kimi Code conversations.

[![npm version](https://img.shields.io/npm/v/kimi-harness.svg)](https://www.npmjs.com/package/kimi-harness)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Kimi Code's default planning mode is good. This makes it **great**.

Install once. After that, every time you start a vague project idea in Kimi Code, it automatically runs a structured loop: **Interview → Research → Plan → Evaluate → Refine** — until your plan is solid.

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
  1. Interviewer: "기술 스택은 Astro로 확정인가요? 다크모드 필요한가요?"
  2. Researcher: (WebSearch) Astro 4.x Cloudflare Pages 배포 가이드
  3. Planner: Plan 초안 작성
  4. Evaluator: completeness 0.6 → SEO, RSS 누락 발견
  5. Refiner: SEO 단계 추가 제안
  6. Planner (2회): 개선된 Plan
  7. Evaluator (2회): score 0.81 → passed
  8. 최종 Plan 제시
```

**Auto-triggers:** "plan", "how to", "I want to build", "roadmap", "what's the best way to"...

---

## What You Get

A concrete `Plan` with:

- **steps[]** — actionable items with effort estimates, dependencies, and verification methods
- **assumptions[]** — what the plan relies on
- **risks[]** — identified risks with mitigations
- **interviews[]** — clarifying questions that were asked
- **research[]** — web research findings that informed the plan

---

## How It Works

```
Your Idea
    ↓
Interviewer ──► AskUserQuestion (clarify gaps)
    ↓
Researcher ──► WebSearch (validate assumptions)
    ↓
Planner ──► Synthesize Plan
    ↓
Evaluator ──► Score (ambiguity · completeness · feasibility · alignment)
    ↓
Refiner ──► Improve & loop back
    ↓
Final Plan (score ≥ 0.85)
```

All scoring uses a transparent rubric. No black boxes.

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

## Uninstall

```bash
kimi-harness uninstall
```

---

## Project Structure

```
src/
├── types.ts           # Seed, Plan, PlanVerdict, InterviewQA, ResearchItem
├── parser.ts          # YAML seed → typed Seed
├── planner.ts         # Rule-based Plan synthesis (templates: web/api/cli/mobile)
├── plan-evaluator.ts  # 4-dimension scoring rubric with transparent weights
├── plan-refiner.ts    # Score-driven refinement strategies
├── interviewer.ts     # Gap-driven question generation
├── researcher.ts      # Tech knowledge base (24 terms) + query generation
├── loop.ts            # Orchestrates the planning loop
├── cli.ts             # CLI entrypoint (setup / uninstall / batch)
└── index.ts           # Library exports
```

---

## Roadmap

- [ ] LLM-augmented planner adapter (OpenAI / Anthropic)
- [ ] Interactive interview mode (pause for user input mid-loop)
- [ ] Web research adapter (Serper / Tavily)
- [ ] Parallel consensus evaluation (multi-perspective plan review)
- [ ] Lateral thinking on stagnation (break out of local maxima)

---

## License

MIT
