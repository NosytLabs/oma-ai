import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "OMA vs CheapTokens — AI Gateway Comparison",
  description:
    "Side-by-side comparison of OMA and CheapTokens for AI inference pricing, model selection, reliability, and crypto-native deposits.",
  alternates: { canonical: "/compare/cheaptokens-alternative" },
  keywords: [
    "cheaptokens alternative",
    "oma vs cheaptokens",
    "ai gateway comparison",
    "venice ai pricing",
    "crypto ai inference",
  ],
  openGraph: {
    title: "OMA vs CheapTokens | AI Gateway Comparison",
    description:
      "Side-by-side comparison of OMA and CheapTokens for AI inference pricing, model selection, reliability, and crypto-native deposits.",
    url: "https://oma-ai.com/compare/cheaptokens-alternative",
    type: "article",
  },
  twitter: {
    card: "summary_large_image",
    title: "OMA vs CheapTokens | AI Gateway Comparison",
    description:
      "Side-by-side comparison of OMA and CheapTokens for AI inference pricing, model selection, reliability, and crypto-native deposits.",
  },
};

export default function CheapTokensLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
