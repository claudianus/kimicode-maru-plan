# kimi-harness — AGENTS.md

> Ouroboros-inspired self-improving harness for Kimi Code. Bun + TypeScript.

---

## Boundaries

### ✅ Always
- `seed.goal` is immutable during evolution.
- Drift score >= 0.5 → hard reset to original goal.
- Mechanical evaluation precedes semantic evaluation.
- Ethical constraints are inherited, never dropped.
- Use `bun` for all scripting and execution.
- Type-check before commit: `bun run type-check`

### 🚫 Never
- Apply untested code changes to the host working tree without a worktree.
- Delete or modify `seed.goal` during `evolveSeed`.
- Use `as any`, `@ts-ignore`, `@ts-expect-error`.
- Poll for file changes or process status.
- Log PII or credentials.

---

## Non-Obvious Patterns

**Executor is a stub** — `executeGeneration` currently returns an empty `Generation`. In a real session it wraps Kimi Code (or another LLM) to produce `CodeChange[]`. Keep the stub interface stable; only the internals change.

**Evaluator defaults are conservative** — Semantic evaluation returns 0.5 alignment until an LLM-based evaluator is wired in. This prevents false passes.

**Evolution appends constraints** — `evolveSeed` never removes original constraints; it only appends derived ones. This prevents constraint drift.

---

## Commit Style

Conventional Commits prefix in English (`feat:`, `fix:`, `chore:`), body in Korean.

---

## LeanCTX

- `ctx_read` for file reads
- `ctx_shell` for `bun` commands
- `ctx_search` for codebase navigation
