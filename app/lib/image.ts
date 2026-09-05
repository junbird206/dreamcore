/**
 * 꿈 장면 이미지 생성.
 *
 * 해몽 결과의 `prompt`를 그대로 입력으로 쓴다.
 * 실패하면 null을 반환한다 — 호출부는 이미지 없이 해몽만 보여준다.
 *
 * 주의: 이미지 모델은 Gemini API **무료 등급에서 제공되지 않는다.**
 * 결제(Tier 1)를 켜지 않으면 모든 호출이 즉시 429로 떨어진다.
 */

// TODO(결제 활성화 후): 후보 모델을 실측해서 확정할 것.
// 목록에 있는 후보: gemini-3.1-flash-image, gemini-2.5-flash-image,
// nano-banana-pro-preview, gemini-3-pro-image
const MODEL = "gemini-3.1-flash-image";
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

// 이미지 생성은 텍스트보다 오래 걸린다. 텍스트(15초)보다 넉넉히 잡는다.
const TIMEOUT_MS = 60_000;

export type DreamImage = {
  /** `data:image/png;base64,...` 형태. <img src>에 그대로 넣을 수 있다. */
  dataUri: string;
};

async function readApiKey(): Promise<string | null> {
  const fromProcess =
    typeof process !== "undefined" ? process.env?.GOOGLE_AI_API_KEY : undefined;

  if (fromProcess) {
    return fromProcess;
  }

  try {
    const { env } = await import("cloudflare:workers");
    const value = (env as Record<string, unknown> | undefined)
      ?.GOOGLE_AI_API_KEY;
    return typeof value === "string" && value ? value : null;
  } catch {
    return null;
  }
}

export async function generateDreamImage(
  prompt: string,
): Promise<DreamImage | null> {
  const apiKey = await readApiKey();

  if (!apiKey) {
    return null;
  }

  try {
    const response = await fetch(`${ENDPOINT}?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
      }),
    });

    if (!response.ok) {
      // 429는 대개 무료 등급이라 이미지 모델이 막힌 경우다.
      console.error(
        `[dreamcore] 이미지 생성 실패: ${response.status} ${response.statusText}`,
      );
      return null;
    }

    const payload = (await response.json()) as {
      candidates?: Array<{
        content?: {
          parts?: Array<{
            inlineData?: { mimeType?: string; data?: string };
          }>;
        };
      }>;
    };

    const inline = payload.candidates?.[0]?.content?.parts?.find(
      (part) => part.inlineData?.data,
    )?.inlineData;

    if (!inline?.data) {
      console.error("[dreamcore] 이미지 응답에 inlineData가 없습니다.");
      return null;
    }

    return {
      dataUri: `data:${inline.mimeType ?? "image/png"};base64,${inline.data}`,
    };
  } catch (error) {
    console.error("[dreamcore] 이미지 생성 중 오류:", error);
    return null;
  }
}
