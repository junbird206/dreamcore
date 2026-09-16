import assert from "node:assert/strict";
import test, { afterEach } from "node:test";

const handler = (
  await import(new URL("../proxy/api/gemini.js", import.meta.url).href)
).default;

/** Vercel의 req/res 계약 중 핸들러가 실제로 쓰는 부분만 흉내낸다. */
function makeRes() {
  const res = {
    statusCode: null,
    headers: {},
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
    send(text) {
      this.body = text;
      return this;
    },
    setHeader(k, v) {
      this.headers[k] = v;
      return this;
    },
  };
  return res;
}

const originalFetch = globalThis.fetch;
const originalEnv = { ...process.env };

afterEach(() => {
  globalThis.fetch = originalFetch;
  process.env = { ...originalEnv };
});

function configure() {
  process.env.DREAMCORE_PROXY_TOKEN = "테스트토큰";
  process.env.GOOGLE_AI_API_KEY = "테스트키";
}

test("POST가 아니면 거부한다", async () => {
  configure();
  const res = makeRes();
  await handler({ method: "GET", headers: {}, body: {} }, res);
  assert.equal(res.statusCode, 405);
});

test("토큰이 없거나 틀리면 401", async () => {
  configure();
  const res = makeRes();
  await handler(
    { method: "POST", headers: { "x-dreamcore-token": "틀린값" }, body: {} },
    res,
  );
  assert.equal(res.statusCode, 401);
});

test("허용 목록에 없는 모델은 400", async () => {
  configure();
  const res = makeRes();
  await handler(
    {
      method: "POST",
      headers: { "x-dreamcore-token": "테스트토큰" },
      body: { model: "gemini-3-pro-image", payload: {} },
    },
    res,
  );
  assert.equal(res.statusCode, 400);
  assert.match(res.body.error, /허용되지 않은 모델/);
});

test("환경변수가 없으면 500이고 Gemini를 호출하지 않는다", async () => {
  delete process.env.DREAMCORE_PROXY_TOKEN;
  delete process.env.GOOGLE_AI_API_KEY;
  let called = false;
  globalThis.fetch = async () => {
    called = true;
    return new Response("{}");
  };

  const res = makeRes();
  await handler(
    {
      method: "POST",
      headers: { "x-dreamcore-token": "아무값" },
      body: { model: "gemini-3.5-flash", payload: {} },
    },
    res,
  );
  assert.equal(res.statusCode, 500);
  assert.equal(called, false);
});

test("정상 요청은 Gemini 응답을 상태·본문 그대로 전달한다", async () => {
  configure();
  let seenUrl = "";
  let seenBody = "";
  globalThis.fetch = async (url, init) => {
    seenUrl = url;
    seenBody = init.body;
    return new Response('{"candidates":[]}', { status: 200 });
  };

  const res = makeRes();
  await handler(
    {
      method: "POST",
      headers: { "x-dreamcore-token": "테스트토큰" },
      body: { model: "gemini-3.5-flash", payload: { contents: ["꿈"] } },
    },
    res,
  );

  assert.equal(res.statusCode, 200);
  assert.equal(res.body, '{"candidates":[]}');
  assert.match(seenUrl, /models\/gemini-3\.5-flash:generateContent/);
  assert.match(seenUrl, /key=테스트키/);
  assert.equal(seenBody, JSON.stringify({ contents: ["꿈"] }));
});

test("Gemini가 실패해도 상태와 본문을 그대로 넘긴다", async () => {
  configure();
  globalThis.fetch = async () =>
    new Response('{"error":{"message":"User location is not supported"}}', {
      status: 400,
    });

  const res = makeRes();
  await handler(
    {
      method: "POST",
      headers: { "x-dreamcore-token": "테스트토큰" },
      body: { model: "gemini-3.5-flash", payload: {} },
    },
    res,
  );

  // 워커가 실패 사유를 로깅할 수 있어야 하므로 삼켜서는 안 된다
  assert.equal(res.statusCode, 400);
  assert.match(res.body, /User location is not supported/);
});
