# 🐍 kimi-harness

Ouroboros-inspired self-improving harness for **Kimi Code**.

> **Mission:** Execute → Evaluate → Evolve. Never poll. Always drift-guard.

---

## Philosophy

| Principle | Meaning |
|-----------|---------|
| **Goal-Anchor** | `seed.goal` is immutable. Drift beyond 0.5 triggers hard reset. |
| **Mechanical First** | Build, test, lint must pass before semantic evaluation. |
| **Ethical Guard** | Every seed carries `ethicalConstraints`. No exceptions. |
| **No Polling** | Event-driven loops only. No busy-waiting. |
| **Minimal Intrusion** | Changes are applied atomically via `CodeChange`. No guesswork. |

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
goal: "Implement a Redis-backed caching layer for API responses"

constraints:
  - "Use ioredis, not node-redis"
  - "TTL must be configurable per endpoint"
  - "No blocking calls in the hot path"

acceptanceCriteria:
  - id: "ac-1"
    description: "Cache hit returns data without querying the database"
    verificationMethod: "test"
  - id: "ac-2"
    description: "Cache miss populates Redis and returns fresh data"
    verificationMethod: "test"
  - id: "ac-3"
    description: "Build passes without type errors"
    verificationMethod: "build"

nonGoals:
  - "Distributed cache invalidation"
  - "Cache warming on startup"

ethicalConstraints:
  - "Do not log PII in cache keys or values"

maxGenerations: 5
```

---

## Loop Anatomy

```
Generation 1 ──► Evaluate ──► Evolve ──► Generation 2 ──► ...
   │                │            │
   │            mechanical    drift-guard
   │            semantic      derived-constraints
   │            feedback      prompt-refinement
   ▼
Apply code changes to --cwd
Run build / test / lint
```

---

## Project Structure

```
src/
├── types.ts      # Seed, Generation, Verdict, Evolution
├── parser.ts     # YAML seed → typed Seed
├── executor.ts   # Code generation + disk application
├── evaluator.ts  # Mechanical + semantic evaluation
├── evolver.ts    # Drift detection + prompt refinement
├── loop.ts       # Orchestrate Execute→Evaluate→Evolve
├── cli.ts        # CLI entrypoint
└── index.ts      # Library exports
```

---

## Roadmap

- [ ] LLM-based semantic evaluator (goal alignment via Kimi API)
- [ ] Kimi Code subagent integration (`kimi --auto -p` wrapper)
- [ ] Git worktree isolation per generation
- [ ] Parallel consensus evaluation (multi-perspective)
- [ ] Lateral thinking on stagnation

---

## License

MIT
