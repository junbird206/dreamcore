/**
 * Gemini 호출 중계.
 *
 * Cloudflare 워커는 홍콩에서 실행되는데 Gemini API가 홍콩을 지원하지 않는다
 * (400 `User location is not supported`). 이 함수는 지원 지역(서울)에서
 * 실행되며, 워커의 요청을 받아 Gemini로 넘기고 응답을 그대로 돌려준다.
 *
 * API 키는 여기에만 존재한다. 워커는 이 함수의 주소와 토큰만 안다.
 */

// 토큰이 새더라도 임의의 모델을 호출당하지 않도록 허용 목록을 둔다.
const ALLOWED_MODELS = new Set([
  "gemini-3.5-flash",
  "gemini-3.1-flash-lite-image",
]);

const ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";

export default async function handler(request, response) {
  if (request.method !== "POST") {
    return response.status(405).json({ error: "POST만 허용됩니다." });
  }

  const expected = process.env.DREAMCORE_PROXY_TOKEN;
  const apiKey = process.env.GOOGLE_AI_API_KEY;

  if (!expected || !apiKey) {
    console.error("환경변수 누락: DREAMCORE_PROXY_TOKEN, GOOGLE_AI_API_KEY");
    return response.status(500).json({ error: "프록시가 설정되지 않았습니다." });
  }

  if (request.headers["x-dreamcore-token"] !== expected) {
    return response.status(401).json({ error: "인증되지 않은 요청입니다." });
  }

  const { model, payload } = request.body ?? {};

  if (!ALLOWED_MODELS.has(model)) {
    return response.status(400).json({ error: `허용되지 않은 모델: ${model}` });
  }

  try {
    const upstream = await fetch(
      `${ENDPOINT}/${model}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(60_000),
      },
    );

    // 상태와 본문을 그대로 전달한다. 워커가 실패 사유를 로깅할 수 있어야 한다.
    const text = await upstream.text();
    response.status(upstream.status);
    response.setHeader("Content-Type", "application/json; charset=utf-8");
    return response.send(text);
  } catch (error) {
    console.error("Gemini 호출 실패:", error);
    return response.status(502).json({ error: "Gemini 호출에 실패했습니다." });
  }
}
