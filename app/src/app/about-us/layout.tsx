import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "About Us",
  description: "Learn about the team and mission behind OMA AI — the open, accessible AI platform.",
  openGraph: {
    title: "About Us",
    description: "Learn about the team and mission behind OMA AI.",
    url: "https://oma-ai.com/about-us",
    siteName: "OMA AI",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "About Us",
    description: "Learn about the team and mission behind OMA AI.",
  },
};

export default function AboutUsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
