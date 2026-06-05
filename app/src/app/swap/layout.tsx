import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Crypto Swap",
  description:
    "Swap crypto across chains with aggregated liquidity and best-rate routing.",
};

export default function SwapLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
