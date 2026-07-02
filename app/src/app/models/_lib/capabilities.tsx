// Shared capability metadata used by /models listing and /models/[slug] detail.
// Lives in a non-`'use client'` module so server components (the detail page)
// can import the icon map without dragging the listing page's client bundle.

import { Brain, Code, Cpu, Eye, Hash, Zap as ZapIcon } from "lucide-react";
import type { Capability } from "@/lib/models-data";

const ICON_PROPS = { strokeWidth: 1.5 } as const;

export const CAPABILITY_ICONS: Record<Capability, React.ReactNode> = {
	reasoning: (
		<Brain className="h-3.5 w-3.5" aria-hidden="true" {...ICON_PROPS} />
	),
	coding: <Code className="h-3.5 w-3.5" aria-hidden="true" {...ICON_PROPS} />,
	multimodal: (
		<Eye className="h-3.5 w-3.5" aria-hidden="true" {...ICON_PROPS} />
	),
	vision: <Eye className="h-3.5 w-3.5" aria-hidden="true" {...ICON_PROPS} />,
	fast: <ZapIcon className="h-3.5 w-3.5" aria-hidden="true" {...ICON_PROPS} />,
	uncensored: (
		<Cpu className="h-3.5 w-3.5" aria-hidden="true" {...ICON_PROPS} />
	),
	agents: <Cpu className="h-3.5 w-3.5" aria-hidden="true" {...ICON_PROPS} />,
	math: <Hash className="h-3.5 w-3.5" aria-hidden="true" {...ICON_PROPS} />,
	chat: <Brain className="h-3.5 w-3.5" aria-hidden="true" {...ICON_PROPS} />,
};

export const CAPABILITY_LABELS: Record<Capability, string> = {
	reasoning: "Reasoning",
	coding: "Coding",
	multimodal: "Multimodal",
	vision: "Vision",
	fast: "Fast",
	uncensored: "Uncensored",
	agents: "Agents",
	math: "Math",
	chat: "Chat",
};
