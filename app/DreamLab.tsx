"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  DreamResult,
  DreamStyle,
  defaultStyle,
  findStyle,
  starterDream,
  styles,
} from "./lib/dream";
import { renderShareCard } from "./lib/share-card";
import { useSpeechInput } from "./lib/speech";

type ShareStatus = "idle" | "copied" | "downloaded" | "shared" | "failed";
type ImageState = "idle" | "loading" | "ready" | "failed";

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
  const [dream, setDream] = useState(starterDream);
  const [style, setStyle] = useState<DreamStyle>(defaultStyle);
  const [result, setResult] = useState<DreamResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [shareStatus, setShareStatus] = useState<ShareStatus>("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [image, setImage] = useState<string | null>(null);
  const [imageState, setImageState] = useState<ImageState>("idle");

  // 음성 인식으로 들어온 말은 녹음 시작 시점의 텍스트 뒤에 이어 붙인다.
  const dreamBeforeVoiceRef = useRef("");
  const speech = useSpeechInput((transcript) => {
    setDream(dreamBeforeVoiceRef.current + transcript);
  });

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

      // 해몽을 먼저 보여주고 이미지는 뒤이어 채운다. 묶어서 기다리게 하면
      // 사용자가 20초 넘게 빈 화면을 본다.
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
    } catch {
      // 이미지는 실패해도 해몽은 그대로 보여준다. 에러 배너는 띄우지 않는다.
      setImageState("failed");
      track("api_error", { stage: "image_api" });
    }
  }

  function handleVoiceToggle() {
    if (speech.listening) {
      speech.stop();
      track("voice_input_stopped", { length: dream.trim().length });
      return;
    }

    const existing = dream.trimEnd();
    dreamBeforeVoiceRef.current = existing ? `${existing} ` : "";
    speech.start();
    track("voice_input_started");
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
    <main className="min-h-screen bg-[#f7f3ea] text-[#171411]">
      <section className="hero-grid mx-auto grid min-h-screen w-full max-w-7xl gap-0 px-5 py-5 md:grid-cols-[minmax(0,0.92fr)_minmax(420px,1.08fr)] md:px-8">
        <aside className="dream-visual relative flex min-h-[340px] min-w-0 overflow-hidden rounded-[8px] bg-[#141313] p-6 text-white md:min-h-[calc(100vh-40px)] md:p-8">
          <div className="absolute inset-0 dream-sky" />
          <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/80 to-transparent" />
          <div className="relative z-10 mt-auto max-w-lg">
            <p className="mb-3 max-w-[250px] text-xs font-semibold uppercase text-[#9ee4d6] sm:max-w-none sm:text-sm">
              Google Student Ambassador 2026
            </p>
            <h1 className="text-balance text-5xl font-semibold leading-[0.98] text-white md:text-7xl">
              Dreamcore
            </h1>
            <p className="mt-5 max-w-md text-pretty text-base leading-7 text-white/78">
              방금 꾼 꿈을 적으면, AI가 상징을 읽고 꿈속 장면을 이미지로
              되살립니다.
            </p>
            <div className="dream-metrics mt-7 grid gap-2 text-sm text-white/80">
              <div className="metric">
                <strong>10K</strong>
                <span>방문 목표</span>
              </div>
              <div className="metric">
                <strong>100</strong>
                <span>sign-up 목표</span>
              </div>
              <div className="metric">
                <strong>1%</strong>
                <span>전환 기준</span>
              </div>
            </div>
          </div>
        </aside>

        <div className="flex min-h-screen min-w-0 flex-col justify-center py-8 md:pl-8">
          <div className="mx-auto w-full min-w-0 max-w-2xl">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-[#5d4d39]">
                  오늘 아침의 꿈 기록
                </p>
                <h2 className="mt-1 text-3xl font-semibold text-[#171411]">
                  꿈을 적어주세요
                </h2>
              </div>
              <a
                className="inline-flex h-11 w-full items-center justify-center rounded-[8px] bg-[#171411] px-4 text-sm font-semibold text-white transition hover:bg-[#2b251f] sm:w-auto"
                href={signupUrl || "#signup-url-needed"}
                onClick={handleSignupClick}
              >
                sign-up 링크
              </a>
            </div>

            <form className="space-y-4" onSubmit={handleSubmit}>
              <div className="relative">
                <label className="block">
                  <span className="sr-only">꿈 내용</span>
                  <textarea
                    className="min-h-[190px] w-full resize-none rounded-[8px] border border-[#d8cebb] bg-white p-5 pb-16 text-base leading-7 text-[#25201b] shadow-sm outline-none transition placeholder:text-[#8a7d6d] focus:border-[#16796d] focus:ring-4 focus:ring-[#8ad8ca]/35"
                    value={dream}
                    onChange={(event) => setDream(event.target.value)}
                    placeholder="꿈에서 본 장소, 사람, 색, 이상했던 장면을 편하게 적어주세요."
                  />
                </label>

                {speech.supported ? (
                  <button
                    aria-label={
                      speech.listening ? "음성 입력 중지" : "음성으로 입력하기"
                    }
                    aria-pressed={speech.listening}
                    className={
                      speech.listening ? "mic-button is-listening" : "mic-button"
                    }
                    onClick={handleVoiceToggle}
                    type="button"
                  >
                    <span aria-hidden="true">●</span>
                    {speech.listening ? "듣는 중" : "말로 적기"}
                  </button>
                ) : null}
              </div>

              {speech.error ? (
                <p className="text-sm font-semibold text-[#8a3b27]">
                  {speech.error}
                </p>
              ) : null}

              <div className="style-chips">
                {styles.map((item) => (
                  <button
                    aria-label={`${item.label} — ${item.hint}`}
                    aria-pressed={item.id === style}
                    className="style-chip"
                    key={item.id}
                    onClick={() => setStyle(item.id)}
                    style={{ backgroundImage: `url(/styles/${item.id}.jpg)` }}
                    title={item.hint}
                    type="button"
                  >
                    <strong>{item.label}</strong>
                    <small>{item.hint}</small>
                  </button>
                ))}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-[#655a4b]">
                  {wordCount}단어 · 화풍: {selectedStyle.label}
                </p>
                <button
                  className="inline-flex h-12 w-full items-center justify-center rounded-[8px] bg-[#16796d] px-5 text-sm font-bold text-white shadow-sm transition hover:bg-[#105f57] disabled:cursor-not-allowed disabled:bg-[#a8a096] sm:w-auto"
                  disabled={dream.trim().length < 20 || isLoading}
                  type="submit"
                >
                  {isLoading ? "꿈을 읽는 중" : "해몽과 이미지 만들기"}
                </button>
              </div>
            </form>

            <section className="mt-6 rounded-[8px] border border-[#d8cebb] bg-white p-5 shadow-sm">
              {!result && !isLoading ? (
                <div className="grid gap-4 md:grid-cols-[1fr_180px]">
                  <div>
                    <p className="text-sm font-semibold text-[#16796d]">
                      1단계 Mock 모드
                    </p>
                    <h3 className="mt-2 text-xl font-semibold">
                      API 키 없이 전체 흐름을 먼저 검증합니다.
                    </h3>
                    <p className="mt-3 text-sm leading-6 text-[#655a4b]">
                      다음 단계에서 Gemini 해몽 API와 Nano Banana 이미지 생성을
                      실제 호출로 교체합니다.
                    </p>
                  </div>
                  <div className="mock-tile" aria-hidden="true" />
                </div>
              ) : null}

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
                <div className="grid gap-5 lg:grid-cols-[230px_1fr]">
                  <div className="space-y-3">
                    {imageState === "ready" && image ? (
                      // base64 data URI라 next/image 최적화가 적용되지 않는다.
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        alt={`${result.title} — 꿈 장면 이미지`}
                        className="generated-image-real"
                        src={image}
                      />
                    ) : (
                      <div
                        className={
                          imageState === "failed"
                            ? "generated-image"
                            : "generated-image generated-image-pending"
                        }
                      >
                        <p>
                          {imageState === "failed"
                            ? "이미지를 만들지 못했어요"
                            : "꿈 장면 그리는 중"}
                        </p>
                      </div>
                    )}
                    <div
                      className="share-card-preview"
                      // 실제로 저장되는 카드와 같은 배경을 보여준다.
                      style={
                        image
                          ? { backgroundImage: `url(${image})` }
                          : undefined
                      }
                    >
                      <p>Dreamcore</p>
                      <strong>{result.title}</strong>
                      <span>{result.symbols.map((symbol) => `#${symbol}`).join(" ")}</span>
                    </div>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-[#16796d]">
                      꿈 해몽 결과
                    </p>
                    <h3 className="mt-1 text-2xl font-semibold">
                      {result.title}
                    </h3>
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
                    <div className="mt-4 rounded-[8px] bg-[#f4efe5] p-4">
                      <p className="text-xs font-semibold uppercase text-[#776750]">
                        Image prompt preview
                      </p>
                      <p className="mt-2 line-clamp-4 text-sm leading-6 text-[#4b4137]">
                        {result.prompt}
                      </p>
                    </div>
                    <div className="mt-5 flex flex-wrap gap-3">
                      <button
                        className="inline-flex h-11 items-center justify-center rounded-[8px] border border-[#c9bda8] px-4 text-sm font-semibold text-[#2a2119] transition hover:bg-[#f4efe5]"
                        onClick={handleNativeShare}
                        type="button"
                      >
                        공유하기
                      </button>
                      <button
                        className="inline-flex h-11 items-center justify-center rounded-[8px] border border-[#c9bda8] px-4 text-sm font-semibold text-[#2a2119] transition hover:bg-[#f4efe5]"
                        onClick={handleCopyResult}
                        type="button"
                      >
                        문구 복사
                      </button>
                      <button
                        className="inline-flex h-11 items-center justify-center rounded-[8px] border border-[#c9bda8] px-4 text-sm font-semibold text-[#2a2119] transition hover:bg-[#f4efe5]"
                        onClick={handleDownloadCard}
                        type="button"
                      >
                        카드 저장
                      </button>
                      <a
                        className="inline-flex h-11 items-center justify-center rounded-[8px] bg-[#171411] px-4 text-sm font-semibold text-white transition hover:bg-[#2b251f]"
                        href={signupUrl || "#signup-url-needed"}
                        onClick={handleSignupClick}
                      >
                        sign-up으로 이동
                      </a>
                    </div>
                    {shareStatus !== "idle" ? (
                      <p className="mt-3 text-sm font-semibold text-[#16796d]">
                        {shareStatus === "copied"
                          ? "공유 문구를 복사했습니다."
                          : null}
                        {shareStatus === "downloaded"
                          ? "공유 카드를 저장했습니다."
                          : null}
                        {shareStatus === "shared"
                          ? "공유를 완료했습니다."
                          : null}
                        {shareStatus === "failed"
                          ? "공유 작업을 완료하지 못했습니다."
                          : null}
                      </p>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </section>

            <p className="mt-4 text-xs leading-5 text-[#766b5d]">
              Dreamcore의 해몽은 엔터테인먼트와 자기성찰을 위한 콘텐츠입니다.
              민감한 개인정보는 입력하지 않는 것을 권장합니다.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
