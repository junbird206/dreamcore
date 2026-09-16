/**
 * Gemini 호출 경로.
 *
 * Cloudflare 워커는 홍콩(HKG)에서 실행되는데 Gemini API가 홍콩을 지원하지 않아
 * 모든 호출이 400 `User location is not supported`로 거부된다. 그래서 배포
 * 환경에서는 지원 지역(서울)에 둔 프록시를 거쳐 호출한다.
 *
 * 프록시 주소가 설정돼 있으면 프록시로, 없으면 키로 직접 호출한다.
 * 덕분에 로컬 개발은 프록시 없이도 그대로 동작한다.
 */

const DIRECT_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";

type Env = {
  GOOGLE_AI_API_KEY?: string;
  GEMINI_PROXY_URL?: string;
  GEMINI_PROXY_TOKEN?: string;
};

async function readEnv(): Promise<Env> {
  const fromProcess: Env =
    typeof process !== "undefined" && process.env
      ? {
          GOOGLE_AI_API_KEY: process.env.GOOGLE_AI_API_KEY,
          GEMINI_PROXY_URL: process.env.GEMINI_PROXY_URL,
          GEMINI_PROXY_TOKEN: process.env.GEMINI_PROXY_TOKEN,
        }
      : {};

  try {
    const { env } = await import("cloudflare:workers");
    const worker = env as Env;
    return {
      GOOGLE_AI_API_KEY:
        fromProcess.GOOGLE_AI_API_KEY || worker?.GOOGLE_AI_API_KEY,
      GEMINI_PROXY_URL:
        fromProcess.GEMINI_PROXY_URL || worker?.GEMINI_PROXY_URL,
      GEMINI_PROXY_TOKEN:
        fromProcess.GEMINI_PROXY_TOKEN || worker?.GEMINI_PROXY_TOKEN,
    };
  } catch {
    return fromProcess;
  }
}

/**
 * 모델을 호출하고 응답을 그대로 돌려준다.
 * 호출 경로 자체를 구성할 수 없으면(키도 프록시도 없음) null.
 */
export async function callGemini(
  model: string,
  payload: unknown,
  timeoutMs: number,
): Promise<Response | null> {
  const env = await readEnv();
  const body = JSON.stringify(payload);
  const signal = AbortSignal.timeout(timeoutMs);

  if (env.GEMINI_PROXY_URL && env.GEMINI_PROXY_TOKEN) {
    return fetch(env.GEMINI_PROXY_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-dreamcore-token": env.GEMINI_PROXY_TOKEN,
      },
      signal,
      body: JSON.stringify({ model, payload }),
    });
  }

  if (env.GOOGLE_AI_API_KEY) {
    return fetch(
      `${DIRECT_ENDPOINT}/${model}:generateContent?key=${env.GOOGLE_AI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal,
        body,
      },
    );
  }

  console.error(
    "[dreamcore] 호출 경로가 없습니다 — GEMINI_PROXY_URL 또는 GOOGLE_AI_API_KEY 필요",
  );
  return null;
}
