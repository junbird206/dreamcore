import type { DreamResult, DreamStyle } from "./dream";
import { findStyle } from "./dream";
import { callGemini } from "./gemini-call";

const MODEL = "gemini-3.5-flash";
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
    advice: { type: "STRING" },
    symbols: { type: "ARRAY", items: { type: "STRING" } },
    palette: { type: "STRING" },
    prompt: { type: "STRING" },
  },
  required: ["title", "insight", "advice", "symbols", "palette", "prompt"],
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
- advice: 꿈에서 읽히는 정서를 짚고, **그 정서에 빠져 있을 때 놓치기 쉬운 것**을
  짚어주는 한 문장. 기분에 맞장구치는 말은 쓰지 마세요.
  정서별로 방향은 다음과 같습니다(문장은 꿈 내용에 맞게 매번 새로 쓸 것):
  · 불안·압박 → 부담을 덜어주거나, 통제할 수 있는 작은 범위로 시선을 좁히기
  · 기쁨·들뜸 → 휩쓸리지 않게 중심을 잡아주기. 큰 결정을 미루라는 말 외에도
    이 기분의 출처를 기억해두기, 좋을 때 해두면 좋은 준비, 함께한 사람에게
    표현하기 등 상황에 맞는 다른 방향을 찾으세요
  · 상실·슬픔 → 빨리 괜찮아지려 애쓰지 않아도 된다는 허락
  · 분노·억울함 → 즉각 반응을 늦추고 사실과 감정을 분리해보기
  · 평온·충만 → 지금의 상태를 유지시키는 구체적인 습관 하나

  **위 설명을 그대로 옮겨 쓰지 말고, 이 꿈에만 맞는 문장을 새로 쓰세요.**
  단정적인 심리 진단이나 의학적 조언은 금지입니다. "당신은 ~입니다"가 아니라
  "~느껴진다면 ~해보세요" 형태로 씁니다.
  **반드시 45자 이내로 짧게 쓰세요.** 길면 읽히지 않습니다. 수식어를 덜어내고
  핵심 제안만 남기세요.
- symbols: 꿈에 나온 핵심 상징 3~5개. 각각 한두 단어의 한국어 명사.
- palette: 이 꿈의 분위기를 나타내는 색 3~4개. 영어 소문자 쉼표 구분 (예: "violet, deep green, moonlit silver").
- prompt: 이 꿈을 이미지로 생성하기 위한 영어 프롬프트. 꿈에 나온 장면을 구체적으로
  묘사하는 것이 중심이고, 화풍은 맨 뒤에 짧게만 덧붙입니다. "No text in the image."로 끝냅니다.`;

function buildUserPrompt(dream: string, style: DreamStyle | null) {
  const selected = findStyle(style);
  const styleSection = selected
    ? `사용자가 고른 화풍(참고용): ${selected.label} (${selected.hint})
화풍 영어 표현: ${selected.prompt}`
    : `사용자가 화풍을 고르지 않았습니다. 꿈의 내용과 정서에 가장 어울리는
화풍을 직접 골라 prompt에 반영하세요.`;

  return `다음은 사용자가 적은 꿈입니다.

"""
${dream.trim()}
"""

${styleSection}

prompt 필드 작성 규칙:
1. **꿈의 내용이 주제입니다.** 꿈에 실제로 나온 장소·사물·인물·행동·색을
   구체적으로 묘사하는 데 분량의 대부분을 쓰세요.
2. 화풍은 **맨 뒤에 한 문장으로만** 덧붙이세요. 화풍은 "무엇을 그릴지"가 아니라
   "어떻게 그릴지"입니다.
3. 화풍 때문에 **꿈에 없던 소재를 절대 넣지 마세요.** 예를 들어 바닷가 꿈에
   백룸 화풍을 골랐다면, 노란 사무실을 등장시키는 게 아니라 그 바닷가를
   백룸 특유의 형광등·낡은 질감·불안한 공허함으로 그려야 합니다.
4. "No text in the image."로 끝내세요.

palette는 꿈의 장면에서 자연스럽게 나오는 색을 우선하고 화풍을 참고만 하세요.
insight는 화풍이 아니라 **꿈 내용만** 보고 쓰세요 — 화풍은 사용자가 고른
표현 방식일 뿐 꿈에서 본 것이 아닙니다.`;
}

/**
 * Workers 런타임과 Node 양쪽에서 API 키를 읽는다.
 * `cloudflare:workers`는 Node에서 해석되지 않으므로 동적 import로 감싼다.
 */
function parseResult(raw: unknown): DreamResult | null {
  if (typeof raw !== "object" || raw === null) {
    return null;
  }

  const candidate = raw as Record<string, unknown>;
  const { title, insight, advice, palette, prompt, symbols } = candidate;

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
    // 조언이 빠져도 해몽 전체를 버리지 않는다. 없으면 표시하지 않는다.
    advice: typeof advice === "string" ? advice.trim() : "",
    symbols: cleanSymbols,
    palette: palette.trim(),
    prompt: prompt.trim(),
  };
}

/**
 * Gemini로 해몽을 생성한다.
 * 키가 없거나, 호출이 실패하거나, 응답 형태가 어긋나면 null을 반환한다.
 * 호출부는 null을 받으면 사용자에게 실패를 알린다.
 */
export async function generateDreamResult(
  dream: string,
  style: DreamStyle | null,
): Promise<DreamResult | null> {
  try {
    const response = await callGemini(
      MODEL,
      {
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
      },
      TIMEOUT_MS,
    );

    if (!response) {
      return null;
    }

    if (!response.ok) {
      // 상태코드만으로는 원인을 알 수 없다. 본문에 실제 사유가 들어있다.
      const detail = await response.text().catch(() => "");
      console.error(
        `[dreamcore] Gemini 응답 실패: ${response.status} ${response.statusText} ${detail.slice(0, 500)}`,
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
