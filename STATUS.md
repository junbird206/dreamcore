# Dreamcore — 작업 현황

> 이 파일은 **항상 덮어쓴다.** 이력은 git에 있으니 여기에 로그를 쌓지 말 것.
> 작업을 시작하기 전에 읽고, 의미 있는 작업 단위가 끝나면 갱신한다.

- **마지막 갱신:** 2026-09-01 / Claude
- **브랜치:** main → `github.com/junbird206/dreamcore` (public)

## 지금 상태
Gemini 해몽 검증 완료 + 레이트리밋 구현 완료. **아직 배포 안 됨.** 배포 대상은 **Cloudflare Workers**(Netlify 아님 — vinext는 Workers 전용 빌드를 낸다).

## 방금 한 일
- 레이트리밋을 **2겹**으로 재설계: 쿠키 기준 브라우저당 20회(주 방어선) + IP당 200회(스크립트 천장)
  - IP만으로 세면 국내 이통사 CGNAT·캠퍼스 NAT 때문에 진짜 유저가 차단된다
- 새 브라우저에 `dc_bid` 쿠키 발급(HttpOnly/Secure/SameSite=Lax). 차단 응답에도 실어 보낸다
- 테스트 14개 통과 (레이트리밋 11개)
