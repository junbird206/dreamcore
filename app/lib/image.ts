/**
 * 꿈 장면 이미지 생성.
 *
 * 해몽 결과의 `prompt`를 그대로 입력으로 쓴다.
 * 실패하면 null을 반환한다 — 호출부는 이미지 없이 해몽만 보여준다.
 *
 * 주의: 이미지 모델은 Gemini API **무료 등급에서 제공되지 않는다.**
 * 결제(Tier 1)가 아니면 모든 호출이 즉시 429로 떨어진다.
 */

// 후보 3종을 같은 프롬프트로 실측해서 고른 값(2026-09-06).
//   lite  3.3초 / 47원   ← 채택
//   flash 11.8초 / 94원  (No text 지시를 어기고 벽에 룬 문자를 그림)
//   pro   18.9초 / 188원 (가장 깔끔하지만 표시 크기 230px에서는 차이가 거의 안 보임)
// 해몽 텍스트가 4초라 lite여야 총 대기가 7초로 끝난다. pro면 23초다.
// 이미지를 크게 보여주게 되면 그때 pro로 올릴 것.
const MODEL = "gemini-3.1-flash-lite-image";
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
        // 기본값은 1408x768 가로형인데 표시 타일은 세로형이라 절반이 잘린다.
        // 3:4(896x1200)로 뽑아야 잘림 없이 다 보이고, 공유 카드(1080x1350)와도 맞는다.
        generationConfig: { imageConfig: { aspectRatio: "3:4" } },
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
