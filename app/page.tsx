import type { Metadata } from "next";
import { DreamLab } from "./DreamLab";

// 커스텀 도메인을 붙이면 .env의 값만 바꾸면 된다.
const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://dreamcore.junbird521.workers.dev";

/** 링크를 공유했을 때 카카오톡·인스타그램 등에서 미리보기로 쓰인다. */
const shareDescription = "내 꿈속 장면 다시보기+해몽하기";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "Dreamcore",
  description:
    "꿈을 적으면 상징적 해몽과 꿈속 이미지를 함께 만들어주는 AI dream journal.",
  openGraph: {
    type: "website",
    locale: "ko_KR",
    siteName: "Dreamcore",
    title: "Dreamcore",
    description: shareDescription,
    url: siteUrl,
    images: [
      {
        url: "/og.jpg",
        width: 1200,
        height: 630,
        alt: "달빛이 비치는 회랑 너머로 바다가 보이는 꿈속 장면",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Dreamcore",
    description: shareDescription,
    images: ["/og.jpg"],
  },
};

export default function Home() {
  return <DreamLab />;
}
