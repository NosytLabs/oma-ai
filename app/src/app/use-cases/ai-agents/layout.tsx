import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Autonomous AI Agents with OMA",
  description:
    "Build autonomous AI agents with OMA — tool use, memory, reliable multi-step reasoning, and USDC-on-Base pay-per-request settlement.",
  alternates: { canonical: "/use-cases/ai-agents" },
  keywords: [
    "ai agents",
    "autonomous agents",
    "agent api",
    "oma ai agents",
    "tool use llm",
  ],
  openGraph: {
    title: "Autonomous AI Agents with OMA",
    description:
      "Build autonomous AI agents with OMA — tool use, memory, reliable multi-step reasoning, and USDC-on-Base pay-per-request settlement.",
    url: "https://oma-ai.com/use-cases/ai-agents",
    type: "article",
  },
  twitter: {
    card: "summary_large_image",
    title: "Autonomous AI Agents with OMA",
    description:
      "Build autonomous AI agents with OMA — tool use, memory, reliable multi-step reasoning, and USDC-on-Base pay-per-request settlement.",
  },
};

export default function AgentsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
