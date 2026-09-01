import assert from "node:assert/strict";
import test from "node:test";

const { checkRateLimit, DAILY_LIMIT } = await import(
  new URL("../app/lib/rate-limit.ts", import.meta.url).href
);

/** 메모리 KV. 실제 KV의 get/put 계약만 흉내낸다. */
function fakeKv(initial = {}) {
  const store = new Map(Object.entries(initial));
  return {
    store,
    async get(key) {
      return store.has(key) ? store.get(key) : null;
    },
    async put(key, value) {
      store.set(key, value);
    },
  };
}

const req = (ip) =>
  new Request("http://localhost/api/dream", {
    method: "POST",
    headers: ip ? { "CF-Connecting-IP": ip } : {},
  });

test("한도 안에서는 통과하고 남은 횟수가 줄어든다", async () => {
  const kv = fakeKv();
  const first = await checkRateLimit(req("1.1.1.1"), { RATE_LIMIT: kv });
  assert.equal(first.allowed, true);
  assert.equal(first.remaining, DAILY_LIMIT - 1);

  const second = await checkRateLimit(req("1.1.1.1"), { RATE_LIMIT: kv });
  assert.equal(second.remaining, DAILY_LIMIT - 2);
});

test(`${DAILY_LIMIT}회를 넘기면 차단한다`, async () => {
  const kv = fakeKv();
  const env = { RATE_LIMIT: kv };

  for (let i = 0; i < DAILY_LIMIT; i += 1) {
    const verdict = await checkRateLimit(req("2.2.2.2"), env);
    assert.equal(verdict.allowed, true, `${i + 1}번째는 통과해야 한다`);
  }

  const blocked = await checkRateLimit(req("2.2.2.2"), env);
  assert.equal(blocked.allowed, false);
  assert.equal(blocked.remaining, 0);
});

test("IP별로 카운터가 분리된다", async () => {
  const kv = fakeKv();
  const env = { RATE_LIMIT: kv };
  for (let i = 0; i < DAILY_LIMIT; i += 1) {
    await checkRateLimit(req("3.3.3.3"), env);
  }
  assert.equal((await checkRateLimit(req("3.3.3.3"), env)).allowed, false);
  assert.equal((await checkRateLimit(req("4.4.4.4"), env)).allowed, true);
});

test("허용 목록 IP는 한도를 넘겨도 무제한이다", async () => {
  const kv = fakeKv();
  const env = {
    RATE_LIMIT: kv,
    RATE_LIMIT_ALLOWLIST_IPS: " 5.5.5.5 , 6.6.6.6 ",
  };

  for (let i = 0; i < DAILY_LIMIT + 50; i += 1) {
    const verdict = await checkRateLimit(req("5.5.5.5"), env);
    assert.equal(verdict.allowed, true);
    assert.equal(verdict.remaining, null);
  }

  // 허용 목록은 KV를 아예 건드리지 않는다
  assert.equal(kv.store.size, 0);
  assert.equal((await checkRateLimit(req("6.6.6.6"), env)).allowed, true);
});

test("KV 바인딩이 없으면 통과시킨다 (fail-open)", async () => {
  const verdict = await checkRateLimit(req("7.7.7.7"), {});
  assert.equal(verdict.allowed, true);
});

test("KV가 오류를 던져도 통과시킨다 (fail-open)", async () => {
  const broken = {
    async get() {
      throw new Error("KV 다운");
    },
    async put() {},
  };
  const verdict = await checkRateLimit(req("8.8.8.8"), { RATE_LIMIT: broken });
  assert.equal(verdict.allowed, true);
});

test("IP를 못 읽으면 통과시킨다", async () => {
  const kv = fakeKv();
  const verdict = await checkRateLimit(req(null), { RATE_LIMIT: kv });
  assert.equal(verdict.allowed, true);
  assert.equal(kv.store.size, 0);
});
