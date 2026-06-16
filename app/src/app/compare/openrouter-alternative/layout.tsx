import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "OMA vs OpenRouter — AI Gateway Comparison",
  description:
    "Side-by-side comparison of OMA and OpenRouter. Pricing, model coverage, latency, wallet-only auth, and zero prompt logging for AI routing gateways.",
  alternates: { canonical: "/compare/openrouter-alternative" },
  keywords: [
    "openrouter alternative",
    "oma vs openrouter",
    "ai routing gateway",
    "wallet auth ai",
    "private ai api",
  ],
  openGraph: {
    title: "OMA vs OpenRouter | AI Gateway Comparison",
    description:
      "Side-by-side comparison of OMA and OpenRouter. Pricing, model coverage, latency, wallet-only auth, and zero prompt logging for AI routing gateways.",
    url: "https://oma-ai.com/compare/openrouter-alternative",
    type: "article",
  },
  twitter: {
    card: "summary_large_image",
    title: "OMA vs OpenRouter | AI Gateway Comparison",
    description:
      "Side-by-side comparison of OMA and OpenRouter. Pricing, model coverage, latency, wallet-only auth, and zero prompt logging for AI routing gateways.",
  },
};

export default function OpenRouterAlternativeLayout({
  children,
}: {
  children: ReactNode;
}) {
  return <>{children}</>;
}
