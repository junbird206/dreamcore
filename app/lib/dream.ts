export type DreamMood = "mystic" | "warm" | "uneasy" | "cinematic";

export type DreamResult = {
  title: string;
  insight: string;
  symbols: string[];
  prompt: string;
  palette: string;
};

export const moods: Array<{
  id: DreamMood;
  label: string;
  description: string;
}> = [
  {
    id: "mystic",
    label: "몽환적",
    description: "안개, 달빛, 느린 초현실감",
  },
  {
    id: "warm",
    label: "따뜻한",
    description: "새벽빛, 부드러운 색, 회복감",
  },
  {
    id: "uneasy",
    label: "불안한",
    description: "낯선 복도, 긴장, 흐린 경계",
  },
  {
    id: "cinematic",
    label: "영화 같은",
    description: "강한 구도, 빛과 그림자, 드라마",
  },
];

export const starterDream =
  "낯선 캠퍼스의 긴 복도를 걷고 있었는데, 강의실 문을 열 때마다 바다가 보였어요. 마지막 문 뒤에는 어릴 때 살던 방이 있었고, 창밖에는 아주 큰 달이 떠 있었습니다.";

export function isDreamMood(value: unknown): value is DreamMood {
  return moods.some((mood) => mood.id === value);
}

export function createMockResult(dream: string, mood: DreamMood): DreamResult {
  const compact = dream.trim().replace(/\s+/g, " ");
  const titleMap: Record<DreamMood, string> = {
    mystic: "문 너머의 달빛",
    warm: "돌아갈 수 있는 방",
    uneasy: "길어진 복도와 닫히지 않는 문",
    cinematic: "캠퍼스 끝의 바다",
  };

  const paletteMap: Record<DreamMood, string> = {
    mystic: "violet, deep green, moonlit silver",
    warm: "apricot, soft blue, candle white",
    uneasy: "graphite, sea fog, muted red",
    cinematic: "teal, amber, black, pearl",
  };

  const insightMap: Record<DreamMood, string> = {
    mystic:
      "이 꿈은 지금의 당신이 익숙한 생활권 안에서 새로운 가능성의 문을 찾고 있다는 신호처럼 읽힙니다. 반복되는 문은 선택지를, 달빛은 아직 말로 정리되지 않은 직감을 상징합니다.",
    warm:
      "이 꿈은 바쁜 변화 속에서도 돌아갈 수 있는 내면의 기준을 찾는 장면처럼 보입니다. 오래된 방은 안정감을, 바다는 넓어진 선택지를 상징합니다.",
    uneasy:
      "이 꿈은 해야 할 일과 가고 싶은 방향 사이의 압박을 은유하는 듯합니다. 긴 복도는 지연된 결정을, 낯선 문은 아직 확인하지 못한 기회를 나타냅니다.",
    cinematic:
      "이 꿈은 일상의 무대가 더 큰 이야기로 확장되는 순간을 보여줍니다. 캠퍼스와 바다가 겹치는 장면은 배움, 이동, 독립의 욕구가 동시에 커지고 있음을 암시합니다.",
  };

  return {
    title: titleMap[mood],
    insight: insightMap[mood],
    symbols: ["문", "바다", "달", "익숙한 방"],
    palette: paletteMap[mood],
    prompt: `Create a highly detailed dreamlike image based on this Korean dream: "${compact}". Mood: ${mood}. Visual language: surreal campus corridor, doors opening into an ocean, childhood bedroom, oversized moon outside the window, atmospheric light, ${paletteMap[mood]}. No text in the image.`,
  };
}
