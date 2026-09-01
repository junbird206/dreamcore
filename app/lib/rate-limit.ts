/**
 * IP 기준 일일 호출 제한.
 *
 * Cloudflare KV에 "rl:{ip}:{한국날짜}" 키로 카운터를 둔다.
 * KV가 없거나 오류가 나면 **통과시킨다(fail-open)** — 제한 장치의 장애로
 * 서비스 전체가 멈추는 쪽이 손해가 크다.
 */

const DAILY_LIMIT = 20;
const KEY_TTL_SECONDS = 60 * 60 * 48; // 이틀 뒤 자동 삭제

export type RateLimitVerdict = {
  allowed: boolean;
  /** 남은 횟수. 무제한이면 null */
  remaining: number | null;
};

const ALLOWED: RateLimitVerdict = { allowed: true, remaining: null };

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

async function readEnv(): Promise<WorkerEnv | null> {
  try {
    const { env } = await import("cloudflare:workers");
    return env as WorkerEnv;
  } catch {
    return null;
  }
}

/** 무제한으로 통과시킬 IP 목록. 학교 와이파이처럼 NAT 뒤에 수천 명이 있는 경우용. */
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

/**
 * @param injectedEnv 테스트에서 가짜 KV를 넣기 위한 통로.
 *   실제 런타임에서는 넘기지 않고 `cloudflare:workers`에서 읽는다.
 */
export async function checkRateLimit(
  request: Request,
  injectedEnv?: WorkerEnv,
): Promise<RateLimitVerdict> {
  const ip = clientIp(request);

  // IP를 못 읽으면 막을 근거가 없다. 통과시킨다.
  if (!ip) {
    return ALLOWED;
  }

  const env = injectedEnv ?? (await readEnv());

  if (allowlist(env).has(ip)) {
    return ALLOWED;
  }

  const kv = env?.RATE_LIMIT;

  // KV 바인딩이 없으면 제한을 걸 수 없다. 통과시키되 로그를 남긴다.
  if (!kv) {
    console.warn("[dreamcore] KV 바인딩 RATE_LIMIT 없음 — 레이트리밋 비활성");
    return ALLOWED;
  }

  const key = `rl:${ip}:${seoulDate()}`;

  try {
    const used = Number((await kv.get(key)) ?? 0);

    if (used >= DAILY_LIMIT) {
      return { allowed: false, remaining: 0 };
    }

    // 원자적 증가가 아니라서 동시 요청이 몰리면 몇 회 새어나갈 수 있다.
    // 남용 방지가 목적이라 이 정도 오차는 감수한다.
    await kv.put(key, String(used + 1), {
      expirationTtl: KEY_TTL_SECONDS,
    });

    return { allowed: true, remaining: DAILY_LIMIT - used - 1 };
  } catch (error) {
    console.error("[dreamcore] 레이트리밋 확인 실패:", error);
    return ALLOWED;
  }
}

export { DAILY_LIMIT };
