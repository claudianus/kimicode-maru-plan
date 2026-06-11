# 계획 → 작업 연계 가이드

> maru-plan은 **계획을 생성**하는 것까지만 담당합니다.  
> 생성된 계획을 **실제 작업으로 연계**하는 것은 Kimi Code의 `/goal` + Swarm 기능이 담당합니다.

---

## 흐름 개요

```
사용자 아이디어
    ↓
maru-plan (6-phase loop)
    ↓
Plan 생성 (steps, assumptions, risks, verificationMethod)
    ↓
Kimi Code 실행 (/goal + Swarm)
    ↓
작업 완료
```

---

## 방법 1: 대화 중 자연스럽게 실행 (권장)

maru-plan이 활성화된 Kimi Code 대화에서 가장 자연스러운 흐름입니다.

**1. 계획 생성**
```
> "블로그 만들고 싶어"

Kimi Code:
  [maru-plan] 6-phase loop 실행...
  ✅ Consensus PASSED
  📋 Plan v3 (5 steps) 제시
```

**2. 계획 승인 후 바로 실행**
```
> "이 계획대로 진행해줘"

Kimi Code:
  Step 1/5: Initialize Astro project with Tailwind (2h)
  → 실행 중...
  ✅ Dev server starts without errors
  Step 2/5: Implement dark mode toggle (3h)
  → 실행 중...
```

**포인트:** Kimi Code가 Plan의 `steps[]`를 순차적으로 읽고 각 `verificationMethod`를 체크하며 진행.

---

## 방법 2: `/goal` 명령어로 작업화

Kimi Code의 `/goal` 기능을 사용하여 Plan을 명시적인 작업 목표로 전환.

**1. Plan이 생성된 후:**
```
> /goal "Astro 블로그 프로젝트 완성"

Kimi Code가 Plan의 steps를 sub-tasks로 분해하여 실행.
```

**2. 또는 plan.yaml 파일을 `/goal` 컨텍스트로 주입:**
```bash
# plan.yaml 내용을 클립보드에 복사
pbcopy < plan.yaml
```

```
> /goal "다음 계획대로 실행해줘"
> [plan.yaml 내용 붙여넣기]
```

---

## 방법 3: Swarm으로 병렬 실행

독립적인 step들을 병렬로 실행하여 속도 향상.

**Plan 예시:**
```yaml
steps:
  - id: frontend
    description: "Build Astro blog frontend"
    dependsOn: []
  - id: backend
    description: "Setup API endpoints"
    dependsOn: []
  - id: deploy
    description: "Deploy to Cloudflare"
    dependsOn: [frontend, backend]
```

**Swarm 실행:**
```
> "frontend와 backend step은 병렬로, deploy는 둘 다 끝난 후에 실행해줘"

Kimi Code가 Swarm으로 subagent 할당:
  - Agent A: frontend step
  - Agent B: backend step
  - Agent C: deploy step (A, B 완료 대기)
```

**팁:** `dependsOn`이 비어있는 step들은 병렬 실행 가능.

---

## 방법 4: 수동 체크리스트 (plan.yaml 활용)

Batch mode로 생성된 `plan.yaml`을 수동 작업 체크리스트로 사용.

**1. plan.yaml 생성:**
```bash
maru-plan seed.yaml --cwd=./my-project
```

**2. GitHub Issues로 변환 (선택):**
```bash
# plan.yaml의 steps를 GitHub Issues로 생성
# (향후 maru-plan CLI에 추가 예정)
```

**3. 수동 체크리스트:**
```markdown
# Astro Blog Project

- [ ] Step 1: Initialize Astro project with Tailwind (2h)
  - Verification: Dev server starts without errors
- [ ] Step 2: Implement dark mode toggle (3h)
  - Verification: Toggle persists across reloads
- [ ] Step 3: Deploy to Cloudflare Pages (1h)
  - Verification: Site loads with HTTPS
```

---

## Step 완료 기준

maru-plan이 생성한 각 step의 `verificationMethod`를 완료 기준으로 사용.

```yaml
steps:
  - id: darkmode
    description: "Implement dark mode toggle"
    verificationMethod: "Toggle persists across reloads"
```

**완료 조건:** `verificationMethod`가 충족될 때까지 해당 step은 미완료.

---

## 팁: Plan 재사용

같은 프로젝트에서 plan을 수정 없이 재사용:

```bash
# 이미 생성된 plan.yaml로 다시 실행
maru-plan plan.yaml --max-generations=1
```

또는 Kimi Code 대화 중:
```
> "이전에 만든 블로그 plan에서 dark mode 부분만 수정해줘"
```

maru-plan이 archive를 로드하여 이전 context를 유지.
