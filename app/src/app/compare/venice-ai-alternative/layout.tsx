import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "OMA vs Venice AI — AI Gateway Comparison",
  description:
    "Side-by-side comparison of OMA and Venice AI. See pricing, privacy defaults, model coverage, and gateway tooling differences for inference buyers.",
  alternates: { canonical: "/compare/venice-ai-alternative" },
  keywords: [
    "venice ai alternative",
    "oma vs venice",
    "venice ai pricing",
    "ai gateway venice",
    "private ai inference",
  ],
  openGraph: {
    title: "OMA vs Venice AI | AI Gateway Comparison",
    description:
      "Side-by-side comparison of OMA and Venice AI. See pricing, privacy defaults, model coverage, and gateway tooling differences for inference buyers.",
    url: "https://oma-ai.com/compare/venice-ai-alternative",
    type: "article",
  },
  twitter: {
    card: "summary_large_image",
    title: "OMA vs Venice AI | AI Gateway Comparison",
    description:
      "Side-by-side comparison of OMA and Venice AI. See pricing, privacy defaults, model coverage, and gateway tooling differences for inference buyers.",
  },
};

export default function VeniceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
