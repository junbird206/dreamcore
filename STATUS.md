# Dreamcore — 작업 현황

> 이 파일은 **항상 덮어쓴다.** 이력은 git에 있으니 여기에 로그를 쌓지 말 것.
> 작업을 시작하기 전에 읽고, 의미 있는 작업 단위가 끝나면 갱신한다.

- **마지막 갱신:** 2026-09-01 / Claude
- **브랜치:** main → `github.com/junbird206/dreamcore` (public)
- **배포:** https://dreamcore.junbird521.workers.dev (Cloudflare Workers)

## 지금 상태
**배포 완료. 라이브에서 해몽·이미지·GA·쿠키 전부 동작 확인.**
https://dreamcore.junbird521.workers.dev

## 방금 한 일
- GA4 측정 ID `G-Z2ECYF1JSD`를 `.env`에 넣고 빌드 → 번들에 박힌 것 확인
- Cloudflare Workers 배포. `wrangler secret put GOOGLE_AI_API_KEY`로 서버 키 등록
- 라이브 검증: 해몽 3.7초(`mode: gemini`) / 이미지 4.7초(896x1200) / `dc_bid` 쿠키 / GA·sign-up URL 번들 포함
