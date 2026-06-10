---
name: Enhanced Planning Harness
id: kimi-harness
description: >
  Turn vague ideas into concrete, actionable plans through iterative
  interview, research, planning, evaluation, and refinement.
  Features multi-persona consensus evaluation, generational memory,
  meta-evolution of rubrics, lateral thinking, and hard quality gates.
  Replaces or enhances the default planning mode with structured
  multi-dimensional scoring and evidence-based refinement.
triggers:
  - When the user says "plan", "planning", "how to", "how should I", "what's the best way to"
  - When the user has a vague idea and needs concrete steps
  - When the user asks for a roadmap, timeline, or execution strategy
  - Before starting a complex multi-step task
  - When the user says "I want to build", "I want to create", "I want to make"
  - When the default plan mode feels insufficient or too vague
---

# Enhanced Planning Harness

## Overview

This harness replaces ad-hoc planning with a **6-phase, evidence-based loop** that exceeds Ouroboros-level quality.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Phase 1: Planner        → Generate initial Plan                            │
│  Phase 2: Multi-Persona Eval → 4 independent evaluators + consensus         │
│  Phase 3: Hard Gates     → Non-negotiable quality checks                    │
│  Phase 4: Interview      → AskUserQuestion for gaps                         │
│  Phase 5: Research       → WebSearch for validation                         │
│  Phase 6: Refiner        → Improve Plan with memory + meta-evolution        │
│                            ↓                                                │
│                    (Repeat until pass or max generations)                   │
└─────────────────────────────────────────────────────────────────────────────┘
```

Each iteration improves the plan until it meets quality thresholds (composite score ≥ 0.85, all personas ≥ 0.75, all gates pass).

## Installation

```bash
npm install -g kimi-harness
kimi-harness setup
```

This copies the skill into `~/.kimi-code/skills/kimi-harness/` so Kimi Code can load it automatically.

## How to Use (In Conversation)

No manual file editing required. When this skill is active, simply **talk to Kimi Code as usual**.

**Example:**

> **User:** "블로그 만들고 싶어. Astro 쓰고 싶은데 배포는 어디로 해야 할지 모르겠어."
>
> **Kimi Code (harness activated):**
> 1. **Planner:** Plan 초안 작성 (Astro 블로그 템플릿)
> 2. **Evaluators:**
>    - Developer: 0.92 ✅ (구현 가능)
>    - PM: 0.88 ✅ (목표 일치)
>    - Security: 0.95 ✅ (제약 준수)
>    - UX: 0.70 ❌ (다크모드 상세 부족)
>    - Consensus: FAILED (UX < 0.75)
> 3. **Gates:** Post-evaluation gate pass
> 4. **Interviewer:** "다크모드 토글 방식을 구체적으로 알려주세요."
> 5. **Researcher:** (WebSearch) Astro 다크모드 최신 패턴
> 6. **Refiner:** UX 개선 + 메모리 기록
> 7. **Planner (2회):** 개선된 Plan
> 8. **Evaluators (2회):** UX 0.85 → Consensus PASSED
> 9. **최종 Plan 제시**

## The 6 Phases (What Kimi Code Does Internally)

### Phase 1: Planner (Synthesize)

Read `src/planner.ts`.

Combine: **seed + interview answers + research findings** → concrete `Plan`.

- Detect project archetype from goal keywords (web, API, CLI, mobile, generic)
- Select base template and customize with constraints/nonGoals
- Generate assumptions, risks, effort estimates, and verification methods

### Phase 2: Multi-Persona Evaluation (Consensus)

Read `src/evaluators/`.

Run **4 independent evaluators** in parallel, then aggregate:

| Persona | Weight Focus | Key Concern |
|---------|-------------|-------------|
| **Developer** | completeness 40%, feasibility 35% | Can this be built? Are deps realistic? |
| **PM** | goalAlignment 40%, ambiguity 30% | Does this serve the business goal? |
| **Security** | feasibility 40%, completeness 30% | Are constraints enforced? Any security gaps? |
| **UX** | ambiguity 40%, goalAlignment 30% | Is this clear for end users? |

**Consensus rules:**
- Consensus score = average of persona scores
- **Hard rule:** Any persona < 0.75 → plan cannot pass
- Disagreements (|scoreA - scoreB| > 0.3) are surfaced for resolution

### Phase 3: Hard Quality Gates (Non-Negotiable)

Read `src/gates.ts`.

Three gate layers that **cannot be bypassed** by evaluator scores:

1. **Pre-Generation Gate** — Seed validation:
   - Goal must contain noun + verb
   - Constraints must not contradict each other
   - Goal length < 200 chars

2. **Post-Evaluation Gate** — Plan structural validation:
   - ≥ 3 steps, ≥ 1 assumption, ≥ 1 risk
   - No duplicate step descriptions
   - Plan goal must match seed goal (semantic overlap > 50%)

3. **Consensus Gate** — Per-persona minimum:
   - All 4 personas must score ≥ 0.75

### Phase 4: Interview (Clarify)

Read `src/interviewer.ts`.

Generate questions for:
- **Goal ambiguity** — Subjective words? Too short?
- **Missing constraints** — Budget? Timeline? Tech stack?
- **Non-goal conflicts** — Scope creep?
- **Vague steps** — Descriptions < 4 words?
- **Missing effort estimates** — Verification methods absent?

Use `AskUserQuestion` for **P0/P1 priority** questions.

**Memory-aware:** The interviewer reads the generational memory archive to avoid repeating questions that didn't help in previous generations.

### Phase 5: Research (Validate)

Read `src/researcher.ts`.

For each identified research topic:
- Search the web for current best practices (`WebSearch`)
- Check official documentation
- Verify compatibility with constraints
- **Warn on unknown technologies** — fictional or immature tech gets flagged

### Phase 6: Refiner + Meta-Evolution (Improve)

Read `src/plan-refiner.ts` and `src/meta/`.

**Refinement:**
- Identify weakest dimension from consensus
- Generate follow-up questions and research queries
- Update plan with new steps, assumptions, or risks
- **Read generational memory** to avoid retrying discarded ideas

**Meta-Evolution (every 3rd generation):**
- Review last 3 generations' scores
- Suggest rubric weight adjustments if a dimension is consistently weak or strong
- Suggest prompt priority adjustments based on question yield

**Lateral Thinking (on stagnation):**
- If score improvement < 0.05 for 3 consecutive generations:
  - Generate 3 radically different approaches (conservative, aggressive, lateral)
  - Present to user via `AskUserQuestion`
  - Record chosen strategy in memory as a pivot

## Output Format

Final output is a `Plan` object with:

```yaml
goal: "Build a personal tech blog with dark mode"
version: 3
steps:
  - id: init
    description: "Initialize Astro project with Tailwind"
    estimatedEffort: "2h"
    verificationMethod: "Dev server starts without errors"
  - id: darkmode
    description: "Implement dark mode toggle with localStorage"
    dependsOn: [init]
    estimatedEffort: "3h"
    verificationMethod: "Toggle persists across reloads"
assumptions:
  - "Team has Node.js 20+ installed"
  - "No user authentication required"
risks:
  - "Astro Cloudflare adapter may have SSR limits on free tier"
interviews:
  - id: "g1-q1"
    question: "What is your preferred deployment platform?"
    answer: "Cloudflare Pages"
research:
  - id: "r1"
    query: "Astro 4.x Cloudflare Pages deployment"
    summary: "Official adapter supports static and SSR. Edge runtime has 50ms CPU limit."
```

## When to Skip This Skill

- Simple one-liner tasks ("변수명 바꿔줘")
- Already have a detailed, approved spec
- The user explicitly says "don't over-plan, just do it"

## Uninstall

```bash
kimi-harness uninstall
```
