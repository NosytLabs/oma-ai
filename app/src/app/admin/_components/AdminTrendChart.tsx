"use client";

import { Area, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { UsageBucket } from "./AdminAnalytics";
import { formatUsdPrecise } from "@/lib/utils";

export default function AdminTrendChart({ items, kind, hourly }: { items: UsageBucket[]; kind: "traffic" | "revenue"; hourly: boolean }) {
	const revenue = kind === "revenue";
	const data = items.map(item => ({ ...item, billed: item.billedCents / 100, upstream: item.knownUpstreamCents / 100 }));
	const dateLabel = (value: string) => new Intl.DateTimeFormat("en-US", hourly
		? { hour: "numeric", timeZone: "UTC" } : { month: "short", day: "numeric", timeZone: "UTC" }).format(new Date(value));
	return <div className="h-64 min-w-0" aria-label={revenue ? "Customer charges and known upstream cost trend" : "Recorded requests and errors trend"}>
		<ResponsiveContainer width="100%" height="100%" minWidth={0}>
			<ComposedChart data={data} accessibilityLayer margin={{ top: 12, right: 12, left: 0, bottom: 0 }}>
				<CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" vertical={false} />
				<XAxis dataKey="at" tickFormatter={dateLabel} stroke="var(--color-text-muted)" fontSize={11} tickLine={false} axisLine={false} minTickGap={24} />
				<YAxis width={revenue ? 88 : 56} allowDecimals={revenue} stroke="var(--color-text-muted)" fontSize={11} tickLine={false} axisLine={false}
					tickFormatter={value => revenue ? formatUsdPrecise(Number(value)) : Number(value).toLocaleString()} />
				<Tooltip labelFormatter={value => `${dateLabel(String(value))} UTC`} contentStyle={{ background: "var(--color-surface)", borderColor: "var(--color-border)", borderRadius: 8, fontSize: 12 }}
					formatter={(value, name) => [revenue ? formatUsdPrecise(Number(value)) : Number(value).toLocaleString(), name]} />
				<Area type="linear" dataKey={revenue ? "billed" : "requests"} name={revenue ? "Customer charges" : "Requests"} stroke="var(--color-accent)" fill="var(--color-accent)" fillOpacity={0.12} strokeWidth={2} isAnimationActive={false} />
				<Line type="linear" dataKey={revenue ? "upstream" : "errors"} name={revenue ? "Known cost estimate" : "Errors"} stroke={revenue ? "var(--color-secondary)" : "var(--color-error)"} strokeWidth={2} dot={false} isAnimationActive={false} />
			</ComposedChart>
		</ResponsiveContainer>
	</div>;
}
