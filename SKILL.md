---
name: Enhanced Planning Harness
id: kimi-harness
description: >
  Turn vague ideas into concrete, actionable plans through iterative
  interview, research, planning, evaluation, and refinement.
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

This harness replaces ad-hoc planning with a **structured, evidence-based loop**.

```
Plan → Evaluate → Interview → Research → Refine → Next Plan
```

Each iteration improves the plan until it meets quality thresholds (composite score ≥ 0.85).

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
> 1. **Interviewer:** "기술 스택은 Astro로 확정인가요? 다크모드 필요한가요? CMS는 필요 없나요?"
> 2. **Researcher:** (WebSearch) Astro 4.x 최신 배포 가이드 검색
> 3. **Planner:** Plan 초안 작성
> 4. **Evaluator:** completeness 0.6 → SEO, RSS 누락 발견
> 5. **Refiner:** SEO 단계 추가 제안
> 6. **Planner (2회):** 개선된 Plan
> 7. **Evaluator (2회):** score 0.81 → passed
> 8. **최종 Plan 제시**

## The Loop (What Kimi Code Does Internally)

### Step 1: Interview (Clarify)

Read `src/interviewer.ts` from the installed package.

Generate questions for:
- **Goal ambiguity** — Is the goal shorter than 30 chars? Contains subjective words ("good", "nice", "better")?
- **Missing constraints** — Budget? Timeline? Tech stack? Team size?
- **Non-goal conflicts** — Are non-goals being violated by implied scope?
- **Vague steps** — Any step description shorter than 10 chars?
- **Missing effort estimates** — Are verification methods missing?

Use `AskUserQuestion` for **P0/P1 priority** questions.

### Step 2: Research (Validate)

Read `src/researcher.ts`.

For each identified research topic:
- Search the web for current best practices (WebSearch)
- Check official documentation
- Verify compatibility with constraints
- Assess source authority (official docs > blog posts)

### Step 3: Plan (Synthesize)

Read `src/planner.ts`.

Combine: **seed + interview answers + research findings** → concrete `Plan`.

The planner uses rule-based templates (web, API, CLI, mobile, generic) selected by goal keywords.

### Step 4: Evaluate (Score)

Read `src/plan-evaluator.ts`.

Score the plan on 4 dimensions (0 = worst, 1 = best):

| Dimension | Weight | What it measures |
|-----------|--------|------------------|
| **Ambiguity** | 25% | Is every term concrete and measurable? |
| **Completeness** | 30% | Are all critical steps, verifications, and dependencies present? |
| **Feasibility** | 25% | Can this actually be executed within constraints? |
| **Goal Alignment** | 20% | Does every step directly serve the original goal? |

**Composite score** = (1 − ambiguity) × 0.25 + completeness × 0.30 + feasibility × 0.25 + alignment × 0.20

Pass threshold: **composite ≥ 0.85 AND ambiguity ≤ 0.4 AND completeness ≥ 0.6**

### Step 5: Refine (Improve)

Read `src/plan-refiner.ts`.

If score < 0.85:
- Identify the weakest dimension
- Generate follow-up questions (interviewQuestions)
- Suggest research topics (researchQueries)
- Update the plan with new steps, assumptions, or risks

**Repeat from Step 1** with the updated plan.

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
