import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "AI Apps with OMA",
  description:
    "Ship AI features in your application using OMA's unified API gateway — one OpenAI-compatible endpoint, 91+ models, and USDC-on-Base billing.",
  alternates: { canonical: "/use-cases/apps" },
  keywords: [
    "ai apps",
    "ai feature integration",
    "openai compatible api",
    "oma ai apps",
    "llm api gateway",
  ],
  openGraph: {
    title: "AI Apps with OMA",
    description:
      "Ship AI features in your application using OMA's unified API gateway — one OpenAI-compatible endpoint, 91+ models, and USDC-on-Base billing.",
    url: "https://oma-ai.com/use-cases/apps",
    type: "article",
  },
  twitter: {
    card: "summary_large_image",
    title: "AI Apps with OMA",
    description:
      "Ship AI features in your application using OMA's unified API gateway — one OpenAI-compatible endpoint, 91+ models, and USDC-on-Base billing.",
  },
};

export default function AppsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
