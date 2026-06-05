import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "AI Use Cases",
  description:
    "Real-world AI integration patterns: chatbots, applications, and autonomous agents powered by OMA.",
};

export default function UseCasesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
