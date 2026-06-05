import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "OMA vs CheapTokens | AI Gateway Comparison",
  description:
    "Compare OMA and CheapTokens for AI inference pricing, model selection, and reliability.",
};

export default function CheapTokensLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
