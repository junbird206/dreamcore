"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";

/**
 * Web Speech API 기반 한국어 음성 입력.
 *
 * 표준 TS DOM 타입에 SpeechRecognition이 없어 쓰는 만큼만 선언한다.
 * Safari/iOS는 webkit 접두사만 지원하고, Firefox는 아예 지원하지 않는다.
 */

type SpeechAlternative = { transcript: string };

type SpeechResult = {
  isFinal: boolean;
  length: number;
  [index: number]: SpeechAlternative;
};

type SpeechResultList = {
  length: number;
  [index: number]: SpeechResult;
};

type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: { resultIndex: number; results: SpeechResultList }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
};

type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

function getConstructor(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") {
    return null;
  }

  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };

  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

const ERROR_MESSAGES: Record<string, string> = {
  "not-allowed": "마이크 권한이 필요해요. 브라우저 설정에서 허용해주세요.",
  "service-not-allowed":
    "마이크 권한이 필요해요. 브라우저 설정에서 허용해주세요.",
  "audio-capture": "마이크를 찾지 못했어요.",
  network: "네트워크 문제로 음성 인식을 못 했어요.",
};

export type SpeechInput = {
  /** 이 브라우저가 음성 인식을 지원하는지. false면 버튼을 숨긴다. */
  supported: boolean;
  listening: boolean;
  error: string;
  start: () => void;
  stop: () => void;
};

/** useSyncExternalStore용. 지원 여부는 변하지 않으므로 구독할 것이 없다. */
const subscribeNothing = () => () => {};

export function useSpeechInput(
  onTranscript: (transcript: string) => void,
): SpeechInput {
  // 서버에서는 false, 클라이언트에서는 실제 값을 준다.
  // effect에서 setState하면 렌더가 한 번 더 돌아 경고가 난다.
  const supported = useSyncExternalStore(
    subscribeNothing,
    () => getConstructor() !== null,
    () => false,
  );
  const [listening, setListening] = useState(false);
  const [error, setError] = useState("");

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const finalRef = useRef("");
  // 사용자가 멈추길 원하는지. 침묵으로 자동 종료됐을 때 재시작 여부를 가른다.
  const wantListeningRef = useRef(false);
  const onTranscriptRef = useRef(onTranscript);

  useEffect(() => {
    onTranscriptRef.current = onTranscript;
  }, [onTranscript]);

  useEffect(() => {
    return () => {
      wantListeningRef.current = false;
      recognitionRef.current?.abort();
    };
  }, []);

  // 침묵으로 끊기면 스스로를 다시 호출해야 해서 함수 선언으로 둔다.
  function begin() {
    const Ctor = getConstructor();

    if (!Ctor || recognitionRef.current) {
      return;
    }

    const recognition = new Ctor();
    recognition.lang = "ko-KR";
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event) => {
      let interim = "";

      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i];
        const text = result[0]?.transcript ?? "";

        if (result.isFinal) {
          finalRef.current += text;
        } else {
          interim += text;
        }
      }

      onTranscriptRef.current(finalRef.current + interim);
    };

    recognition.onerror = (event) => {
      // no-speech는 잠깐 말을 안 한 것뿐이라 오류로 보여주지 않는다.
      if (event.error === "no-speech" || event.error === "aborted") {
        return;
      }

      setError(ERROR_MESSAGES[event.error] ?? "음성 인식에 실패했어요.");
      wantListeningRef.current = false;
    };

    recognition.onend = () => {
      recognitionRef.current = null;

      // 브라우저가 침묵으로 끊은 경우엔 사용자가 멈춘 게 아니므로 이어서 듣는다.
      if (wantListeningRef.current) {
        begin();
        return;
      }

      setListening(false);
    };

    try {
      recognition.start();
      recognitionRef.current = recognition;
      wantListeningRef.current = true;
      setError("");
      setListening(true);
    } catch {
      recognitionRef.current = null;
      setError("음성 인식을 시작하지 못했어요.");
      setListening(false);
    }
  }

  // 새 녹음마다 확정 텍스트를 비워야 이전 내용이 중복되지 않는다.
  function start() {
    finalRef.current = "";
    begin();
  }

  function stop() {
    wantListeningRef.current = false;
    recognitionRef.current?.stop();
    setListening(false);
  }

  return { supported, listening, error, start, stop };
}
