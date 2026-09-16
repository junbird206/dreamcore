# Dreamcore — 작업 현황

> 이 파일은 **항상 덮어쓴다.** 이력은 git에 있으니 여기에 로그를 쌓지 말 것.
> 작업을 시작하기 전에 읽고, 의미 있는 작업 단위가 끝나면 갱신한다.

- **마지막 갱신:** 2026-09-01 / Claude
- **브랜치:** main → `github.com/junbird206/dreamcore` (public)
- **배포:** https://dreamcore.junbird521.workers.dev (Cloudflare Workers)

## 지금 상태
**배포는 됐으나 AI 호출이 막혀 있다.** Gemini API가 Cloudflare 워커의 실행 위치(홍콩)를
지원하지 않아 모든 호출이 400 `FAILED_PRECONDITION`으로 거부된다.
`User location is not supported for the API use.`

- 워커 실행 colo: **HKG** (6회 연속 확인). 고려대 네트워크 → 홍콩으로 라우팅됨
- 같은 키로 맥(KR)에서 직접 호출하면 200. 키·코드·설정은 모두 정상
- Smart Placement(`placement: smart`)를 켜봤으나 위치가 바뀌지 않아 제거했다

## 방금 한 일
- **가짜 해몽 폴백 제거.** 실패 시 고정된 mock 결과를 돌려주던 동작을 없애고 503과
  안내 문구를 보낸다. 사용자는 자기 꿈이 해석된 줄 알지만 남의 꿈 이야기를 받게 되는데,
  API가 상시 차단된 지금 상황에서는 모든 방문자가 그 상태였다 — 빈 화면보다 나쁘다
- 되살아나지 않도록 테스트에 역검증(`doesNotMatch(/mock/i)`)을 넣었다
- Gemini/이미지 호출 실패 시 응답 **본문**까지 로깅한다. 상태코드만으로는 원인을
  알 수 없었고, 이 로그가 위치 제한을 찾아냈다
