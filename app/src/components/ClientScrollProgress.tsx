"use client";

import dynamic from "next/dynamic";

const ScrollProgress = dynamic(
	() =>
		import("@/components/scroll-progress").then((mod) => ({
			default: mod.ScrollProgress,
		})),
	{ ssr: false },
);

export function ClientScrollProgress() {
	return <ScrollProgress />;
}
