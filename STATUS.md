# Dreamcore — 작업 현황

> 이 파일은 **항상 덮어쓴다.** 이력은 git에 있으니 여기에 로그를 쌓지 말 것.
> 작업을 시작하기 전에 읽고, 의미 있는 작업 단위가 끝나면 갱신한다.

- **마지막 갱신:** 2026-09-01 / Claude
- **브랜치:** main → `github.com/junbird206/dreamcore` (public)

## 지금 상태
Gemini 해몽 **실호출 검증 완료** (`mode=gemini`, 약 2~4초). 이미지 생성·레이트리밋 미구현.

## 방금 한 일
- 모델 교체: `gemini-2.5-flash`는 신규 사용자에게 404(단종). → **`gemini-3.5-flash`**
- Gemini 3.x는 `thinkingBudget`(숫자) 대신 `thinkingLevel`("low")을 받는다. 숫자 주면 400
- 후보 모델 실측: 3.5-flash+low = 4.4초(품질 우수) / 3.1-flash-lite = 1.7초(분위기 반영 약함) → 품질 선택
- 빌드된 워커에 실제 POST로 end-to-end 확인. lint/build/test 통과
