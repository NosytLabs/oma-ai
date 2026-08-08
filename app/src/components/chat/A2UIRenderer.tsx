"use client";

/**
 * A2UI Renderer — server-driven UI (a2ui.org, v0.9.1)
 *
 * Renders A2UI envelope messages (createSurface / updateComponents /
 * updateDataModel / deleteSurface) into OMA design tokens. Supports:
 * - Adjacency-list component trees (children + single `child` refs)
 * - Data binding via `{ "path": "/a/b" }` against the surface data model
 * - Local function calls in props/checks: formatDate, formatString,
 * required, email, regex
 * - Server actions: Button `action.event` → onAction({name, context})
 * - JSONL streams (one envelope per line) and single-object payloads
 *
 * Anything unrecognized falls back to a labeled placeholder so the chat
 * message is never empty. Non-A2UI payloads return null so callers can
 * fall back to markdown rendering.
 *
 * Spec: https://a2ui.org/specification/v0.9.1-a2ui/
 */

import { m } from "@/lib/framer-motion-client";
import { springs } from "@/lib/animation";
import { Button } from "@/components/ui/button";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
	AlertCircle,
	Check,
	ChevronRight,
	ExternalLink,
	Home,
	Info,
	Mail,
	Search,
	Settings,
	Sparkles,
	Terminal,
	TriangleAlert,
	User,
	X,
	Zap,
	type LucideIcon,
} from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";

const A2UI_VERSION = "0.9.1";

/* ─────────────────────────── types ─────────────────────────── */

export interface A2UIComponent {
	id: string;
	component: string;
	children?: string[];
	child?: string;
	[key: string]: unknown;
}

interface A2UICreateSurface {
	surfaceId: string;
	catalogId?: string;
	theme?: Record<string, unknown>;
	sendDataModel?: boolean;
}

interface A2UIEnvelope {
	version?: string;
	createSurface?: A2UICreateSurface;
	updateComponents?: { surfaceId: string; components: A2UIComponent[] };
	updateDataModel?: { surfaceId: string; path?: string; value?: unknown };
	deleteSurface?: { surfaceId: string };
}

type EnvelopeMessage =
	| { kind: "create"; surfaceId: string; catalogId?: string }
	| { kind: "update"; surfaceId: string; components: A2UIComponent[] }
	| { kind: "data"; surfaceId: string; path?: string; value?: unknown }
	| { kind: "delete"; surfaceId: string };

export interface A2UIActionEvent {
	name: string;
	context?: Record<string, unknown>;
}

/* ─────────────────────────── detection ─────────────────────────── */

const ENVELOPE_KEYS = [
	"createSurface",
	"updateComponents",
	"updateDataModel",
	"deleteSurface",
] as const;

/** Type guard: does this payload look like an A2UI envelope (or JSONL stream)? */
export function isA2UI(payload: unknown): boolean {
	if (typeof payload === "string") {
		const firstLine = payload.split("\n")[0]?.trim() ?? "";
		if (!firstLine.startsWith("{")) return false;
		try {
			const parsed = JSON.parse(firstLine);
			return ENVELOPE_KEYS.some((k) => k in parsed);
		} catch {
			return false;
		}
	}
	if (!payload || typeof payload !== "object") return false;
	const e = payload as Record<string, unknown>;
	if (ENVELOPE_KEYS.some((k) => k in e)) return true;
	// Legacy shapes (pre-envelope playgrounds): `a2ui` marker, `surfaces`,
	// or a bare component list.
	if (typeof e.a2ui === "string") return true;
	if (Array.isArray(e.surfaces)) return true;
	if (Array.isArray(e.components)) return true;
	return false;
}

/** Normalize any accepted payload into an ordered envelope message list. */
function parseEnvelopeMessages(payload: unknown): EnvelopeMessage[] {
	if (typeof payload === "string") {
		const out: EnvelopeMessage[] = [];
		for (const line of payload.split("\n")) {
			const trimmed = line.trim();
			if (!trimmed.startsWith("{")) continue;
			try {
				out.push(...parseEnvelopeMessages(JSON.parse(trimmed)));
			} catch {
				/* skip malformed lines */
			}
		}
		return out;
	}
	if (!payload || typeof payload !== "object") return [];
	const e = payload as Record<string, unknown>;

	const messages: EnvelopeMessage[] = [];
	if (e.createSurface) {
		const cs = e.createSurface as A2UICreateSurface;
		messages.push({
			kind: "create",
			surfaceId: cs.surfaceId,
			catalogId: cs.catalogId,
		});
	}
	if (Array.isArray(e.components)) {
		// Bare component list (legacy) — synthesize a surface.
		messages.push({
			kind: "create",
			surfaceId: "surface",
			catalogId: "legacy",
		});
		messages.push({ kind: "update", surfaceId: "surface", components: e.components as A2UIComponent[] });
	}
	if (Array.isArray(e.surfaces)) {
		for (const s of e.surfaces as Array<Record<string, unknown>>) {
			const sid = typeof s.surfaceId === "string" ? s.surfaceId : "surface";
			messages.push({ kind: "create", surfaceId: sid, catalogId: "legacy" });
			if (Array.isArray(s.components)) {
				messages.push({ kind: "update", surfaceId: sid, components: s.components as A2UIComponent[] });
			}
		}
	}
	if (e.updateComponents) {
		const uc = e.updateComponents as { surfaceId: string; components: A2UIComponent[] };
		messages.push({ kind: "update", surfaceId: uc.surfaceId, components: uc.components });
	}
	if (e.updateDataModel) {
		const ud = e.updateDataModel as { surfaceId: string; path?: string; value?: unknown };
		messages.push({ kind: "data", surfaceId: ud.surfaceId, path: ud.path, value: ud.value });
	}
	if (e.deleteSurface) {
		const ds = e.deleteSurface as { surfaceId: string };
		messages.push({ kind: "delete", surfaceId: ds.surfaceId });
	}
	return messages;
}

/* ───────────────────── data model helpers ───────────────────── */

function getPath(data: unknown, path?: string): unknown {
	if (!path || path === "/") return data;
	const parts = path.replace(/^\//, "").split("/");
	let cur: unknown = data;
	for (const p of parts) {
		if (cur == null) return undefined;
		cur = (cur as Record<string, unknown>)[p];
	}
	return cur;
}

function setPath(data: Record<string, unknown>, path: string, value: unknown): Record<string, unknown> {
	const parts = path.replace(/^\//, "").split("/");
	const out = structuredClone(data);
	let cur: Record<string, unknown> = out;
	for (let i = 0; i < parts.length - 1; i++) {
		const key = parts[i];
		if (typeof cur[key] !== "object" || cur[key] === null) cur[key] = {};
		cur = cur[key] as Record<string, unknown>;
	}
	cur[parts[parts.length - 1]] = value;
	return out;
}

/** Resolve `{ path }` binding or function-call references against the data model. */
function resolveBinding(
	value: unknown,
	data: Record<string, unknown>,
	runLocalCall: (name: string, args: Record<string, unknown>) => unknown,
): unknown {
	if (value && typeof value === "object" && !Array.isArray(value)) {
		const v = value as Record<string, unknown>;
		if (typeof v.path === "string") return getPath(data, v.path);
		if (typeof v.call === "string") {
			const args = v.args && typeof v.args === "object" ? (v.args as Record<string, unknown>) : {};
			return runLocalCall(v.call, args);
		}
	}
	return value;
}

const LOCAL_FUNCTIONS: Record<string, (...a: unknown[]) => unknown> = {
	formatDate: (value: unknown) => {
		const d = typeof value === "number" ? new Date(value) : new Date(String(value ?? ""));
		if (Number.isNaN(d.getTime())) return String(value ?? "");
		try {
			return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(d);
		} catch {
			return d.toISOString();
		}
	},
	formatString: (...parts: unknown[]) => parts.filter((p) => p != null).join(""),
};

function runLocalCall(name: string, args: Record<string, unknown>): unknown {
	const fn = LOCAL_FUNCTIONS[name];
	if (!fn) return `[function:${name}]`;
	const values = Object.values(args);
	return fn(...values);
}

/* ───────────────────── surface state ───────────────────── */

interface SurfaceState {
	surfaceId: string;
	catalogId?: string;
	components: Map<string, A2UIComponent>;
	dataModel: Record<string, unknown>;
}

function applyMessages(messages: EnvelopeMessage[]): SurfaceState[] {
	const surfaces = new Map<string, SurfaceState>();
	for (const msg of messages) {
		if (msg.kind === "create") {
			if (!surfaces.has(msg.surfaceId)) {
				surfaces.set(msg.surfaceId, {
					surfaceId: msg.surfaceId,
					catalogId: msg.catalogId,
					components: new Map(),
					dataModel: {},
				});
			}
		} else if (msg.kind === "update") {
			const s = surfaces.get(msg.surfaceId);
			if (s) for (const c of msg.components) s.components.set(c.id, c);
		} else if (msg.kind === "data") {
			const s = surfaces.get(msg.surfaceId);
			if (s) {
				if (msg.path && msg.path !== "/") {
					s.dataModel = setPath(s.dataModel, msg.path, msg.value);
				} else {
					s.dataModel = (msg.value && typeof msg.value === "object" ? msg.value : {}) as Record<string, unknown>;
				}
			}
		} else if (msg.kind === "delete") {
			surfaces.delete(msg.surfaceId);
		}
	}
	return [...surfaces.values()];
}

/* ───────────────────── component renderer ───────────────────── */

interface RenderCtx {
	surface: SurfaceState;
	onAction?: (event: A2UIActionEvent) => void;
}

function resolveChildRefs(node: A2UIComponent): string[] {
	if (Array.isArray(node.children)) return node.children.filter((c): c is string => typeof c === "string");
	if (typeof node.child === "string") return [node.child];
	return [];
}

const ICONS: Record<string, LucideIcon> = {
	mail: Mail,
	user: User,
	settings: Settings,
	info: Info,
	alert: AlertCircle,
	check: Check,
	home: Home,
	search: Search,
	sparkles: Sparkles,
	zap: Zap,
	terminal: Terminal,
	external: ExternalLink,
	close: X,
	arrowRight: ChevronRight,
};

function IconGlyph({ name }: { name: string }) {
	const Icon = ICONS[name.toLowerCase()] ?? Sparkles;
	return <Icon className="w-4 h-4 text-accent" aria-hidden="true" />;
}

function TextFieldInput({ node, ctx }: { node: A2UIComponent; ctx: RenderCtx }) {
	const data = ctx.surface.dataModel;
	const label = String(node.label ?? "");
	const bound = resolveBinding(node.value, data, runLocalCall);
	const initial = typeof bound === "string" ? bound : typeof bound === "number" ? String(bound) : "";
	const [value, setValue] = useState(initial);
	const [errors, setErrors] = useState<string[]>([]);

	const validate = (_next: string): string[] => {
		const out: string[] = [];
		for (const check of Array.isArray(node.checks) ? (node.checks as Array<Record<string, unknown>>) : []) {
			const call = String(check.call ?? "");
			const message = String(check.message ?? "Invalid value.");
			const args = (check.args && typeof check.args === "object" ? check.args : {}) as Record<string, unknown>;
			const resolved = resolveBinding(args.value, data, runLocalCall);
			if (call === "required" && !String(resolved ?? "").trim()) out.push(message);
			else if (call === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(resolved ?? ""))) out.push(message);
			else if (call === "regex") {
				const pattern = String(args.pattern ?? "");
				if (pattern && !new RegExp(pattern).test(String(resolved ?? ""))) out.push(message);
			}
		}
		return out;
	};

	return (
		<div className="mb-2">
			{label && (
				<label htmlFor={node.id} className="block text-[10px] font-mono uppercase tracking-wider text-text-muted mb-1">
					{label}
				</label>
			)}
			<input
				id={node.id}
				type="text"
				value={value}
				onChange={(e) => {
					setValue(e.target.value);
					setErrors(validate(e.target.value));
				}}
				className={`w-full bg-void border px-2.5 py-1.5 text-xs font-mono text-text placeholder:text-text-muted/50 focus:outline-none ${
					errors.length ? "border-error" : "border-border focus:border-accent"
				}`}
				placeholder={String(node.placeholder ?? "")}
			/>
			{errors.map((err, i) => (
				<p key={i} className="mt-1 flex items-start gap-1 text-[10px] font-mono text-error">
					<TriangleAlert className="mt-0.5 h-3 w-3 shrink-0" aria-hidden="true" />
					{err}
				</p>
			))}
		</div>
	);
}

function CheckboxField({ node, ctx }: { node: A2UIComponent; ctx: RenderCtx }) {
	const data = ctx.surface.dataModel;
	const bound = Boolean(resolveBinding(node.value, data, runLocalCall));
	const [checked, setChecked] = useState(bound);
	const label = String(node.label ?? "");
	return (
		<label
			key={node.id}
			className="flex items-center gap-2 mb-2 cursor-pointer group"
		>
			<input
				type="checkbox"
				checked={checked}
				onChange={(e) => setChecked(e.target.checked)}
				className="accent-accent w-4 h-4"
			/>
			<span className="text-xs font-mono text-text-secondary group-hover:text-text transition-colors duration-200 ease-out">
				{label}
			</span>
		</label>
	);
}

function ChoicePickerField({ node, ctx }: { node: A2UIComponent; ctx: RenderCtx }) {
	const data = ctx.surface.dataModel;
	const options = Array.isArray(node.options)
		? (node.options as Array<{ label?: string; value?: string }>)
		: [];
	const bound = resolveBinding(node.value, data, runLocalCall);
	const initial = Array.isArray(bound)
		? bound.map(String)
		: typeof bound === "string"
			? [bound]
			: [];
	const [selected, setSelected] = useState<string[]>(initial);
	const exclusive = String(node.variant ?? "mutuallyExclusive") !== "multiSelect";
	return (
		<div key={node.id} className="flex flex-wrap gap-2 mb-2">
			{options.map((opt) => {
				const val = String(opt.value ?? opt.label ?? "");
				const active = selected.includes(val);
				return (
					<button
						key={val}
						type="button"
						onClick={() =>
							setSelected(
								exclusive
									? [val]
									: active
										? selected.filter((s) => s !== val)
										: [...selected, val],
							)
						}
						className={`px-2.5 py-1 text-[11px] font-mono border transition-[background-color,border-color,color] duration-200 ease-out active:scale-[0.97] focus-ring ${
							active
								? "border-accent bg-accent/15 text-accent"
								: "border-border text-text-secondary hover:border-accent/50 hover:text-text"
						}`}
					>
						{opt.label ?? val}
					</button>
				);
			})}
		</div>
	);
}

function renderComponent(
	node: A2UIComponent,
	byId: Map<string, A2UIComponent>,
	ctx: RenderCtx,
	visited: Set<string>,
): ReactNode {
	if (visited.has(node.id)) {
		return (
			<div key={node.id} className="text-[10px] font-mono text-error border border-error/30 px-2 py-1 mb-1">
				{`// CYCLE DETECTED: ${node.id}`}
			</div>
		);
	}
	visited.add(node.id);
	const kind = node.component.toLowerCase();
	const data = ctx.surface.dataModel;

	const renderChild = (cid: string, nested = false) => {
		const child = byId.get(cid);
		return child ? renderComponent(child, byId, ctx, nested ? new Set(visited) : visited) : null;
	};

	switch (kind) {
		case "text": {
			const raw = node.text ?? node.content ?? "";
			const resolved = resolveBinding(raw, data, runLocalCall);
			const text = String(resolved ?? "");
			const variant = String(node.variant ?? "body");
			const cls =
				variant === "h1"
					? "text-xl font-mono font-bold text-text-bright mb-2"
					: variant === "h2"
						? "text-base font-mono font-bold text-text-bright mb-2"
						: variant === "h3"
							? "text-sm font-mono font-bold text-text mb-1.5"
							: variant === "caption" || variant === "label"
								? "text-[10px] font-mono uppercase tracking-wider text-text-muted mb-1"
								: "text-xs font-mono text-text-secondary leading-relaxed mb-2";
			return (
				<p key={node.id} className={cls}>
					{text}
				</p>
			);
		}
		case "markdown": {
			const raw = String(resolveBinding(node.markdown ?? node.text ?? "", data, runLocalCall) ?? "");
			return (
				<div key={node.id} className="mb-2 text-xs text-text-secondary [&_a]:text-accent [&_code]:font-mono [&_pre]:bg-void [&_pre]:p-2 [&_pre]:border [&_pre]:border-border [&_pre]:overflow-x-auto [&_ul]:list-disc [&_ul]:pl-4 [&_ol]:list-decimal [&_ol]:pl-4 [&_h1]:text-base [&_h2]:text-sm [&_h3]:text-sm [&_h1]:font-bold [&_h2]:font-bold [&_h3]:font-bold [&_h1]:mb-1 [&_h2]:mb-1 [&_h3]:mb-1">
					<ReactMarkdown remarkPlugins={[remarkGfm]}>{raw}</ReactMarkdown>
				</div>
			);
		}
		case "button": {
			const labelNode = node.child ? byId.get(node.child) : undefined;
			const label = labelNode
				? String(resolveBinding(labelNode.text ?? "", data, runLocalCall) ?? "")
				: String(resolveBinding(node.label ?? node.text ?? "BUTTON", data, runLocalCall) ?? "");
			const url = node.url ? String(node.url) : undefined;
			const action = node.action && typeof node.action === "object" ? (node.action as Record<string, unknown>) : undefined;
			const event = action?.event && typeof action.event === "object" ? (action.event as Record<string, unknown>) : undefined;
			const variant = String(node.variant ?? "primary");
			const variantMap: Record<string, "primary" | "secondary" | "destructive"> = {
				primary: "primary",
				secondary: "secondary",
				ghost: "secondary",
				outline: "secondary",
				danger: "destructive",
			};
			if (url) {
				return (
					<Button key={node.id} asChild variant="primary" leftIcon={<ExternalLink className="w-3 h-3" />}>
						<a href={url} target="_blank" rel="noopener noreferrer">
							{label}
						</a>
					</Button>
				);
			}
			if (event) {
				const ctxData: Record<string, unknown> = {};
				for (const [k, v] of Object.entries(event.context ?? {})) {
					ctxData[k] = resolveBinding(v, data, runLocalCall);
				}
				return (
					<Button
						key={node.id}
						variant={variantMap[variant] ?? "primary"}
						rightIcon={<ChevronRight className="w-3 h-3" />}
						onClick={() => ctx.onAction?.({ name: String(event.name), context: ctxData })}
					>
						{label}
					</Button>
				);
			}
			return (
				<Button key={node.id} variant={variantMap[variant] ?? "primary"} rightIcon={<ChevronRight className="w-3 h-3" />}>
					{label}
				</Button>
			);
		}
		case "row":
		case "column": {
			const isRow = kind === "row";
			const justify = String(node.justify ?? "start");
			const justifyMap: Record<string, string> = {
				start: "justify-start",
				center: "justify-center",
				end: "justify-end",
				spaceBetween: "justify-between",
				spaceAround: "justify-around",
			};
			const align = String(node.align ?? "start");
			const alignMap: Record<string, string> = {
				start: "items-start",
				center: "items-center",
				end: "items-end",
				stretch: "items-stretch",
			};
			return (
				<div
					key={node.id}
					className={`${isRow ? `flex flex-row flex-wrap gap-2 ${justifyMap[justify] ?? "justify-start"} ${alignMap[align] ?? "items-start"}` : "flex flex-col gap-1"} mb-2`}
				>
					{resolveChildRefs(node).map((cid) => renderChild(cid, true))}
				</div>
			);
		}
		case "card": {
			const title = node.title ? String(resolveBinding(node.title, data, runLocalCall) ?? "") : undefined;
			return (
				<m.div
					key={node.id}
					initial={{ opacity: 0, y: 4 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ delay: 0.08, ...springs.soft }}
					className="border border-border bg-void p-3 mb-2"
				>
					{title && (
						<div className="text-[11px] font-mono font-bold text-text-secondary uppercase tracking-wider mb-2">{title}</div>
					)}
					<div className="flex flex-col gap-1">{resolveChildRefs(node).map((cid) => renderChild(cid, true))}</div>
				</m.div>
			);
		}
		case "divider": {
			const axis = String(node.axis ?? "horizontal");
			return axis === "vertical" ? (
				<div key={node.id} className="w-px self-stretch bg-border mx-1" />
			) : (
				<hr key={node.id} className="border-border my-2" />
			);
		}
		case "icon": {
			return <IconGlyph key={node.id} name={String(node.name ?? "sparkles")} />;
		}
		case "image": {
			const src = String(node.url ?? node.src ?? "");
			if (!src) return null;
			// A2UI image sources come from the model's tool-call output and
			// may point at any third-party CDN — `next/image` requires a
			// configured remotePatterns entry, so a plain <img> is the
			// only option that works without a per-deployment allowlist.
			return (
				/* eslint-disable-next-line @next/next/no-img-element */
				<img
					key={node.id}
					src={src}
					alt={String(node.alt ?? "image")}
					className="max-w-full h-auto border border-border mb-2"
				/>
			);
		}
		case "link": {
			const href = String(node.url ?? node.href ?? "#");
			const text = String(resolveBinding(node.text ?? "", data, runLocalCall) ?? href);
			return (
				<a key={node.id} href={href} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline text-xs font-mono mb-2 inline-flex items-center gap-1">
					{text} <ExternalLink className="w-3 h-3" />
				</a>
			);
		}
		case "checkbox": {
			return <CheckboxField key={node.id} node={node} ctx={ctx} />;
		}
		case "choicepicker": {
			return <ChoicePickerField key={node.id} node={node} ctx={ctx} />;
		}
		case "textfield": {
			return <TextFieldInput key={node.id} node={node} ctx={ctx} />;
		}
		case "list": {
			return (
				<ul key={node.id} className="mb-2 flex flex-col gap-1">
					{resolveChildRefs(node).map((cid) => (
						<li key={cid} className="flex items-start gap-2">
							<span className="text-accent mt-1">▸</span>
							<div className="min-w-0 flex-1">{renderChild(cid, true)}</div>
						</li>
					))}
				</ul>
			);
		}
		case "spinner":
			return (
				<div key={node.id} className="flex items-center gap-2 text-[10px] font-mono text-text-muted mb-2">
					<span className="inline-block w-3 h-3 border border-accent/40 border-t-accent rounded-full animate-spin" />
					{String(node.label ?? "loading…")}
				</div>
			);
		default:
			return (
				<div
					key={node.id}
					className="text-[10px] font-mono text-text-muted border border-dashed border-border px-2 py-1 mb-1"
				>
					{`// UNKNOWN A2UI COMPONENT: ${node.component}`}
				</div>
			);
	}
}

/* ───────────────────── top-level renderer ───────────────────── */

export interface A2UIRendererProps {
	payload: unknown;
	onAction?: (event: A2UIActionEvent) => void;
}

export function A2UIRenderer({ payload, onAction }: A2UIRendererProps) {
	const surfaces = useMemo(() => {
		if (!isA2UI(payload)) return null;
		return applyMessages(parseEnvelopeMessages(payload));
	}, [payload]);

	if (!surfaces) return null;

	if (surfaces.length === 0) {
		return (
			<div className="text-[11px] text-text-muted font-mono">
				{"// EMPTY A2UI SURFACE (v" + A2UI_VERSION + ")"}
			</div>
		);
	}

	return (
		<div className="w-full">
			{surfaces.map((surface) => {
				const byId = surface.components;
				const referenced = new Set<string>();
				for (const c of byId.values()) for (const cid of resolveChildRefs(c)) referenced.add(cid);
				const rootIds = [...byId.values()].filter((c) => !referenced.has(c.id)).map((c) => c.id);
				const ctx: RenderCtx = { surface, onAction };
				return (
					<div
						key={surface.surfaceId}
						className="border border-border bg-surface p-3 my-2"
						data-a2ui-version={A2UI_VERSION}
						data-a2ui-surface={surface.surfaceId}
					>
						<div className="flex items-center justify-between text-[10px] font-mono text-text-muted uppercase tracking-widest mb-2">
							<span>{`// A2UI v${A2UI_VERSION} · ${surface.surfaceId}`}</span>
							<span>{`${byId.size} COMPONENT${byId.size === 1 ? "" : "S"}`}</span>
						</div>
						{rootIds.map((id) => {
							const node = byId.get(id);
							return node ? renderComponent(node, byId, ctx, new Set()) : null;
						})}
					</div>
				);
			})}
		</div>
	);
}
