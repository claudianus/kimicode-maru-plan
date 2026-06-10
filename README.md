# 🐍 kimi-harness

Planning harness for **Kimi Code**.

> **Mission:** Interview → Research → Plan → Evaluate → Refine. Never poll.

This is a **meta-framework** that Kimi Code reads and follows. Each module defines a role; Kimi Code performs the actual work using its own tools (`AskUserQuestion`, `WebSearch`, reasoning, code generation).

---

## Philosophy

| Principle | Meaning |
|-----------|---------|
| **Goal-Anchor** | `seed.goal` is immutable. The plan must always align. |
| **Interview First** | Ambiguity is the enemy. Clarify before planning. |
| **Research Before Commit** | Unknown unknowns kill plans. Investigate early. |
| **No Polling** | Event-driven loops only. No busy-waiting. |
| **Minimal Intrusion** | The harness guides; Kimi Code decides. |

---

## Install

```bash
bun install
```

---

## Usage

```bash
# Run a seed
bun run src/cli.ts seed.yaml --cwd=./my-project

# Override max generations
bun run src/cli.ts seed.yaml --max-generations=10
```

---

## Seed Format

```yaml
goal: "Build a personal portfolio site with a dark-mode toggle"

constraints:
  - "Use Astro, not Next.js"
  - "Must be deployable to Cloudflare Pages"
  - "No JavaScript frameworks on the client"

nonGoals:
  - "CMS integration"
  - "Multi-language support"

context: |
  The user is a backend developer who wants a simple,
  fast-loading site to showcase Go and Rust projects.

maxGenerations: 5
```

---

## Loop Anatomy

```
Plan ──► Evaluate ──► Interview ──► Research ──► Refine ──► Next Plan
  │         │              │             │           │
  │      ambiguity      AskUserQuestion  WebSearch   derive questions
  │      completeness   clarify scope    investigate derive research
  │      feasibility    fill gaps        validate    update plan
  │      alignment                                    
  ▼
Output: concrete plan.yaml
```

---

## Project Structure

```
src/
├── types.ts           # Seed, Plan, PlanVerdict, InterviewQA, ResearchItem
├── parser.ts          # YAML seed → typed Seed
├── interviewer.ts     # Generate clarifying questions
├── researcher.ts      # Define research topics
├── planner.ts         # Synthesize Plan from seed + interviews + research
├── plan-evaluator.ts  # Evaluate Plan quality
├── plan-refiner.ts    # Identify improvements
├── loop.ts            # Orchestrate Plan→Evaluate→Interview→Research→Refine
├── cli.ts             # CLI entrypoint
└── index.ts           # Library exports
```

---

## How Kimi Code Uses This

1. **Read** `src/types.ts` to learn the data model.
2. **Read** `src/loop.ts` to learn the planning flow.
3. **Read** each module to understand its role.
4. **Perform** the role using Kimi Code's native capabilities.

**Module roles:**
- `interviewer.ts` → Kimi Code asks clarifying questions via `AskUserQuestion`.
- `researcher.ts` → Kimi Code searches the web via `WebSearch`.
- `planner.ts` → Kimi Code synthesizes a concrete Plan.
- `plan-evaluator.ts` → Kimi Code evaluates Plan quality.
- `plan-refiner.ts` → Kimi Code identifies improvements.

---

## Roadmap

- [ ] Real semantic evaluation (Kimi Code evaluates its own plan)
- [ ] Interactive interview loop (pause for user answers mid-planning)
- [ ] Web research integration (WebSearch results fed into Plan)
- [ ] Parallel consensus evaluation (multi-perspective plan review)
- [ ] Lateral thinking on stagnation (break out of local maxima)

---

## License

MIT
