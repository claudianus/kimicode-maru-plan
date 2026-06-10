# kimi-harness — AGENTS.md

> Planning harness for Kimi Code. Bun + TypeScript.
>
> This project is a **meta-framework** that Kimi Code reads and follows.
> Each module defines a role; Kimi Code performs the actual work using
> its own tools (AskUserQuestion, WebSearch, reasoning, code generation).

---

## Boundaries

### ✅ Always
- `seed.goal` is immutable during planning.
- Type-check before commit: `bun run type-check`
- Each module interface is stable — evolve internals, not signatures.

### 🚫 Never
- Use `as any`, `@ts-ignore`, `@ts-expect-error`.
- Poll for file changes or process status.
- Log PII or credentials.

---

## How Kimi Code Uses This Harness

**Read, don't just execute.** Kimi Code should:
1. Read `src/types.ts` to understand the data model (Seed, Plan, PlanVerdict).
2. Read `src/loop.ts` to understand the planning flow.
3. Read each module to understand its role in the flow.
4. Perform the role using Kimi Code's native capabilities.

**Module roles:**
- `interviewer.ts` → Kimi Code asks the user clarifying questions via `AskUserQuestion`.
- `researcher.ts` → Kimi Code searches the web via `WebSearch`.
- `planner.ts` → Kimi Code synthesizes a concrete Plan from seed + interviews + research.
- `plan-evaluator.ts` → Kimi Code evaluates the Plan (ambiguity, completeness, feasibility, alignment).
- `plan-refiner.ts` → Kimi Code identifies improvements and generates follow-up questions/research.

**The loop:**
```
plan → evaluate → interview (AskUserQuestion) → research (WebSearch) → refine → repeat
```

Kimi Code iterates until the Plan score is high enough or max generations reached.

---

## Non-Obvious Patterns

**Planner modules are framework definitions** — The functions in `planner`, `plan-evaluator`, `plan-refiner`, `interviewer`, and `researcher` are skeletal. They declare *what* Kimi Code should do; Kimi Code performs the actual reasoning, questioning, and searching. Keep the interfaces stable.

**Evaluator defaults are conservative** — `plan-evaluator` returns 0.5 on all dimensions as a placeholder. Kimi Code should override this with real semantic evaluation.

**Evolution preserves original constraints** — Derived constraints are appended, never removed. This prevents goal drift.

---

## Commit Style

Conventional Commits prefix in English (`feat:`, `fix:`, `chore:`), body in Korean.

---

## LeanCTX

- `ctx_read` for file reads
- `ctx_shell` for `bun` commands
- `ctx_search` for codebase navigation
