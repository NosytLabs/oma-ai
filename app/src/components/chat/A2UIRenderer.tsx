"use client";

/**
 * A2UI Renderer
 *
 * A2UI v0.9.1 is a server-driven UI protocol. Server responses with
 * `Content-Type: application/a2ui+json` carry a JSON envelope describing
 * one or more surface updates (begin, add, remove, set, etc.) that the
 * client renders into a tree of standard components.
 *
 * Spec: https://a2ui.org/specification/v0.9.1-a2ui/
 *
 * Detects A2UI payloads (msg.a2ui field or a2uiEnvelope-shaped JSON
 * content) and renders the basic Text/Button/Row/Column primitives
 * using OMA design tokens. Any component or surface we don't recognize
 * falls through to plain markdown rendering so the chat message is
 * never empty.
 */

import { m } from "@/lib/framer-motion-client";
import { AlertCircle, ChevronRight, ExternalLink } from "lucide-react";
import type { ReactNode } from "react";

export const A2UI_VERSION = "0.9.1";

export interface A2UISurfaceUpdate {
	type?: string;
	surfaceId?: string;
	components?: A2UIComponent[];
}

export interface A2UIComponent {
	id: string;
	component: string;
	props?: Record<string, unknown>;
	children?: string[];
}

export interface A2UIEnvelope {
	a2ui?: string;
	surfaces?: A2UISurfaceUpdate[];
	components?: A2UIComponent[];
}

/** Type guard: does this payload look like an A2UI envelope? */
export function isA2UI(payload: unknown): payload is A2UIEnvelope {
	if (!payload || typeof payload !== "object") return false;
	const e = payload as A2UIEnvelope;
	if (e.a2ui && typeof e.a2ui === "string") return true;
	if (Array.isArray(e.surfaces) && e.surfaces.length > 0) return true;
	if (Array.isArray(e.components) && e.components.length > 0) return true;
	return false;
}

interface A2UIRendererProps {
	payload: unknown;
}

/**
 * Render an A2UI envelope. This is intentionally minimal — the playground
 * only consumes a handful of primitives today (Text, Button, Row, Column,
 * Divider). Anything we don't recognize is rendered as a labeled placeholder
 * so the surface is at least inspectable.
 */
export function A2UIRenderer({ payload }: A2UIRendererProps) {
	if (!isA2UI(payload)) {
		return (
			<div className="flex items-center gap-2 text-[11px] text-text-muted font-mono">
				<AlertCircle className="w-3 h-3" />
				<span>NOT AN A2UI ENVELOPE · FALLING BACK TO MARKDOWN</span>
			</div>
		);
	}

	const components = collectComponents(payload);
	if (components.length === 0) {
		return (
			<div className="text-[11px] text-text-muted font-mono">
				{/* EMPTY A2UI SURFACE (v{A2UI_VERSION}) */}
			</div>
		);
	}

	const byId = new Map(components.map((c) => [c.id, c]));
	const rootIds = findRoots(components);

	return (
		<div
			className="border border-border bg-surface p-3 my-2"
			data-a2ui-version={A2UI_VERSION}
		>
			<div className="text-[10px] font-mono text-text-muted uppercase tracking-widest mb-2">
				{`// A2UI v${A2UI_VERSION} · ${components.length} COMPONENT${components.length === 1 ? "" : "S"}`}
			</div>
			{rootIds.map((id) => {
				const node = byId.get(id);
				return node ? renderComponent(node, byId) : null;
			})}
		</div>
	);
}

function collectComponents(payload: A2UIEnvelope): A2UIComponent[] {
	if (Array.isArray(payload.components)) return payload.components;
	if (Array.isArray(payload.surfaces)) {
		return payload.surfaces.flatMap((s) => s.components ?? []);
	}
	return [];
}

/** A node is a root if no other node lists it as a child. */
function findRoots(components: A2UIComponent[]): string[] {
	const referenced = new Set<string>();
	for (const c of components) {
		for (const childId of c.children ?? []) referenced.add(childId);
	}
	return components.filter((c) => !referenced.has(c.id)).map((c) => c.id);
}

function renderComponent(
	node: A2UIComponent,
	byId: Map<string, A2UIComponent>,
	visited: Set<string> = new Set(),
): ReactNode {
	if (visited.has(node.id)) {
		return (
			<div
				key={node.id}
				className="text-[10px] font-mono text-error border border-error/30 px-2 py-1 mb-1"
			>
				{`// CYCLE DETECTED: ${node.id}`}
			</div>
		);
	}
	visited.add(node.id);

	const kind = node.component.toLowerCase();
	const props = node.props ?? {};

	switch (kind) {
		case "text":
		case "paragraph": {
			const text = String(props.text ?? props.content ?? "");
			const variant = String(props.variant ?? "body");
			const className =
				variant === "heading"
					? "text-sm font-mono font-bold text-text mb-1"
					: variant === "caption"
						? "text-[10px] font-mono text-text-muted mb-1"
						: "text-xs font-mono text-text-secondary leading-relaxed mb-2";
			return (
				<p key={node.id} className={className}>
					{text}
				</p>
			);
		}
		case "button": {
			const label = String(props.label ?? props.text ?? "BUTTON");
			const url = props.url ? String(props.url) : undefined;
			const className =
				"inline-flex items-center gap-1 px-3 py-1.5 border border-success/30 bg-success/10 text-success text-[11px] font-mono font-bold uppercase tracking-widest hover:bg-success/20 transition-colors mb-2";
			if (url) {
				return (
					<a
						key={node.id}
						href={url}
						target="_blank"
						rel="noopener noreferrer"
						className={className}
					>
						{label}
						<ExternalLink className="w-3 h-3" />
					</a>
				);
			}
			return (
				<button key={node.id} className={className} type="button">
					{label}
					<ChevronRight className="w-3 h-3" />
				</button>
			);
		}
		case "row":
			return (
				<div
					key={node.id}
					className="flex flex-row flex-wrap items-center gap-2 mb-2"
				>
					{(node.children ?? []).map((cid) => {
						const child = byId.get(cid);
						return child
							? renderComponent(child, byId, new Set(visited))
							: null;
					})}
				</div>
			);
		case "column":
			return (
				<div key={node.id} className="flex flex-col gap-1 mb-2">
					{(node.children ?? []).map((cid) => {
						const child = byId.get(cid);
						return child
							? renderComponent(child, byId, new Set(visited))
							: null;
					})}
				</div>
			);
		case "divider":
			return <hr key={node.id} className="border-border my-2" />;
		case "card": {
			const title = props.title ? String(props.title) : undefined;
			return (
				<m.div
					key={node.id}
					initial={{ opacity: 0, y: 4 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ duration: 0.15 }}
					className="border border-border bg-void p-3 mb-2"
				>
					{title && (
						<div className="text-[11px] font-mono font-bold text-text-secondary uppercase tracking-wider mb-2">
							{title}
						</div>
					)}
					<div className="flex flex-col gap-1">
						{(node.children ?? []).map((cid) => {
							const child = byId.get(cid);
							return child
								? renderComponent(child, byId, new Set(visited))
								: null;
						})}
					</div>
				</m.div>
			);
		}
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
