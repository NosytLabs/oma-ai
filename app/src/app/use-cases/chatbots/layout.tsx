import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Build AI Chatbots with OMA",
  description:
    "Production-ready chatbot integrations powered by OMA's AI gateway — streaming, function calling, and wallet-only auth for support bots and assistants.",
  alternates: { canonical: "/use-cases/chatbots" },
  keywords: [
    "ai chatbots",
    "chatbot api",
    "support bot api",
    "oma chatbots",
    "conversational ai",
  ],
  openGraph: {
    title: "Build AI Chatbots with OMA",
    description:
      "Production-ready chatbot integrations powered by OMA's AI gateway — streaming, function calling, and wallet-only auth for support bots and assistants.",
    url: "https://oma-ai.com/use-cases/chatbots",
    type: "article",
  },
  twitter: {
    card: "summary_large_image",
    title: "Build AI Chatbots with OMA",
    description:
      "Production-ready chatbot integrations powered by OMA's AI gateway — streaming, function calling, and wallet-only auth for support bots and assistants.",
  },
};

export default function ChatbotsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
