# Dreamcore — 작업 현황

> 이 파일은 **항상 덮어쓴다.** 이력은 git에 있으니 여기에 로그를 쌓지 말 것.
> 작업을 시작하기 전에 읽고, 의미 있는 작업 단위가 끝나면 갱신한다.

- **마지막 갱신:** 2026-09-01 / Claude
- **브랜치:** main → `github.com/junbird206/dreamcore` (public)
- **배포:** https://dreamcore.junbird521.workers.dev (Cloudflare Workers)

## 지금 상태
**배포 완료, 라이브에서 해몽·이미지 모두 정상 동작.**
https://dreamcore.junbird521.workers.dev

호출 경로: 브라우저 → Cloudflare 워커(홍콩) → **Vercel 프록시(서울)** → Gemini

## 방금 한 일
- 서울 리전 프록시 배포: https://proxy-vert-rho-22.vercel.app/api/gemini
- 워커에 `GEMINI_PROXY_URL` / `GEMINI_PROXY_TOKEN` 시크릿 등록
- **워커에서 `GOOGLE_AI_API_KEY` 삭제.** 키는 이제 프록시에만 존재한다.
  워커에서 직접 호출하는 경로는 지역 제한 때문에 어차피 동작하지 않는다
- 배포판에서 해몽 3회·이미지 1회 연속 성공 확인 (우키요에 화풍 반영까지)
