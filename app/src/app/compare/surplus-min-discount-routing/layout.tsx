import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Surplus Min Discount Routing — OMA AI Gateway",
  description:
    "Set a minimum discount floor. OMA will not buy Surplus inference below your threshold, and end users can request the same guardrail for their own agent spend.",
  alternates: { canonical: "/compare/surplus-min-discount-routing" },
  keywords: [
    "surplus min discount routing",
    "ai agent spend guardrail",
    "inference discount floor",
    "procurement agent",
    "oma surplus",
  ],
  openGraph: {
    title: "Surplus Min Discount Routing | OMA AI Gateway",
    description:
      "Set a minimum discount floor. OMA will not buy Surplus inference below your threshold, and end users can request the same guardrail for their own agent spend.",
    url: "https://oma-ai.com/compare/surplus-min-discount-routing",
    type: "article",
  },
  twitter: {
    card: "summary_large_image",
    title: "Surplus Min Discount Routing | OMA AI Gateway",
    description:
      "Set a minimum discount floor. OMA will not buy Surplus inference below your threshold, and end users can request the same guardrail for their own agent spend.",
  },
};

export default function SurplusMinDiscountRoutingLayout({
  children,
}: {
  children: ReactNode;
}) {
  return <>{children}</>;
}
