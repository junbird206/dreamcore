export type DreamStyle =
  | "liminal"
  | "backrooms"
  | "weirdcore"
  | "analog-horror"
  | "dreamcore"
  | "surrealism"
  | "metaphysical"
  | "fairycore"
  | "cottagecore"
  | "impressionism"
  | "ukiyoe"
  | "vaporwave";

export type DreamResult = {
  title: string;
  insight: string;
  /** 꿈에서 읽히는 정서에 맞춘 한 줄 제안. 없으면 표시하지 않는다. */
  advice: string;
  symbols: string[];
  prompt: string;
  palette: string;
};

/**
 * 꿈 장면의 화풍.
 *
 * "예쁘게" 같은 추상어 대신 **이름이 붙은 미학**을 쓴다. 사람들은 자기 꿈의
 * 인상을 말로 옮기기 어려워하는데, 사조 이름 하나면 정확히 지정된다.
 * `prompt`는 이미지 모델에 그대로 넘어가는 영어 조각이다.
 */
export const styles: Array<{
  id: DreamStyle;
  label: string;
  hint: string;
  prompt: string;
}> = [
  {
    id: "liminal",
    label: "리미널 스페이스",
    hint: "아무도 없는 익숙한 공간",
    prompt:
      "Liminal space aesthetic: deserted familiar interior, fluorescent lighting, unsettling emptiness, wide symmetrical composition, nobody present.",
  },
  {
    id: "backrooms",
    label: "백룸",
    hint: "끝없는 누런 복도",
    prompt:
      "The Backrooms aesthetic: endless mono-yellow wallpapered rooms, damp carpet, buzzing fluorescent ceiling panels, claustrophobic repetition.",
  },
  {
    id: "weirdcore",
    label: "위어드코어",
    hint: "저화질로 왜곡된 향수",
    prompt:
      "Weirdcore aesthetic: low-resolution digital artifacting, oversaturated washed colors, dreamlike wrongness, early-2000s snapshot nostalgia.",
  },
  {
    id: "analog-horror",
    label: "아날로그 호러",
    hint: "VHS 노이즈, 불길함",
    prompt:
      "Analog horror aesthetic: degraded VHS tape look, scanlines and tracking distortion, heavy grain, washed contrast, ominous quiet dread.",
  },
  {
    id: "dreamcore",
    label: "드림코어",
    hint: "파스텔빛, 실내의 구름",
    prompt:
      "Dreamcore aesthetic: soft pastel palette, drifting clouds indoors, empty swimming-pool stillness, hazy glow, nostalgic and gently uncanny.",
  },
  {
    id: "surrealism",
    label: "초현실주의",
    hint: "중력을 잃은 사물들",
    prompt:
      "Surrealist painting: impossible juxtapositions, doors floating in a clouded sky, objects defying gravity, crisp realistic rendering of irrational scenes.",
  },
  {
    id: "metaphysical",
    label: "형이상학 회화",
    hint: "텅 빈 광장과 긴 그림자",
    prompt:
      "Metaphysical painting of the Scuola Metafisica movement: empty sunlit plaza, long dramatic shadows, classical arcades, mannequin-like stillness, ochre and deep green.",
  },
  {
    id: "fairycore",
    label: "페어리코어",
    hint: "빛나는 버섯과 반딧불",
    prompt:
      "Fairycore aesthetic: glowing mushrooms and wildflowers, fireflies, dappled emerald forest light, delicate whimsical enchantment.",
  },
  {
    id: "cottagecore",
    label: "코티지코어",
    hint: "포근한 시골집",
    prompt:
      "Cottagecore aesthetic: warm rural cosiness, soft natural daylight, floral textiles, wooden interiors, gentle pastoral safety.",
  },
  {
    id: "impressionism",
    label: "인상주의",
    hint: "번지는 빛의 붓질",
    prompt:
      "Impressionist oil painting: visible broken brushstrokes, luminous natural light, soft dissolving edges, plein-air colour vibration.",
  },
  {
    id: "ukiyoe",
    label: "우키요에",
    hint: "일본 목판화",
    prompt:
      "Ukiyo-e Japanese woodblock print: flat bold outlines, stylised cresting waves, limited indigo and ochre palette, visible paper texture.",
  },
  {
    id: "vaporwave",
    label: "베이퍼웨이브",
    hint: "90년대 네온과 격자",
    prompt:
      "Vaporwave aesthetic: 1990s pastel neon pink and cyan, chrome grid horizon, classical marble bust, VHS glow, retro-futurist mall nostalgia.",
  },
];

export function isDreamStyle(value: unknown): value is DreamStyle {
  return styles.some((style) => style.id === value);
}

export function findStyle(id: DreamStyle | null) {
  return styles.find((style) => style.id === id) ?? null;
}

