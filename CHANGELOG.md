# Changelog

## 0.1.0 (2026-06-10)

- Initial release
- Rule-based planning harness with no external API dependencies
- CLI: `kimi-harness seed.yaml` → `plan.yaml`
- Library API: `import { runLoop, parseSeed } from 'kimi-harness'`
- 5 core modules:
  - `planner` — template-based Plan synthesis from seed + interviews + research
  - `plan-evaluator` — 4-dimension scoring rubric (ambiguity, completeness, feasibility, alignment)
  - `plan-refiner` — score-driven refinement strategies with follow-up questions/research
  - `interviewer` — gap-driven question generation (goal, constraints, steps, assumptions)
  - `researcher` — tech knowledge base (24 terms) with query generation and synthesis
- Loop: Plan → Evaluate → Interview → Research → Refine → repeat
- Kimi Code meta-framework mode documented in `docs/USAGE.md`
