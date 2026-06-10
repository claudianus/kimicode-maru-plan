# kimi-harness 사용 가이드

> Kimi Code가 읽고 따르는 **planning meta-framework** 적용 방법

---

## 개요

`kimi-harness`는 코드가 아니라 **지시서**다. Kimi Code가 이 프로젝트의 파일을 읽고, 정의된 절차에 따라 사용자의 모호한 아이디어를 구체적인 실행 계획으로 변환한다.

**핵심 원리:**
- Kimi Code가 `AGENTS.md` → `src/types.ts` → `src/loop.ts` → 각 모듈을 읽는다.
- 각 모듈은 "Kimi Code가 뭘 해야 하는지"를 정의한다.
- 실제 실행(질문, 검색, 추론, 계획 생성)은 Kimi Code가 자신의 도구로 수행한다.

---

## 사용 모드

### 모드 A: 프로젝트 디렉토리에서 직접 사용 (권장)

```bash
cd /path/to/kimi-harness
# Kimi Code working directory를 kimi-harness로 설정
```

1. **사용자가 아이디어 제시**
   ```
   "개인 기술 블로그 만들고 싶어. Astro 쓰고 싶고 배포는 Cloudflare Pages로."
   ```

2. **Kimi Code가 프레임워크를 읽음**
   - `AGENTS.md` → "planning harness구나"
   - `src/types.ts` → Seed, Plan, PlanVerdict 데이터 모델 파악
   - `src/loop.ts` → Plan → Evaluate → Interview → Research → Refine 흐름 파악

3. **Kimi Code가 루프를 실행**
   - **interviewer.ts** 기준으로 사용자에게 질문
   - **researcher.ts** 기준으로 웹 검색
   - **planner.ts** 기준으로 Plan 초안 생성
   - **plan-evaluator.ts** 기준으로 Plan 자체 평가
   - **plan-refiner.ts** 기준으로 개선 방향 도출
   - 반복 → 최종 Plan 제시

### 모드 B: 외부 프로젝트에서 참조 사용

```bash
cd /path/to/my-project
# Kimi Code working directory는 my-project
```

사용자가 Kimi Code에게 명시적으로 프레임워크를 참조하도록 요청:

```
"/path/to/kimi-harness 프레임워크를 사용해서 이 프로젝트 계획을 세워줘.
목표: Redis 기반 API 캐싱 레이어 구현"
```

Kimi Code가 `kimi-harness` 디렉토리를 읽고, 거기 정의된 절차를 따라 `my-project`에 대한 계획을 세운다.

### 모드 C: CLI 독립 실행

```bash
cd /path/to/kimi-harness

# 1. seed.yaml 작성 (docs/examples/simple-blog-seed.yaml 참고)
cat > seed.yaml << 'EOF'
goal: "Build a personal tech blog with a dark-mode toggle"
constraints:
  - "Use Astro, not Next.js"
  - "Must be deployable to Cloudflare Pages"
nonGoals:
  - "CMS integration"
maxGenerations: 5
EOF

# 2. 실행
bun run src/cli.ts seed.yaml --cwd=./my-project

# 3. 결과 확인
cat ./my-project/plan.yaml
```

> ⚠️ CLI 모드는 현재 stub 기반으로, Kimi Code의 실제 추론 없이는 의미 있는 Plan이 나오지 않는다. **메타 프레임워크 모드(모드 A/B)가 본래 목적.**

---

## 프롬프트 템플릿

Kimi Code에게 복사-붙여넣기 할 수 있는 프롬프트 예시:

### 템플릿 1: 기본 사용

```
아래 프레임워크를 사용해서 계획을 세워줘.
프레임워크 경로: /Users/modumaru/Desktop/code/kimi-harness

1. 먼저 해당 경로의 AGENTS.md, src/types.ts, src/loop.ts를 읽고 planning harness의 흐름을 이해해.
2. 내 목표는: "[여기에 목표 입력]"
3. interviewer.ts 기준으로 모호한 부분을 집요하게 질문해.
4. researcher.ts 기준으로 필요한 기술/패턴을 조사해.
5. planner.ts 기준으로 구체적인 실행 계획(Plan)을 만들어.
6. plan-evaluator.ts 기준으로 Plan을 평가하고, 부족하면 refine해서 개선해.
7. 최종 Plan을 YAML 형식으로 출력해.
```

### 템플릿 2: 짧게

```
/Users/modumaru/Desktop/code/kimi-harness 프레임워크 따라서 계획 세워줘.
목표: "[목표]"
```

---

## 예시 세션 흐름

**사용자:** "개인 블로그 만들고 싶어. Astro 쓰고 싶어."

**Kimi Code (interviewer 역할):**
> 목표가 구체적이지 않아요. 몇 가지 질문드릴게요:
> 1. 배포는 어디로 하나요? (Vercel, Cloudflare Pages, Netlify?)
> 2. 다크모드 필요한가요?
> 3. 댓글 시스템이나 CMS는 필요 없나요?
> 4. Lighthouse 점수 목표는 있나요?

**사용자:**
> 1. Cloudflare Pages
> 2. 다크모드 필요
> 3. 댓글이랑 CMS는 안 필요
> 4. Lighthouse 90점 이상

**Kimi Code (researcher 역할):**
> Astro 4.x의 Cloudflare Pages 배포 가이드와 최신 SSR 설정을 검색 중...
> Tailwind CSS + Astro 조합의 성능 벤치마크를 검색 중...

**Kimi Code (planner 역할):**
> Plan 초안을 작성했습니다:
> - Step 1: Astro 프로젝트 생성 및 Tailwind 설정
> - Step 2: 다크모드 토글 컴포넌트 구현
> - Step 3: MDX 기반 콘텐츠 레이아웃 작성
> - Step 4: Cloudflare Pages 배포 설정
> - Step 5: Lighthouse 성능 최적화

**Kimi Code (plan-evaluator 역할):**
> Plan 자체 평가:
> - ambiguity: 0.2 (구체적)
> - completeness: 0.6 (SEO, RSS 설정 누락)
> - feasibility: 0.8 (현실적)
> - goalAlignment: 0.9 (목표와 일치)
> - composite: 0.72 → passed=false (completeness가 0.6으로 기준 미달)

**Kimi Code (plan-refiner 역할):**
> completeness를 높이기 위해 다음을 추가해야 합니다:
> - SEO 메타 태그 설정 단계
> - RSS 피드 생성 단계
> - sitemap.xml 생성 단계

**Kimi Code (planner 역할, 2회차):**
> 개선된 Plan:
> - Step 1~5 유지
> - Step 6: SEO 메타 태그 + OpenGraph 설정
> - Step 7: RSS 피드 생성
> - Step 8: sitemap.xml + robots.txt

**Kimi Code (plan-evaluator 역할, 2회차):**
> - ambiguity: 0.2
> - completeness: 0.85
> - feasibility: 0.8
> - goalAlignment: 0.9
> - composite: 0.81 → passed=true

**Kimi Code:**
> ✅ 최종 Plan이 수락 기준을 통과했습니다. 아래 YAML을 확인해주세요.
> ```yaml
> goal: "Build a personal tech blog with a dark-mode toggle"
> steps:
>   - id: "step-1"
>     description: "Initialize Astro 4.x project with Tailwind CSS"
>     ...
> ```

---

## 디렉토리 구조 예시 (실제 프로젝트)

```
my-blog-project/
├── seed.yaml              # 사용자가 작성한 초기 목표
├── plan.yaml              # Kimi Code가 생성한 최종 계획
├── src/                   # 실제 프로젝트 코드
└── .kimi-code/
    └── AGENTS.md          # (선택) 프로젝트별 Kimi Code 규칙
```

`kimi-harness`는 별도 경로에 두고 참조만 한다:

```
~/tools/kimi-harness/       # 프레임워크 (이 레포)
~/projects/my-blog/         # 실제 작업 프로젝트
```

---

## 팁

1. **seed.yaml는 짧게 시작핼 것.** interviewer가 모호한 부분을 찾아내서 질문한다. 처음부터 완벽하게 적을 필요 없다.

2. **maxGenerations는 3~5가 적당.** 너무 높이면 반복이 길어진다. 보통 2~3회 refinement면 충분하다.

3. **context 필드를 적극 활용.** 사용자 배경, 기술 스택 선호, 예상 독자 등을 적으면 Plan 품질이 크게 올라간다.

4. **nonGoals는 필수.** 범위를 벗어나는 제안을 막는 가장 강력한 도구.

5. **Kimi Code에게 "프레임워크를 읽고 따라"라고 명시적으로 말할 것.** Kimi Code가 자동으로 인식하지 못할 수 있다.

---

## 문제 해결

| 증상 | 원인 | 해결 |
|---|---|---|
| Kimi Code가 planning 흐름을 따르지 않음 | 프레임워크 파일을 읽지 않음 | "`/path/to/kimi-harness`의 `AGENTS.md`와 `src/loop.ts`를 먼저 읽고 따라"라고 명시 |
| Plan이 너무 추상적임 | seed.goal이 짧거나 context 부족 | context 필드 상세화, interviewer 질문에 성실히 답변 |
| Loop이 너무 오래 걸림 | maxGenerations가 너무 높음 | 3~5로 조정, stopOnPass 활용 |
| CLI로 실행핼 Plan이 빈약함 | CLI는 stub 기반 | **메타 프레임워크 모드(모드 A/B) 사용** |
