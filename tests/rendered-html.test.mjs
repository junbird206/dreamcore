import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const projectRoot = new URL("../", import.meta.url);

async function request(path = "/", init = {}) {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request(`http://localhost${path}`, init),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("server-renders the Dreamcore MVP shell", async () => {
  const response = await request("/", {
    headers: { accept: "text/html" },
  });
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>Dreamcore<\/title>/i);
  assert.match(html, />Dreamcore</);
  // 입력 → 화풍 → CTA 순서가 랜딩의 뼈대다
  assert.match(html, /꿈에서 본 장소, 사람, 색/);
  assert.match(html, /꿈의 화풍 고르기/);
  assert.match(html, /리미널 스페이스/);
  assert.match(html, /내 꿈속 장면 생성하기 &amp; 해몽 듣기/);
  assert.doesNotMatch(html, /codex-preview|react-loading-skeleton/i);
  // 개발 중 문구와 내부 KPI가 다시 새어나오지 않는지 지킨다
  assert.doesNotMatch(html, /Mock 모드|API 키 없이/);
  assert.doesNotMatch(html, /방문 목표|sign-up 목표|전환 기준/);
});

test("keeps starter preview code removed", async () => {
  const [page, layout, dreamLab, dreamLib, dreamRoute, packageJson] =
    await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/DreamLab.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/lib/dream.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/dream/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
  ]);

  assert.match(page, /<DreamLab \/>/);
  assert.match(layout, /title:\s*"Dreamcore"/);
  assert.match(dreamLib, /export const styles/);
  assert.match(dreamRoute, /export async function POST/);
  // 실패 시 고정된 가짜 해몽을 돌려주던 폴백이 되살아나지 않도록 지킨다
  assert.doesNotMatch(dreamLib, /createMockResult/);
  assert.doesNotMatch(dreamRoute, /mock/i);
  assert.match(dreamLab, /NEXT_PUBLIC_SIGNUP_URL/);
  assert.match(dreamLab, /NEXT_PUBLIC_GA_MEASUREMENT_ID/);
  assert.match(dreamLab, /analytics_ready/);
  assert.match(dreamLab, /window\.gtag/);
  assert.match(dreamLab, /handleNativeShare/);
  assert.match(dreamLab, /handleDownloadCard/);
  assert.match(dreamLab, /share_copied/);
  assert.match(dreamLab, /image_downloaded/);
  assert.doesNotMatch(page, /SkeletonPreview|codex-preview/);
  assert.doesNotMatch(layout, /Starter Project|codex-preview|_sites-preview/);
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);

  await assert.rejects(access(new URL("app/_sites-preview", projectRoot)));
});

test("API 키가 없으면 가짜 해몽 대신 실패를 알린다", async () => {
  const response = await request("/api/dream", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      dream:
        "도서관에서 길을 잃었는데 책장을 넘길 때마다 밤하늘과 바다가 이어졌어요.",
      style: "dreamcore",
    }),
  });

  // 테스트 환경에는 API 키가 없다. 예전에는 고정된 가짜 해몽을 돌려줬는데,
  // 사용자가 자기 꿈이 해석된 줄 알게 되므로 실패를 그대로 알린다.
  assert.equal(response.status, 503);
  assert.match(response.headers.get("content-type") ?? "", /^application\/json\b/i);

  const payload = await response.json();
  assert.match(payload.error, /해몽을 만들 수 없어요/);
  assert.equal(payload.result, undefined);
});
