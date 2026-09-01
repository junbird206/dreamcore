# Dreamcore — 작업 현황

> 이 파일은 **항상 덮어쓴다.** 이력은 git에 있으니 여기에 로그를 쌓지 말 것.
> 작업을 시작하기 전에 읽고, 의미 있는 작업 단위가 끝나면 갱신한다.

- **마지막 갱신:** 2026-09-01 / Claude
- **브랜치:** main → `github.com/junbird206/dreamcore` (public)

## 지금 상태
Gemini 해몽 연동 **코드 완료**, 실제 응답은 **미검증**(API 키 없음). 키가 없으면 mock으로 폴백하므로 앱은 정상 동작.

## 방금 한 일
- `app/lib/gemini.ts` 신규 — gemini-2.5-flash 호출, JSON 스키마 강제, 응답 검증. 실패 시 `null` 반환
- `app/api/dream/route.ts` — Gemini 우선, 실패/무키 시 `createMockResult()` 폴백. 응답 `mode`가 `"gemini"` / `"mock"`
- `.gitignore`에 `.dev.vars` 추가 (public 저장소라 키 유출 방지)
- lint / build / test 3개 통과

## 다음 스텝 (우선순위)
1. **Gemini 실호출 검증 (막힘 — 사용자 액션 필요)** — `GOOGLE_AI_API_KEY`가 없어서 실제 응답을 못 봤다.
   aistudio.google.com에서 키 발급 → `.env`에 `GOOGLE_AI_API_KEY=...` → 응답 품질·지연 확인.
   Workers 배포 시엔 `wrangler secret put GOOGLE_AI_API_KEY`. 키를 코드에 넣지 말 것.
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
