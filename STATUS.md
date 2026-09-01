# Dreamcore — 작업 현황

> 이 파일은 **항상 덮어쓴다.** 이력은 git에 있으니 여기에 로그를 쌓지 말 것.
> 작업을 시작하기 전에 읽고, 의미 있는 작업 단위가 끝나면 갱신한다.

- **마지막 갱신:** 2026-09-01 / Claude
- **브랜치:** main → `github.com/junbird206/dreamcore` (public)

## 지금 상태
Gemini 해몽 검증 완료 + 레이트리밋 구현 완료. **아직 배포 안 됨.** 배포 대상은 **Cloudflare Workers**(Netlify 아님 — vinext는 Workers 전용 빌드를 낸다).

## 방금 한 일
- `app/lib/rate-limit.ts` 신규 — IP당 하루 20회, 허용목록 IP는 무제한. KV 장애 시 fail-open
- `app/api/dream/route.ts` — Gemini 호출 **전에** 검사, 초과 시 429 + 한국어 안내
- `vite.config.ts` — `RATE_LIMIT` KV 바인딩 선언
- `tests/rate-limit.test.mjs` 신규 (7개) + `npm test`가 `tests/*.test.mjs` 전체를 돌도록 변경. 총 10개 통과
