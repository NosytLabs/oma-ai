import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Compare AI Providers | OMA",
  description: "See how OMA compares to alternative AI gateway providers.",
};

export default function CompareLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
