# Dreamcore — 에이전트 작업 규약

이 저장소는 **여러 AI 에이전트가 공동으로** 개발한다. 아래 규약을 지킬 것.

## 1. STATUS.md 규약 (필수)

- **작업 시작 전:** `STATUS.md`를 먼저 읽는다. 다른 에이전트가 남긴 현재 상태·다음 스텝·잠금이 거기 있다.
- **작업 후:** 의미 있는 작업 단위가 끝나면 `STATUS.md`를 **통째로 덮어쓴다.**
  - 갱신 시점 = 기능 하나를 붙였을 때 / 테스트가 통과했을 때 / 막혀서 손을 뗄 때
  - 갱신 시점 아님 = 파일 하나 읽었을 때, 한 줄 고쳤을 때
- **append 금지.** 섹션 구조와 분량(40줄 내외)을 유지한다. 이력은 git이 가진다.
- 갱신할 때 `마지막 갱신` 줄에 날짜와 **본인 이름(Claude / Codex 등)**을 적는다.
- 장시간 한 파일을 붙잡는 작업은 `진행 중 / 잠금`에 파일 경로를 적어 충돌을 막는다.

## 2. 프로젝트 사실

- **Dreamcore** — 꿈을 적으면 AI가 해몽하고 꿈속 장면을 이미지로 만들어주는 한국어 웹앱.
- 프레임워크는 Next.js가 아니라 **vinext** (Vite + Cloudflare Workers 위의 App Router 호환 런타임). Next.js 전용 기능을 가정하지 말 것.
- 실제 코드는 `app/page.tsx`, `app/DreamLab.tsx`, `app/lib/dream.ts`, `app/api/dream/route.ts` 4개가 거의 전부.
- `README.md`는 `vinext-starter` 스타터 원문이다. 프로젝트 설명으로 읽지 말 것.
- 사용자 노출 문구는 전부 **한국어**.

## 3. 검증

- `npm run build` — 빌드 확인
- `npm test` — 빌드 후 SSR HTML 검증 (`tests/rendered-html.test.mjs`)
- `npm run lint`

UI 문구를 바꾸면 `tests/rendered-html.test.mjs`가 해당 문자열을 검사하고 있는지 확인할 것.
