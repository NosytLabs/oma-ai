import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "About OMA AI",
  description:
    "Learn about OMA — a privacy-first AI inference gateway with crypto-native payments.",
  openGraph: {
    title: "About OMA AI",
    description:
      "Learn about OMA — a privacy-first AI inference gateway with crypto-native payments.",
  },
};

export default function AboutLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
