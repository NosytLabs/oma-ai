
// Terms page exports its own metadata in page.tsx (more detailed).
// This layout intentionally has no metadata export to avoid duplication.

export default function TermsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
