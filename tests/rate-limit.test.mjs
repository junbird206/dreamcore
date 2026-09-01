import assert from "node:assert/strict";
import test from "node:test";

const { checkRateLimit, BROWSER_DAILY_LIMIT, IP_DAILY_LIMIT } = await import(
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

const BID_A = "11111111-1111-4111-8111-111111111111";
const BID_B = "22222222-2222-4222-8222-222222222222";

function req({ ip = "1.1.1.1", bid = null } = {}) {
  const headers = {};
  if (ip) headers["CF-Connecting-IP"] = ip;
  if (bid) headers["Cookie"] = `foo=bar; dc_bid=${bid}`;
  return new Request("http://localhost/api/dream", { method: "POST", headers });
}

test("같은 브라우저는 한도를 넘기면 차단된다", async () => {
  const env = { RATE_LIMIT: fakeKv() };

  for (let i = 0; i < BROWSER_DAILY_LIMIT; i += 1) {
    const verdict = await checkRateLimit(req({ bid: BID_A }), env);
    assert.equal(verdict.allowed, true, `${i + 1}번째는 통과해야 한다`);
    assert.equal(verdict.remaining, BROWSER_DAILY_LIMIT - i - 1);
  }

  const blocked = await checkRateLimit(req({ bid: BID_A }), env);
  assert.equal(blocked.allowed, false);
});

test("브라우저별로 카운터가 분리된다", async () => {
  const env = { RATE_LIMIT: fakeKv() };

  for (let i = 0; i < BROWSER_DAILY_LIMIT; i += 1) {
    await checkRateLimit(req({ bid: BID_A }), env);
  }

  assert.equal((await checkRateLimit(req({ bid: BID_A }), env)).allowed, false);
  // 같은 IP지만 다른 브라우저 — IP 천장에는 아직 여유가 있으므로 통과해야 한다
  assert.equal((await checkRateLimit(req({ bid: BID_B }), env)).allowed, true);
});

test("새 브라우저에는 쿠키를 내려주고, 기존 쿠키면 다시 안 내려준다", async () => {
  const env = { RATE_LIMIT: fakeKv() };

  const fresh = await checkRateLimit(req({ bid: null }), env);
  assert.match(fresh.setCookie, /^dc_bid=[0-9a-f-]{36}; /);
  assert.match(fresh.setCookie, /HttpOnly/);
  assert.match(fresh.setCookie, /SameSite=Lax/);

  const returning = await checkRateLimit(req({ bid: BID_A }), env);
  assert.equal(returning.setCookie, null);
});

test("쿠키를 지워가며 반복해도 IP 천장에서 걸린다", async () => {
  const env = { RATE_LIMIT: fakeKv() };

  // 매번 쿠키 없이 = 매번 새 브라우저. 브라우저 한도로는 절대 안 걸린다.
  for (let i = 0; i < IP_DAILY_LIMIT; i += 1) {
    const verdict = await checkRateLimit(req({ bid: null }), env);
    assert.equal(verdict.allowed, true, `${i + 1}번째는 통과해야 한다`);
  }

  const blocked = await checkRateLimit(req({ bid: null }), env);
  assert.equal(blocked.allowed, false);
});

test("IP 천장은 IP별로 분리된다", async () => {
  const env = { RATE_LIMIT: fakeKv() };

  for (let i = 0; i < IP_DAILY_LIMIT; i += 1) {
    await checkRateLimit(req({ ip: "3.3.3.3", bid: null }), env);
  }

  assert.equal(
    (await checkRateLimit(req({ ip: "3.3.3.3", bid: null }), env)).allowed,
    false,
  );
  assert.equal(
    (await checkRateLimit(req({ ip: "4.4.4.4", bid: null }), env)).allowed,
    true,
  );
});

test("차단될 때도 새 브라우저에는 쿠키를 실어 보낸다", async () => {
  const kv = fakeKv();
  const env = { RATE_LIMIT: kv };

  for (let i = 0; i < IP_DAILY_LIMIT; i += 1) {
    await checkRateLimit(req({ bid: null }), env);
  }

  const blocked = await checkRateLimit(req({ bid: null }), env);
  assert.equal(blocked.allowed, false);
  assert.match(blocked.setCookie, /^dc_bid=/);
});

test("허용 목록 IP는 브라우저 한도도 IP 천장도 적용받지 않는다", async () => {
  const kv = fakeKv();
  const env = {
    RATE_LIMIT: kv,
    RATE_LIMIT_ALLOWLIST_IPS: " 5.5.5.5 , 6.6.6.6 ",
  };

  for (let i = 0; i < BROWSER_DAILY_LIMIT + 50; i += 1) {
    const verdict = await checkRateLimit(
      req({ ip: "5.5.5.5", bid: BID_A }),
      env,
    );
    assert.equal(verdict.allowed, true);
  }

  // 허용 목록은 KV를 아예 건드리지 않는다
  assert.equal(kv.store.size, 0);
  assert.equal(
    (await checkRateLimit(req({ ip: "6.6.6.6", bid: BID_A }), env)).allowed,
    true,
  );
});

test("망가진 쿠키 값은 무시하고 새 브라우저로 취급한다", async () => {
  const env = { RATE_LIMIT: fakeKv() };
  const request = new Request("http://localhost/api/dream", {
    method: "POST",
    headers: { "CF-Connecting-IP": "1.1.1.1", Cookie: "dc_bid=../../evil" },
  });

  const verdict = await checkRateLimit(request, env);
  assert.equal(verdict.allowed, true);
  assert.match(verdict.setCookie, /^dc_bid=[0-9a-f-]{36}; /);
});

test("KV 바인딩이 없으면 통과시킨다 (fail-open)", async () => {
  assert.equal((await checkRateLimit(req({}), {})).allowed, true);
});

test("KV가 오류를 던져도 통과시킨다 (fail-open)", async () => {
  const broken = {
    async get() {
      throw new Error("KV 다운");
    },
    async put() {},
  };
  assert.equal(
    (await checkRateLimit(req({}), { RATE_LIMIT: broken })).allowed,
    true,
  );
});

test("IP를 못 읽어도 브라우저 기준으로는 센다", async () => {
  const env = { RATE_LIMIT: fakeKv() };

  for (let i = 0; i < BROWSER_DAILY_LIMIT; i += 1) {
    await checkRateLimit(req({ ip: null, bid: BID_A }), env);
  }

  const blocked = await checkRateLimit(req({ ip: null, bid: BID_A }), env);
  assert.equal(blocked.allowed, false);
});
