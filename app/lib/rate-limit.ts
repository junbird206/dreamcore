/**
 * 일일 호출 제한. 두 겹으로 센다.
 *
 * 1. **브라우저 기준** (쿠키) — 실사용자 한도. 이게 주 방어선이다.
 * 2. **IP 기준** — 스크립트 남용을 막는 천장. 한도를 높게 잡는다.
 *
 * IP만으로 세면 안 되는 이유: 국내 이동통신사는 CGNAT을 써서 수십~수백 명이
 * 공인 IP 하나를 공유한다. 캠퍼스 와이파이도 NAT 뒤에 수천 명이 있다.
 * IP당 한도를 낮게 잡으면 홍보 중에 아무 잘못 없는 학생이 차단된다.
 *
 * KV가 없거나 오류가 나면 **통과시킨다(fail-open)** — 제한 장치의 장애로
 * 서비스 전체가 멈추는 쪽이 손해가 크다.
 */

/**
 * 종류별 하루 한도.
 *
 * 텍스트 해몽과 이미지 생성은 단가가 40배 차이난다(약 1.5원 vs 55원).
 * 같은 한도를 쓰면 이미지가 비용을 지배하므로 따로 센다.
 * browser는 실사용자 한도, ip는 스크립트 남용을 막는 천장이다.
 */
const LIMITS = {
  dream: { browser: 20, ip: 200 },
  image: { browser: 4, ip: 40 },
} as const;

export type RateLimitKind = keyof typeof LIMITS;

const KEY_TTL_SECONDS = 60 * 60 * 48; // 이틀 뒤 자동 삭제
const COOKIE_NAME = "dc_bid";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export type RateLimitVerdict = {
  allowed: boolean;
  /** 브라우저 기준 남은 횟수. 무제한이거나 셀 수 없으면 null */
  remaining: number | null;
  /** 새 브라우저면 응답에 실어야 할 Set-Cookie 값 */
  setCookie: string | null;
};

const ALLOWED: RateLimitVerdict = {
  allowed: true,
  remaining: null,
  setCookie: null,
};

/** 이 프로젝트엔 @cloudflare/workers-types가 없어 쓰는 만큼만 선언한다. */
type KvLike = {
  get(key: string): Promise<string | null>;
  put(
    key: string,
    value: string,
    options?: { expirationTtl?: number },
  ): Promise<void>;
};

type WorkerEnv = {
  RATE_LIMIT?: KvLike;
  RATE_LIMIT_ALLOWLIST_IPS?: string;
};

/** 한국 기준 날짜(YYYY-MM-DD). 자정에 카운터가 리셋되도록 KST를 쓴다. */
function seoulDate() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function clientIp(request: Request) {
  return (
    request.headers.get("CF-Connecting-IP") ??
    request.headers.get("X-Forwarded-For")?.split(",")[0]?.trim() ??
    null
  );
}

function readBrowserId(request: Request) {
  const cookie = request.headers.get("Cookie");

  if (!cookie) {
    return null;
  }

  for (const part of cookie.split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name === COOKIE_NAME && rest.length) {
      const value = rest.join("=").trim();
      // 임의 문자열이 키에 섞이지 않도록 형태를 확인한다.
      if (/^[0-9a-f-]{36}$/.test(value)) {
        return value;
      }
    }
  }

  return null;
}

async function readEnv(): Promise<WorkerEnv | null> {
  try {
    const { env } = await import("cloudflare:workers");
    return env as WorkerEnv;
  } catch {
    return null;
  }
}

/** 무제한으로 통과시킬 IP 목록. 학교 와이파이 공인 IP 등. */
function allowlist(env: WorkerEnv | null) {
  const raw =
    env?.RATE_LIMIT_ALLOWLIST_IPS ??
    (typeof process !== "undefined"
      ? process.env?.RATE_LIMIT_ALLOWLIST_IPS
      : undefined);

  return new Set(
    (raw ?? "")
      .split(",")
      .map((ip) => ip.trim())
      .filter(Boolean),
  );
}

/** 카운터를 하나 올린다. 한도를 넘었으면 null을 돌려준다. */
async function bump(kv: KvLike, key: string, limit: number) {
  const used = Number((await kv.get(key)) ?? 0);

  if (used >= limit) {
    return null;
  }

  // 원자적 증가가 아니라서 동시 요청이 몰리면 몇 회 새어나갈 수 있다.
  // 남용 방지가 목적이라 이 정도 오차는 감수한다.
  await kv.put(key, String(used + 1), { expirationTtl: KEY_TTL_SECONDS });

  return limit - used - 1;
}

/**
 * @param injectedEnv 테스트에서 가짜 KV를 넣기 위한 통로.
 *   실제 런타임에서는 넘기지 않고 `cloudflare:workers`에서 읽는다.
 */
export async function checkRateLimit(
  request: Request,
  kind: RateLimitKind,
  injectedEnv?: WorkerEnv,
): Promise<RateLimitVerdict> {
  const env = injectedEnv ?? (await readEnv());
  const ip = clientIp(request);

  if (ip && allowlist(env).has(ip)) {
    return ALLOWED;
  }

  const kv = env?.RATE_LIMIT;

  // KV 바인딩이 없으면 제한을 걸 수 없다. 통과시키되 로그를 남긴다.
  if (!kv) {
    console.warn("[dreamcore] KV 바인딩 RATE_LIMIT 없음 — 레이트리밋 비활성");
    return ALLOWED;
  }

  const existingId = readBrowserId(request);
  const browserId = existingId ?? crypto.randomUUID();
  const today = seoulDate();
  const limit = LIMITS[kind];

  const setCookie = existingId
    ? null
    : `${COOKIE_NAME}=${browserId}; Path=/; Max-Age=${COOKIE_MAX_AGE}; HttpOnly; Secure; SameSite=Lax`;

  try {
    // IP 천장을 먼저 본다. 쿠키를 지워가며 반복 호출하는 스크립트는 여기서 걸린다.
    if (ip) {
      const ipRemaining = await bump(kv, `rl:${kind}:${ip}:${today}`, limit.ip);

      if (ipRemaining === null) {
        return { allowed: false, remaining: 0, setCookie };
      }
    }

    const remaining = await bump(
      kv,
      `rlb:${kind}:${browserId}:${today}`,
      limit.browser,
    );

    if (remaining === null) {
      return { allowed: false, remaining: 0, setCookie };
    }

    return { allowed: true, remaining, setCookie };
  } catch (error) {
    console.error("[dreamcore] 레이트리밋 확인 실패:", error);
    return { ...ALLOWED, setCookie };
  }
}

export { LIMITS };
