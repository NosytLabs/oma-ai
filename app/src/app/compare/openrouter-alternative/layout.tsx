import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "OMA vs OpenRouter | AI Gateway Comparison",
  description:
    "Compare OMA and OpenRouter side-by-side. See pricing, model coverage, latency, and features for AI routing gateways.",
};

export default function OpenRouterAlternativeLayout({
  children,
}: {
  children: ReactNode;
}) {
  return <>{children}</>;
}
