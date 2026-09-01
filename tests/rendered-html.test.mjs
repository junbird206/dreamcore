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
  assert.match(html, /Google Student Ambassador 2026/);
  assert.match(html, /꿈을 적어주세요/);
  assert.match(html, /1단계 Mock 모드/);
  assert.match(html, /sign-up 링크/);
  assert.match(html, /10K/);
  assert.match(html, /100/);
  assert.match(html, /1%/);
  assert.doesNotMatch(html, /codex-preview|react-loading-skeleton/i);
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
  assert.match(dreamLib, /createMockResult/);
  assert.match(dreamRoute, /export async function POST/);
  assert.match(dreamRoute, /mode:\s*"mock"/);
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

test("returns a mock dream interpretation from the API", async () => {
  const response = await request("/api/dream", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      dream:
        "도서관에서 길을 잃었는데 책장을 넘길 때마다 밤하늘과 바다가 이어졌어요.",
      mood: "cinematic",
    }),
  });

  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^application\/json\b/i);

  const payload = await response.json();
  assert.equal(payload.mode, "mock");
  assert.equal(payload.result.title, "캠퍼스 끝의 바다");
  assert.match(payload.result.prompt, /No text in the image/);
});
