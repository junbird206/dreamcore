import { createMockResult, isDreamMood } from "../../lib/dream";
import { generateDreamResult } from "../../lib/gemini";

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as {
      dream?: string;
      mood?: unknown;
    };
    const dream = payload.dream?.trim() ?? "";
    const mood = isDreamMood(payload.mood) ? payload.mood : "mystic";

    if (dream.length < 20) {
      return Response.json(
        { error: "꿈 내용을 조금 더 자세히 적어주세요." },
        { status: 400 },
      );
    }

    // 키가 없거나 호출이 실패하면 null이 온다. 사용자에게 에러를 띄우는 대신
    // mock 결과로 조용히 폴백한다 — 화면이 비는 편이 손해가 크다.
    const generated = await generateDreamResult(dream, mood);

    return Response.json(
      generated
        ? { mode: "gemini", result: generated }
        : { mode: "mock", result: createMockResult(dream, mood) },
    );
  } catch {
    return Response.json(
      { error: "꿈을 분석하지 못했습니다. 잠시 후 다시 시도해주세요." },
      { status: 500 },
    );
  }
}
