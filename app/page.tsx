import type { Metadata } from "next";
import { DreamLab } from "./DreamLab";

export const metadata: Metadata = {
  title: "Dreamcore",
  description:
    "꿈을 적으면 상징적 해몽과 꿈속 이미지를 함께 만들어주는 AI dream journal.",
};

export default function Home() {
  return <DreamLab />;
}
