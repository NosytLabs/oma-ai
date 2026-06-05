import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "AI Apps with OMA",
  description:
    "Ship AI features in your application using OMA's unified API gateway.",
};

export default function AppsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
