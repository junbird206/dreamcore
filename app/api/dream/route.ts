import { createMockResult, isDreamMood } from "../../lib/dream";

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

    return Response.json({
      mode: "mock",
      result: createMockResult(dream, mood),
    });
  } catch {
    return Response.json(
      { error: "꿈을 분석하지 못했습니다. 잠시 후 다시 시도해주세요." },
      { status: 500 },
    );
  }
}
