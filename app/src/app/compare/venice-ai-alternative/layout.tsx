import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "OMA vs Venice AI | AI Gateway Comparison",
  description:
    "Compare OMA and Venice AI side-by-side. See pricing, privacy, and model coverage differences.",
};

export default function VeniceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
