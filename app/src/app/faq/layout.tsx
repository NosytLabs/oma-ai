import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "FAQ | OMA AI",
  description:
    "Frequently asked questions about OMA — pricing, accounts, privacy, models, and more.",
  openGraph: {
    title: "FAQ | OMA AI",
    description:
      "Frequently asked questions about OMA — pricing, accounts, privacy, models, and more.",
  },
};

export default function FaqLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
