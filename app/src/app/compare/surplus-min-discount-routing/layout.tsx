import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Surplus Min Discount Routing | OMA AI Gateway",
  description:
    "Set a minimum discount floor. OMA will not buy Surplus inference below your threshold, and end users can request the same guardrail for their own agent spend.",
};

export default function SurplusMinDiscountRoutingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
