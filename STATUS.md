# Dreamcore — 작업 현황

> 이 파일은 **항상 덮어쓴다.** 이력은 git에 있으니 여기에 로그를 쌓지 말 것.
> 작업을 시작하기 전에 읽고, 의미 있는 작업 단위가 끝나면 갱신한다.

- **마지막 갱신:** 2026-09-01 / Claude
- **브랜치:** main → `github.com/junbird206/dreamcore` (public)

## 지금 상태
1단계 Mock 모드 MVP 동작 중. AI 미연동, DB 미사용. 초기 커밋 완료(`8e34ec1`).

## 방금 한 일
- 코드베이스 전체 파악, 에이전트 인수인계 규약 수립 (`STATUS.md` / `AGENTS.md` / `CLAUDE.md`)
- 초기 커밋 + GitHub 원격 연결 및 push (34개 파일)

## 다음 스텝 (우선순위)
1. **Gemini 해몽 연동** — `app/api/dream/route.ts`의 `createMockResult()`를 실제 호출로 교체.
   `GOOGLE_AI_API_KEY`는 `.env`(gitignore됨)에 두고, Workers 배포 시엔 Wrangler secret으로.
   응답 형식은 기존 `DreamResult` 타입(`app/lib/dream.ts`)을 그대로 유지해야 UI가 안 깨진다.
2. **Nano Banana 이미지 생성** — `DreamLab.tsx`의 mock 타일(`.generated-image`)을 실제 이미지로 교체.
   `result.prompt`가 이미 생성돼 있으니 그걸 입력으로 쓴다.
3. **`NEXT_PUBLIC_SIGNUP_URL` 채우기** — 지금 비어 있어서 CTA가 `#signup-url-needed`로 떨어진다.
4. (선택) D1 연결 — `.openai/hosting.json`의 `d1: null` → `"DB"`, `db/schema.ts`에 테이블 정의.

## 진행 중 / 잠금
- 없음

## 알아둘 결정사항
- `README.md`는 아직 `vinext-starter` 원문임. Dreamcore 설명 아님 — 참고하지 말 것.
- 실패 시 사용자 노출 문구는 전부 한국어. 프로젝트 언어 = 한국어.
- `/api/dream`은 20자 미만 입력을 400으로 거른다. AI 연동 후에도 이 가드 유지.
- 저장소가 **public**이다. 키·URL을 코드에 하드코딩하지 말 것.
