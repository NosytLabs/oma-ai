import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Autonomous AI Agents with OMA",
  description:
    "Build autonomous AI agents with OMA — tool use, memory, and reliable multi-step reasoning.",
};

export default function AgentsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
