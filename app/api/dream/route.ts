import { isDreamStyle } from "../../lib/dream";
import { generateDreamResult } from "../../lib/gemini";
import { checkRateLimit } from "../../lib/rate-limit";

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as {
      dream?: string;
      style?: unknown;
    };
    const dream = payload.dream?.trim() ?? "";
    // 화풍은 선택 사항이다. 고르지 않으면 모델이 꿈에 맞춰 정한다.
    const style = isDreamStyle(payload.style) ? payload.style : null;

    if (dream.length < 20) {
      return Response.json(
        { error: "꿈 내용을 조금 더 자세히 적어주세요." },
        { status: 400 },
      );
    }

    // Gemini를 호출하기 전에 확인한다. 이미지 생성이 붙으면 1건당 비용이
    // 40배가 되므로 이 가드가 결제 방어선이 된다.
    const verdict = await checkRateLimit(request, "dream");

    // 새 브라우저에는 식별 쿠키를 내려준다. 차단 응답에도 실어야
    // 다음 요청부터 같은 브라우저로 세어진다.
    const headers = verdict.setCookie
      ? { "Set-Cookie": verdict.setCookie }
      : undefined;

    if (!verdict.allowed) {
      return Response.json(
        { error: "오늘의 해몽 횟수를 모두 사용했어요. 내일 다시 만나요." },
        { status: 429, headers },
      );
    }

    const generated = await generateDreamResult(dream, style);

    // 실패 시 고정된 가짜 해몽을 돌려주던 폴백을 제거했다. 사용자는 자기 꿈이
    // 해석된 줄 알지만 실제로는 남의 꿈 이야기를 받게 된다 — 빈 화면보다 나쁘다.
    if (!generated) {
      return Response.json(
        { error: "지금은 해몽을 만들 수 없어요. 잠시 후 다시 시도해주세요." },
        { status: 503, headers },
      );
    }

    return Response.json({ mode: "gemini", result: generated }, { headers });
  } catch {
    return Response.json(
      { error: "꿈을 분석하지 못했습니다. 잠시 후 다시 시도해주세요." },
      { status: 500 },
    );
  }
}
