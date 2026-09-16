# Gemini 호출 프록시

Cloudflare 워커는 홍콩(HKG)에서 실행되는데 Gemini API가 홍콩을 지원하지 않아
모든 호출이 `400 User location is not supported`로 거부된다. 이 함수는
**서울 리전(`icn1`)에서 실행되며** 워커의 요청을 Gemini로 중계한다.

API 키는 이곳에만 있다. 워커는 이 함수의 주소와 토큰만 안다.

## 배포

```bash
cd proxy
npx vercel            # 최초 1회: 프로젝트 생성
npx vercel --prod     # 배포
```

## 필요한 환경변수 (Vercel 프로젝트 설정)

| 이름 | 값 |
|---|---|
| `GOOGLE_AI_API_KEY` | AI Studio에서 발급한 키 |
| `DREAMCORE_PROXY_TOKEN` | 워커와 공유하는 임의의 긴 문자열 |

## 워커 쪽에 등록할 값

```bash
npx wrangler secret put GEMINI_PROXY_URL    # https://<배포주소>/api/gemini
npx wrangler secret put GEMINI_PROXY_TOKEN  # 위와 같은 토큰
```

두 값이 모두 설정되면 워커는 프록시를 쓰고, 없으면 `GOOGLE_AI_API_KEY`로
직접 호출한다(로컬 개발용).

## 리전을 바꾸면 안 되는 이유

`vercel.json`의 `regions: ["icn1"]`이 이 프록시의 존재 이유다. 지원되지 않는
지역으로 옮기면 워커에서 겪던 문제가 그대로 재현된다.
