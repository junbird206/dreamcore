import { generateDreamImage } from "../../../lib/image";
import { checkRateLimit } from "../../../lib/rate-limit";

/**
 * 해몽과 분리된 엔드포인트다. 텍스트를 먼저 보여주고 이미지를 뒤이어
 * 채우기 위해 나눠 두었다 — 한 번에 묶으면 사용자가 20초 넘게 빈 화면을 본다.
 */
export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as { prompt?: string };
    const prompt = payload.prompt?.trim() ?? "";

    if (!prompt) {
      return Response.json(
        { error: "이미지를 만들 프롬프트가 없습니다." },
        { status: 400 },
      );
    }

    const verdict = await checkRateLimit(request, "image");
    const headers = verdict.setCookie
      ? { "Set-Cookie": verdict.setCookie }
      : undefined;

    if (!verdict.allowed) {
      return Response.json(
        { error: "오늘의 이미지 생성 횟수를 모두 사용했어요." },
        { status: 429, headers },
      );
    }

    const image = await generateDreamImage(prompt);

    if (!image) {
      return Response.json(
        { error: "지금은 이미지를 만들 수 없어요." },
        { status: 503, headers },
      );
    }

    return Response.json({ image: image.dataUri }, { headers });
  } catch {
    return Response.json(
      { error: "이미지를 만들지 못했습니다. 잠시 후 다시 시도해주세요." },
      { status: 500 },
    );
  }
}
