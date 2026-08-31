"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { copyToClipboard } from "@/lib/clipboard";

export function CopyableCode({
	code,
	"aria-label": ariaLabel,
}: {
	code: string;
	"aria-label"?: string;
}) {
	const [copied, setCopied] = useState(false);

	return (
		<div className="group/code relative">
			<pre
				tabIndex={0}
				aria-label={ariaLabel}
				className="overflow-x-auto rounded-[var(--radius-md)] border border-border bg-void p-4 text-xs font-mono text-text-secondary leading-relaxed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent pr-16"
			>
				{code}
			</pre>
			<button
				type="button"
				onClick={() => {
					void copyToClipboard(code).then((ok) => {
						if (!ok) return;
						setCopied(true);
						setTimeout(() => setCopied(false), 2000);
					});
				}}
				className={`absolute right-3 top-3 z-10 inline-flex items-center gap-1.5 rounded-[var(--radius-md)] border bg-surface/95 px-2.5 py-1.5 text-[11px] font-mono font-semibold uppercase tracking-wider backdrop-blur-sm transition-[background-color,border-color,color,transform] duration-200 ease-out hover:border-accent/60 hover:text-accent active:scale-[0.95] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
					copied
						? "border-success/60 text-success"
						: "border-border text-text-secondary"
				}`}
				aria-label={copied ? "Copied" : "Copy code"}
			>
				{copied ? (
					<>
						<Check className="h-3.5 w-3.5" />
						<span>Copied</span>
					</>
				) : (
					<>
						<Copy className="h-3.5 w-3.5" />
						<span>Copy</span>
					</>
				)}
			</button>
		</div>
	);
}
