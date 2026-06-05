import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Build AI Chatbots with OMA",
  description:
    "Production-ready chatbot integrations powered by OMA's AI gateway.",
};

export default function ChatbotsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
