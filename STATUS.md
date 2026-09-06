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
- 공유 카드를 canvas 기반 **JPEG**로 교체하고 생성 이미지를 배경으로 깔았다.
  SVG는 인스타·카톡이 못 받아 공유 경로가 막혀 있었다. 2,088KB → 239KB
- 공유하기가 `canShare`로 파일 지원을 확인해 이미지를 첨부한다(모바일에서 인스타로 바로)
- **음성 입력 추가** (`app/lib/speech.ts`, Web Speech API, `ko-KR`).
  미지원 브라우저(Firefox)에서는 버튼이 숨는다. 침묵으로 끊기면 자동 재시작
