# maru-plan 사용 가이드

> 4가지 사용 모드. 상황에 따라 선택.

---

## 모드 1: 자동 활성화 (Auto) — 권장

설치 후 아무것도 하지 않아도 됨. Kimi Code 대화 중 자연스럽게 maru-plan이 작동.

**트리거 단어:**
- "plan", "planning", "how to", "how should I"
- "build", "create", "make", "design", "architect"
- "I want to build", "I want to create", "let's build"
- "roadmap", "timeline", "execution strategy", "project plan"

**예시:**
```
> "블로그 만들고 싶어. Astro 쓰고 싶은데 배포는 어디로 해야 할지 모르겠어."

Kimi Code (maru-plan activated):
  [Phase 1] Planner → Astro 블로그 템플릿 선택
  [Phase 2] Evaluators → Developer 0.92 | PM 0.88 | Security 0.95 | UX 0.70
  [Phase 3] Gates → Post-evaluation pass
  [Phase 4] Interview → "다크모드 토글 방식을 구체적으로 알려주세요."
  [Phase 5] Research → Astro 다크모드 최신 패턴 검색
  [Phase 6] Refiner → UX 개선
  ... (반복)
  ✅ Consensus PASSED — 최종 Plan 제시
```

**원리:**
- `sessionStart.skill`이 세션 시작 시 maru-plan 컨텍스트 주입
- `UserPromptSubmit` hook이 planning intent 감지 → 6-phase instructions 주입
- Kimi Code가 추가 지시를 받아 더 철저한 planning 수행

---

## 모드 2: CLI 래퍼 (CLI Wrapper)

`maru-plan` 명령어로 Kimi Code를 시작하면 skill이 자동 로드됨.

```bash
maru-plan
# → kimi --plan --skills-dir ~/.kimi-code/skills/maru-plan
```

**용도:**
- maru-plan이 항상 활성화된 상태로 Kimi Code 시작
- `.kimi-code/skills/`가 아닌 다른 위치에 skill이 있을 때

---

## 모드 3: 명시적 호출 (Explicit)

세션 중 `/maru-plan`으로 명시적으로 활성화.

```
> /maru-plan "e-commerce 사이트 만들고 싶어. Next.js + Stripe"

Kimi Code (maru-plan explicitly activated):
  ... 6-phase loop 실행 ...
```

**용도:**
- 자동 트리거가 걸리지 않는 모호한 상황
- 이미 진행 중인 대화에서 planning 모드 전환

---

## 모드 4: 배치 모드 (Batch)

대화 없이 `seed.yaml` → `plan.yaml` 생성.

```bash
maru-plan seed.yaml --cwd=./my-project
```

**용도:**
- CI/CD 파이프라인
- 사전 계획 생성
- 자동화된 문서화

---

## Plan Mode 후킹 상세

maru-plan은 Kimi Code의 Plan Mode를 완전히 대체하지는 않음. 대신 **강화(wrap)**함.

```
사용자가 Plan Mode 진입 (Shift-Tab 또는 /plan)
    ↓
UserPromptSubmit hook 발동
    ↓
maru-plan이 planning intent 확인
    ↓
additionalContext로 6-phase instructions 주입
    ↓
Kimi Code가 더 철저한 plan 생성
    ↓
PreToolUse hook이 gate 체크
    ↓
Stop hook이 memory 기록
```

**장점:**
- Kimi Code의 기본 Plan Mode 동작은 그대로 유지
- maru-plan이 추가 구조와 품질 기준 주입
- 실패 시 fallback to default behavior

---

## Programmatic API

```typescript
import { parseSeed, runLoop } from 'kimicode-maru-plan';

const seed = parseSeed('./seed.yaml');
const plan = await runLoop(seed, {
  cwd: './my-project',
  maxGenerations: 5,
});

console.log(plan.steps);
console.log(plan.consensusVerdict);
```

---

## Seed Format

```yaml
goal: "One-sentence mission"

constraints:
  - "Use Postgres, not MongoDB"
  - "Must work offline"

nonGoals:
  - "Mobile app"
  - "Real-time sync"

context: |
  The team is 2 backend devs, no frontend experience.

maxGenerations: 5
```

---

## 출력 형식

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
