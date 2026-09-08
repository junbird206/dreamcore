import type { DreamResult, DreamStyle } from "./dream";
import { findStyle } from "./dream";

const MODEL = "gemini-3.5-flash";
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;
const TIMEOUT_MS = 15_000;

// 해몽은 창작에 가까운 짧은 텍스트라 깊은 사고가 필요 없다.
// "low"에서 평균 4.4초 / 형식 준수 100%로 측정됨. 지연이 문제면 모델을
// gemini-3.1-flash-lite로 내리면 1.7초까지 떨어진다(대신 분위기 반영이 약함).
// Gemini 3.x는 thinkingBudget 대신 thinkingLevel을 받는다. 숫자를 넣으면 400.
const THINKING_LEVEL = "low";

const RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    title: { type: "STRING" },
    insight: { type: "STRING" },
    symbols: { type: "ARRAY", items: { type: "STRING" } },
    palette: { type: "STRING" },
    prompt: { type: "STRING" },
  },
  required: ["title", "insight", "symbols", "palette", "prompt"],
} as const;

const SYSTEM_INSTRUCTION = `당신은 꿈의 상징을 읽어주는 한국어 해몽가입니다.

규칙:
- 반드시 한국어로 답합니다.
- 점술이나 길흉 예언이 아니라, 꿈에 나온 상징을 심리적으로 읽어주는 자기성찰 콘텐츠로 씁니다.
- 단정하지 말고 "~처럼 읽힙니다", "~를 상징합니다" 같은 여지를 두는 어조를 씁니다.
- 질병, 죽음, 임신 여부 등을 예언하지 않습니다.
- 사용자를 불안하게 만드는 표현을 피합니다.

각 필드는 다음과 같이 채웁니다:
- title: 꿈의 핵심 이미지를 담은 시적인 한국어 제목. 12자 내외.
- insight: 꿈에 대한 해석. 한국어 2~3문장. 꿈에 실제로 등장한 소재를 반드시 언급합니다.
- symbols: 꿈에 나온 핵심 상징 3~5개. 각각 한두 단어의 한국어 명사.
- palette: 이 꿈의 분위기를 나타내는 색 3~4개. 영어 소문자 쉼표 구분 (예: "violet, deep green, moonlit silver").
- prompt: 이 꿈을 이미지로 생성하기 위한 영어 프롬프트. 꿈의 구체적 장면을 묘사하고 "No text in the image."로 끝냅니다.`;

function buildUserPrompt(dream: string, style: DreamStyle) {
  const selected = findStyle(style);

  return `다음은 사용자가 적은 꿈입니다.

"""
${dream.trim()}
"""

사용자가 고른 화풍: ${selected.label} (${selected.hint})
이미지 생성용 영어 지시: ${selected.prompt}

prompt 필드에는 위 영어 지시를 반드시 그대로 포함시키고, 꿈의 장면 묘사와
자연스럽게 이어 붙여 주세요. palette도 이 화풍에 맞게 정해주세요.
insight는 화풍이 아니라 **꿈 내용만** 보고 쓰세요 — 화풍은 사용자가 고른
표현 방식일 뿐 꿈에서 본 것이 아닙니다.`;
}

/**
 * Workers 런타임과 Node 양쪽에서 API 키를 읽는다.
 * `cloudflare:workers`는 Node에서 해석되지 않으므로 동적 import로 감싼다.
 */
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

function parseResult(raw: unknown): DreamResult | null {
  if (typeof raw !== "object" || raw === null) {
    return null;
  }

  const candidate = raw as Record<string, unknown>;
  const { title, insight, palette, prompt, symbols } = candidate;

  if (
    typeof title !== "string" ||
    typeof insight !== "string" ||
    typeof palette !== "string" ||
    typeof prompt !== "string" ||
    !Array.isArray(symbols)
  ) {
    return null;
  }

  const cleanSymbols = symbols
    .filter((symbol): symbol is string => typeof symbol === "string")
    .map((symbol) => symbol.trim())
    .filter(Boolean)
    .slice(0, 5);

  if (!title.trim() || !insight.trim() || cleanSymbols.length === 0) {
    return null;
  }

  return {
    title: title.trim(),
    insight: insight.trim(),
    symbols: cleanSymbols,
    palette: palette.trim(),
    prompt: prompt.trim(),
  };
}

/**
 * Gemini로 해몽을 생성한다.
 * 키가 없거나, 호출이 실패하거나, 응답 형태가 어긋나면 null을 반환한다.
 * 호출부는 null을 받으면 mock으로 폴백한다.
 */
export async function generateDreamResult(
  dream: string,
  style: DreamStyle,
): Promise<DreamResult | null> {
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
        systemInstruction: {
          parts: [{ text: SYSTEM_INSTRUCTION }],
        },
        contents: [
          {
            role: "user",
            parts: [{ text: buildUserPrompt(dream, style) }],
          },
        ],
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: RESPONSE_SCHEMA,
          temperature: 1,
          thinkingConfig: { thinkingLevel: THINKING_LEVEL },
        },
      }),
    });

    if (!response.ok) {
      console.error(
        `[dreamcore] Gemini 응답 실패: ${response.status} ${response.statusText}`,
      );
      return null;
    }

    const payload = (await response.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    const text = payload.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!text) {
      console.error("[dreamcore] Gemini 응답에 텍스트가 없습니다.");
      return null;
    }

    const parsed = parseResult(JSON.parse(text));

    if (!parsed) {
      console.error("[dreamcore] Gemini 응답 형식이 예상과 다릅니다.");
    }

    return parsed;
  } catch (error) {
    console.error("[dreamcore] Gemini 호출 중 오류:", error);
    return null;
  }
}
