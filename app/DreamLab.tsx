"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { DreamResult, DreamStyle, findStyle, styles } from "./lib/dream";
import { renderShareCard } from "./lib/share-card";

type ShareStatus = "idle" | "copied" | "downloaded" | "shared" | "failed";
type ImageState = "idle" | "loading" | "ready" | "failed";

/**
 * 화풍 썸네일 캐시 무효화용. 파일명은 그대로 두고 내용만 바꾸면 재방문자가
 * 옛 이미지를 계속 본다. 썸네일을 교체할 때마다 이 숫자를 올릴 것.
 */
const THUMB_VERSION = 2;

declare global {
  interface Window {
    dataLayer?: unknown[][];
    gtag?: (...args: unknown[]) => void;
  }
}

function track(eventName: string, data?: Record<string, string | number>) {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(
    new CustomEvent("dreamcore:event", {
      detail: { eventName, ...data },
    }),
  );

  window.gtag?.("event", eventName, data ?? {});
}

function buildShareText(result: DreamResult) {
  return `내 꿈 해몽: ${result.title}\n\n${result.insight}\n\nDreamcore에서 내 꿈 이미지 만들기`;
}

export function DreamLab() {
  const [dream, setDream] = useState("");
  // 화풍은 선택 사항이다. 고르지 않으면 모델이 꿈에 맞춰 정한다.
  const [style, setStyle] = useState<DreamStyle | null>(null);
  const [result, setResult] = useState<DreamResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [shareStatus, setShareStatus] = useState<ShareStatus>("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [image, setImage] = useState<string | null>(null);
  const [imageState, setImageState] = useState<ImageState>("idle");
  const [imageError, setImageError] = useState("");


  const wordCount = useMemo(() => {
    return dream.trim() ? dream.trim().split(/\s+/).length : 0;
  }, [dream]);

  const selectedStyle = findStyle(style);
  const signupUrl = process.env.NEXT_PUBLIC_SIGNUP_URL;

  useEffect(() => {
    const measurementId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;

    if (!measurementId) {
      return;
    }

    if (!document.getElementById("dreamcore-gtag")) {
      const script = document.createElement("script");
      script.id = "dreamcore-gtag";
      script.async = true;
      script.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`;
      document.head.append(script);
    }

    window.dataLayer = window.dataLayer ?? [];
    window.gtag =
      window.gtag ??
      ((...args: unknown[]) => {
        window.dataLayer?.push(args);
      });

    window.gtag("js", new Date());
    window.gtag("config", measurementId);
    track("analytics_ready");
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (dream.trim().length < 20) {
      return;
    }

    setIsLoading(true);
    setResult(null);
    setShareStatus("idle");
    setErrorMessage("");
    setImage(null);
    setImageState("idle");
    setImageError("");
    track("dream_submit", { style, length: dream.trim().length });

    try {
      const response = await fetch("/api/dream", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ dream, style }),
      });
      const payload = (await response.json()) as {
        error?: string;
        mode?: string;
        result?: DreamResult;
      };

      if (!response.ok || !payload.result) {
        throw new Error(payload.error ?? "꿈을 분석하지 못했습니다.");
      }

      setResult(payload.result);
      track("interpretation_generated", {
        style,
        mode: payload.mode ?? "mock",
      });

      // 해몽을 먼저 그리고 이미지는 뒤이어 채운다. 한 번에 묶으면 사용자가
      // 10초 넘게 빈 화면을 본다.
      void requestImage(payload.result.prompt);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "꿈을 분석하지 못했습니다. 잠시 후 다시 시도해주세요.";
      setErrorMessage(message);
      track("api_error", { stage: "dream_api" });
    } finally {
      setIsLoading(false);
    }
  }

  async function requestImage(prompt: string) {
    setImageState("loading");
    track("image_requested", { style });

    try {
      const response = await fetch("/api/dream/image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });
      const payload = (await response.json()) as {
        error?: string;
        image?: string;
      };

      if (!response.ok || !payload.image) {
        throw new Error(payload.error ?? "이미지를 만들지 못했습니다.");
      }

      setImage(payload.image);
      setImageState("ready");
      track("image_generated");
    } catch (error) {
      // 이미지는 실패해도 해몽은 그대로 보여준다. 다만 한도 초과와 일반 실패는
      // 사용자에게 다르게 읽혀야 하므로 서버가 준 문구를 그대로 쓴다.
      setImageError(
        error instanceof Error ? error.message : "이미지를 만들지 못했어요.",
      );
      setImageState("failed");
      track("api_error", { stage: "image_api" });
    }
  }

  function handlePromoClick() {
    track("cta_clicked", { location: "image_loading" });
  }

  function handleSignupClick() {
    track("cta_clicked", { location: result ? "result" : "hero" });
  }

  async function handleCopyResult() {
    if (!result) {
      return;
    }

    try {
      await navigator.clipboard.writeText(buildShareText(result));
      setShareStatus("copied");
      track("share_copied", { mode: "mock" });
    } catch {
      setShareStatus("failed");
      track("share_failed", { action: "copy" });
    }
  }

  async function handleDownloadCard() {
    if (!result) {
      return;
    }

    const blob = await renderShareCard(result, image);

    if (!blob) {
      setShareStatus("failed");
      track("share_failed", { action: "download" });
      return;
    }

    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `dreamcore-${Date.now()}.jpg`;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    setShareStatus("downloaded");
    track("image_downloaded", { format: "jpg", withImage: image ? 1 : 0 });
  }

  async function handleNativeShare() {
    if (!result) {
      return;
    }

    if (!navigator.share) {
      await handleCopyResult();
      return;
    }

    const shareData = {
      title: `Dreamcore - ${result.title}`,
      text: buildShareText(result),
      url: window.location.href,
    };

    try {
      // 이미지가 붙어야 인스타그램·카카오톡으로 바로 넘길 수 있다.
      // 파일 공유를 지원하지 않는 브라우저에서는 텍스트+링크로 떨어진다.
      const blob = await renderShareCard(result, image);
      const file = blob
        ? new File([blob], `dreamcore-${Date.now()}.jpg`, {
            type: "image/jpeg",
          })
        : null;

      if (file && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ ...shareData, files: [file] });
        setShareStatus("shared");
        track("share_clicked", { mode: "native_file" });
        return;
      }

      await navigator.share(shareData);
      setShareStatus("shared");
      track("share_clicked", { mode: "native_text" });
    } catch {
      setShareStatus("failed");
      track("share_failed", { action: "native" });
    }
  }

  return (
    <main className="min-h-screen bg-[#f7f3ea] pb-14 text-[#171411]">
      <div className="mx-auto w-full max-w-[560px] px-4 pt-4 sm:px-6 sm:pt-6">
        <header className="dream-banner">
          <div className="dream-sky absolute inset-0" />
          <div className="relative z-10 mt-auto">
            <h1 className="text-4xl font-semibold leading-none text-white sm:text-5xl">
              Dreamcore
            </h1>
            <p className="mt-2.5 text-sm leading-6 text-white/80">
              방금 꾼 꿈을 적으면, AI가 상징을 읽고 꿈속 장면을 이미지로
              되살립니다.
            </p>
          </div>
        </header>

        <form className="mt-5 space-y-4" onSubmit={handleSubmit}>
          <div className="relative">
            <label className="block">
              <span className="sr-only">꿈 내용</span>
              <textarea
                className="min-h-[150px] w-full resize-none rounded-[10px] border border-[#d8cebb] bg-white p-4 text-base leading-7 text-[#25201b] shadow-sm outline-none transition placeholder:text-[#8a7d6d] focus:border-[#16796d] focus:ring-4 focus:ring-[#8ad8ca]/30"
                value={dream}
                onChange={(event) => setDream(event.target.value)}
                placeholder="꿈에서 본 장소, 사람, 색, 이상했던 장면을 편하게 적어주세요."
              />
            </label>

          </div>


          <div>
            <div className="mb-2 flex items-baseline justify-between gap-3">
              <p className="text-sm font-semibold text-[#3d352c]">
                꿈의 화풍 고르기{" "}
                <span className="font-medium text-[#8a7d6d]">(선택)</span>
              </p>
              <p className="text-xs text-[#7d7062]">
                {wordCount}단어 · {selectedStyle ? selectedStyle.label : "화풍 자동"}
              </p>
            </div>
            {/* 12개를 모두 펼치면 화면을 다 차지한다. 가로로 넘겨 보게 한다. */}
            <div className="style-rail">
              {styles.map((item) => (
                <button
                  aria-label={`${item.label} — ${item.hint}`}
                  aria-pressed={item.id === style}
                  className="style-chip"
                  key={item.id}
                  onClick={() =>
                    setStyle((current) =>
                      current === item.id ? null : item.id,
                    )
                  }
                  style={{
                    backgroundImage: `url(/styles/${item.id}.jpg?v=${THUMB_VERSION})`,
                  }}
                  title={item.hint}
                  type="button"
                >
                  <strong>{item.label}</strong>
                  <small>{item.hint}</small>
                </button>
              ))}
            </div>
            <p className="mt-1.5 text-xs leading-5 text-[#8a7d6d]">
              화풍을 선택하지 않아도 꿈 이미지는 정상적으로 생성됩니다.
            </p>
          </div>

          <button
            className="cta-primary"
            disabled={dream.trim().length < 20 || isLoading}
            type="submit"
          >
            {isLoading ? "꿈을 읽는 중" : "내 꿈속 장면 생성하기 & 해몽 듣기"}
          </button>
        </form>

        {result || isLoading || errorMessage ? (
          <section className="mt-5 rounded-[10px] border border-[#d8cebb] bg-white p-4 shadow-sm sm:p-5">
            {isLoading ? (
              <div className="loading-state">
                <div className="loading-image" />
                <div className="space-y-3">
                  <div className="loading-line w-2/3" />
                  <div className="loading-line w-full" />
                  <div className="loading-line w-5/6" />
                </div>
              </div>
            ) : null}

            {errorMessage ? (
              <div className="rounded-[8px] border border-[#d9896c] bg-[#fff6ef] p-4 text-sm font-semibold text-[#8a3b27]">
                {errorMessage}
              </div>
            ) : null}

            {result ? (
              <div className="space-y-4">
                {imageState === "ready" && image ? (
                  // base64 data URI라 next/image 최적화가 적용되지 않는다.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    alt={`${result.title} — 꿈 장면 이미지`}
                    className="generated-image-real"
                    src={image}
                  />
                ) : imageState === "failed" ? (
                  <div className="image-gate">
                    <p>{imageError || "이미지를 만들지 못했어요."}</p>
                    <button
                      className="image-cta"
                      onClick={() => requestImage(result.prompt)}
                      type="button"
                    >
                      다시 시도하기
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="generated-image generated-image-pending">
                      <p>꿈 속 모습을 구현하는 중…</p>
                    </div>
                    {/* 이미지가 그려지는 몇 초를 프로모션에 쓴다. */}
                    <a
                      className="promo-link"
                      href={signupUrl || "#signup-url-needed"}
                      onClick={handlePromoClick}
                    >
                      대학생이라면 AI 1년 혜택 받기
                    </a>
                  </div>
                )}

                <div>
                  <p className="text-sm font-semibold text-[#16796d]">
                    꿈 해몽 결과
                  </p>
                  <h2 className="mt-1 text-2xl font-semibold leading-snug">
                    {result.title}
                  </h2>
                  <p className="mt-3 text-sm leading-7 text-[#4b4137]">
                    {result.insight}
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {result.symbols.map((symbol) => (
                      <span className="symbol-chip" key={symbol}>
                        {symbol}
                      </span>
                    ))}
                  </div>
                </div>


                <div className="flex flex-wrap gap-2">
                  <button
                    className="result-action"
                    onClick={handleNativeShare}
                    type="button"
                  >
                    공유하기
                  </button>
                  <button
                    className="result-action"
                    onClick={handleCopyResult}
                    type="button"
                  >
                    문구 복사
                  </button>
                  <button
                    className="result-action"
                    onClick={handleDownloadCard}
                    type="button"
                  >
                    카드 저장
                  </button>
                </div>

                {shareStatus !== "idle" ? (
                  <p className="text-sm font-semibold text-[#16796d]">
                    {shareStatus === "copied" ? "공유 문구를 복사했습니다." : null}
                    {shareStatus === "downloaded"
                      ? "공유 카드를 저장했습니다."
                      : null}
                    {shareStatus === "shared" ? "공유를 완료했습니다." : null}
                    {shareStatus === "failed"
                      ? "공유 작업을 완료하지 못했습니다."
                      : null}
                  </p>
                ) : null}

                {/* 결과를 본 직후가 가입 의향이 가장 높은 지점이다. */}
                <a
                  className="signup-cta"
                  href={signupUrl || "#signup-url-needed"}
                  onClick={handleSignupClick}
                >
                  Google Student Ambassador 혜택 보러 가기
                </a>
              </div>
            ) : null}
          </section>
        ) : null}

        <p className="mt-5 text-center text-xs leading-5 text-[#8a7d6d]">
          Dreamcore의 해몽은 엔터테인먼트와 자기성찰을 위한 콘텐츠입니다.
          민감한 개인정보는 입력하지 않는 것을 권장합니다.
        </p>
      </div>
    </main>
  );
}
