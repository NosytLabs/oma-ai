import { MotionProvider } from "@/lib/animation/MotionProvider";

// pricing/ page is fully client; opt the segment out of static prerender.
//
// Metadata lives in page.tsx, not here. Next.js resolves a route segment's
// metadata from the page first, so a second `metadata` export in the layout
// is dead code -- and a misleading one: it still carried the volatile
// "Access N models from X/M tokens" claim that page-metadata.test.ts exists
// to keep out of the title and description that crawlers and link previews
// actually read.

export default function PricingLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return <MotionProvider>{children}</MotionProvider>;
}
