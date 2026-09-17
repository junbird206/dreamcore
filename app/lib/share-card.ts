import type { DreamResult } from "./dream";

/**
 * 공유 카드를 canvas로 그려 PNG Blob으로 돌려준다.
 *
 * SVG로 만들면 인스타그램·카카오톡이 받아주지 않고 휴대폰에서 미리보기도
 * 뜨지 않는다. 공유가 유입 경로인 서비스라 PNG여야 한다.
 */

const WIDTH = 1080;
const HEIGHT = 1350;
const PAD = 88;

const FONT_STACK =
  '-apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", "Malgun Gothic", "Noto Sans KR", sans-serif';

function loadImage(src: string) {
  return new Promise<HTMLImageElement | null>((resolve) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = src;
  });
}

/** 비율을 유지한 채 캔버스를 가득 채우도록 잘라 그린다(object-fit: cover). */
function drawCover(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
) {
  const scale = Math.max(WIDTH / image.width, HEIGHT / image.height);
  const w = image.width * scale;
  const h = image.height * scale;
  ctx.drawImage(image, (WIDTH - w) / 2, (HEIGHT - h) / 2, w, h);
}

/** 이미지가 없을 때 쓰는 기본 배경. 기존 카드의 인상을 유지한다. */
function drawFallbackBackground(ctx: CanvasRenderingContext2D) {
  const sky = ctx.createLinearGradient(0, 0, WIDTH, HEIGHT);
  sky.addColorStop(0, "#101315");
  sky.addColorStop(0.48, "#236559");
  sky.addColorStop(1, "#b98756");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  ctx.fillStyle = "#f8eaa7";
  ctx.beginPath();
  ctx.arc(780, 300, 104, 0, Math.PI * 2);
  ctx.fill();

  ctx.globalAlpha = 0.14;
  ctx.beginPath();
  ctx.arc(780, 300, 146, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
}

/**
 * 한국어는 띄어쓰기가 드물어 단어 단위로 자르면 줄이 넘친다.
 * 실제 렌더 폭을 재서 글자 단위로 접는다.
 */
function wrapByWidth(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines: number,
) {
  const lines: string[] = [];
  let current = "";

  for (const char of text) {
    // 줄바꿈이 공백에서 일어나면 다음 줄이 공백으로 시작해 한 칸 밀려 보인다.
    if (!current && char === " ") {
      continue;
    }

    const next = current + char;

    if (ctx.measureText(next).width > maxWidth && current) {
      lines.push(current);
      current = char === " " ? "" : char;

      if (lines.length === maxLines) {
        break;
      }
      continue;
    }

    current = next;
  }

  if (lines.length < maxLines && current) {
    lines.push(current);
  }

  // 잘렸으면 마지막 줄에 말줄임을 붙인다.
  if (lines.length === maxLines) {
    const last = lines[maxLines - 1];
    const consumed = lines.join("").length;
    if (consumed < text.length) {
      lines[maxLines - 1] = `${last.slice(0, -1)}…`;
    }
  }

  return lines;
}

export async function renderShareCard(
  result: DreamResult,
  imageDataUri: string | null,
): Promise<Blob | null> {
  const canvas = document.createElement("canvas");
  canvas.width = WIDTH;
  canvas.height = HEIGHT;

  const ctx = canvas.getContext("2d");

  if (!ctx) {
    return null;
  }

  const image = imageDataUri ? await loadImage(imageDataUri) : null;

  if (image) {
    drawCover(ctx, image);
  } else {
    drawFallbackBackground(ctx);
  }

  // 아래쪽 텍스트가 어떤 이미지 위에서도 읽히도록 어둡게 깐다.
  const scrim = ctx.createLinearGradient(0, HEIGHT * 0.32, 0, HEIGHT);
  scrim.addColorStop(0, "rgba(6, 10, 12, 0)");
  scrim.addColorStop(0.45, "rgba(6, 10, 12, 0.72)");
  scrim.addColorStop(1, "rgba(6, 10, 12, 0.94)");
  ctx.fillStyle = scrim;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // 상단 워드마크
  ctx.font = `700 30px ${FONT_STACK}`;
  ctx.fillStyle = "#9ee4d6";
  ctx.letterSpacing = "6px";
  ctx.fillText("DREAMCORE", PAD, PAD + 34);
  ctx.letterSpacing = "0px";

  const maxWidth = WIDTH - PAD * 2;
  let y = HEIGHT - PAD;

  // 아래에서 위로 쌓는다. 푸터 → 상징 → 해몽 → 제목 순.
  // 공유된 카드를 본 사람이 찾아올 수 있어야 한다. 이전 문구는 서비스를
  // 설명하기만 하고 목적지를 알려주지 않았다.
  // 주소는 하드코딩하지 않는다 — 커스텀 도메인을 붙여도 그대로 따라간다.
  const host =
    typeof window !== "undefined" ? window.location.host : "dreamcore";
  ctx.font = `600 26px ${FONT_STACK}`;
  ctx.fillStyle = "rgba(255, 255, 255, 0.86)";
  ctx.fillText(`내 꿈도 해몽해보기: ${host}`, PAD, y);
  y -= 58;

  ctx.font = `700 30px ${FONT_STACK}`;
  ctx.fillStyle = "#9ee4d6";
  ctx.fillText(
    result.symbols.map((symbol) => `#${symbol}`).join("  "),
    PAD,
    y,
  );
  y -= 62;

  ctx.font = `500 34px ${FONT_STACK}`;
  const insightLines = wrapByWidth(ctx, result.insight, maxWidth, 4);
  ctx.fillStyle = "#f4efe6";
  for (let i = insightLines.length - 1; i >= 0; i -= 1) {
    ctx.fillText(insightLines[i], PAD, y);
    y -= 50;
  }
  y -= 22;

  ctx.font = `800 74px ${FONT_STACK}`;
  const titleLines = wrapByWidth(ctx, result.title, maxWidth, 2);
  ctx.fillStyle = "#ffffff";
  for (let i = titleLines.length - 1; i >= 0; i -= 1) {
    ctx.fillText(titleLines[i], PAD, y);
    y -= 86;
  }

  // 배경이 사진이라 PNG는 2MB가 넘는다. JPEG로 뽑아야 공유가 가볍다.
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), "image/jpeg", 0.92);
  });
}
