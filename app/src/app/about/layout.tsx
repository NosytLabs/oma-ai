
// About page exports its own metadata in page.tsx (more detailed openGraph).
// This layout intentionally has no metadata export to avoid Next.js's
// "metadata defined in both page and layout" error.

export default function AboutLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
