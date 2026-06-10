# 🐍 kimi-harness

> Turn vague ideas into concrete, actionable plans.

[![npm version](https://img.shields.io/npm/v/kimi-harness.svg)](https://www.npmjs.com/package/kimi-harness)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

`kimi-harness` is a **planning harness** that interviews, researches, plans, evaluates, and refines — in a loop — until your idea becomes a solid execution plan. It works standalone (rule-based) or as a foundation for LLM-augmented planning.

---

## Install

```bash
# npm
npm install -g kimi-harness

# bun
bun install -g kimi-harness

# Or use without installing
npx kimi-harness seed.yaml
```

---

## Quick Start

Write a `seed.yaml`:

```yaml
goal: "Build a personal tech blog with dark mode"

constraints:
  - "Use Astro"
  - "Deploy to Cloudflare Pages"

nonGoals:
  - "CMS"
  - "Comments"

maxGenerations: 5
```

Run it:

```bash
kimi-harness seed.yaml --cwd=./my-project
# → generates ./my-project/plan.yaml
```

---

## What You Get

```yaml
# plan.yaml
goal: "Build a personal tech blog with dark mode"
version: 3
steps:
  - id: init
    description: "Initialize Astro project with Tailwind"
    estimatedEffort: "2h"
    verificationMethod: "Dev server starts without errors"
  - id: darkmode
    description: "Implement dark mode toggle"
    dependsOn: [init]
    estimatedEffort: "3h"
    verificationMethod: "Toggle persists across reloads"
  - id: deploy
    description: "Configure Cloudflare Pages deployment"
    dependsOn: [optimize]
    estimatedEffort: "1h"
    verificationMethod: "Production URL returns 200"
assumptions:
  - "Team has Node.js 20+ installed"
risks:
  - "Astro Cloudflare adapter may have SSR limits"
```

---

## How It Works

```
Seed (your idea)
   ↓
Planner ──► Plan
   ↓
Evaluator ──► Score (ambiguity · completeness · feasibility · alignment)
   ↓
Interviewer ──► Questions to clarify gaps
   ↓
Researcher ──► Web search topics to validate assumptions
   ↓
Refiner ──► Improved Plan
   ↓
(Repeat until score ≥ 0.85 or max generations)
   ↓
plan.yaml
```

All modules are **rule-based by default** — no API keys, no LLM required. You can swap any module for an LLM-augmented implementation.

---

## Programmatic API

```typescript
import { parseSeed, runLoop } from 'kimi-harness';

const seed = parseSeed('./seed.yaml');
const plan = await runLoop(seed, { cwd: './my-project', maxGenerations: 5 });

console.log(plan.steps);
```

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

## Kimi Code Integration

`kimi-harness` was originally designed as a meta-framework for Kimi Code. If you use Kimi Code, you can treat this package as a **planning skill**:

1. Install it in your project: `npm install kimi-harness`
2. Write a `seed.yaml`.
3. Ask Kimi Code: `"Use the kimi-harness framework to refine this seed into a plan."`

Kimi Code will read the module definitions (interviewer, researcher, planner, evaluator, refiner) and perform each role using its native tools (`AskUserQuestion`, `WebSearch`, reasoning).

See [docs/USAGE.md](docs/USAGE.md) for detailed integration patterns.

---

## Project Structure

```
src/
├── types.ts           # Seed, Plan, PlanVerdict, InterviewQA, ResearchItem
├── parser.ts          # YAML seed → typed Seed
├── planner.ts         # Rule-based Plan synthesis
├── plan-evaluator.ts  # 4-dimension scoring rubric
├── plan-refiner.ts    # Score-driven refinement strategies
├── interviewer.ts     # Gap-driven question generation
├── researcher.ts      # Tech knowledge base + query generation
├── loop.ts            # Orchestrates the planning loop
├── cli.ts             # CLI entrypoint
└── index.ts           # Library exports
```

---

## Roadmap

- [ ] LLM-augmented planner (OpenAI / Anthropic adapter)
- [ ] Interactive interview mode (pause for user input mid-loop)
- [ ] Web research integration (Serper / Tavily adapter)
- [ ] Parallel consensus evaluation (multi-perspective plan review)
- [ ] Lateral thinking on stagnation (break out of local maxima)

---

## License

MIT
