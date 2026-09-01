# Dreamcore — 작업 현황

> 이 파일은 **항상 덮어쓴다.** 이력은 git에 있으니 여기에 로그를 쌓지 말 것.
> 작업을 시작하기 전에 읽고, 의미 있는 작업 단위가 끝나면 갱신한다.

- **마지막 갱신:** 2026-09-01 / Claude
- **브랜치:** main (커밋 0개 — 아직 초기 커밋 전)

## 지금 상태
1단계 Mock 모드 MVP 동작 중. AI 미연동, DB 미사용.

## 방금 한 일
- 코드베이스 전체 파악 (vinext + Cloudflare Workers 스타터 기반, 실코드는 `app/` 4개 파일)
- `STATUS.md` / `AGENTS.md` / `CLAUDE.md` 추가 — 에이전트 간 인수인계 규약 수립

## 다음 스텝 (우선순위)
1. **초기 커밋** — 전 파일이 untracked 상태라 롤백 지점이 없음
2. **Gemini 해몽 연동** — `app/api/dream/route.ts`의 `createMockResult()`를 실제 호출로 교체, `GOOGLE_AI_API_KEY` 사용
3. **Nano Banana 이미지 생성** — `DreamLab.tsx`의 mock 타일(`.generated-image`)을 실제 이미지로 교체
4. (선택) D1 연결 — `.openai/hosting.json`의 `d1: null` → `"DB"`, `db/schema.ts`에 테이블 정의

## 진행 중 / 잠금
- 없음

## 알아둘 결정사항
- `README.md`는 아직 `vinext-starter` 원문임. Dreamcore 설명 아님 — 참고하지 말 것.
- 실패 시 사용자 노출 문구는 전부 한국어. 프로젝트 언어 = 한국어.
- `/api/dream`은 20자 미만 입력을 400으로 거른다. AI 연동 후에도 이 가드 유지.
