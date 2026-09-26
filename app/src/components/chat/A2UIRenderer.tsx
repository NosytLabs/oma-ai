"use client";

/**
	* A2UI Renderer — server-driven UI (a2ui.org, v0.9.1)
	*
	* Renders A2UI envelope messages (createSurface / updateComponents /
	* updateDataModel / deleteSurface) into OMA design tokens. Supports:
	* - Adjacency-list component trees (children + single `child` refs)
	* - Data binding via `{ "path": "/a/b" }` against the surface data model
	* - User input is written BACK into that data model, so a Button action's
	*   `{"path":"/email"}` context resolves to what the user actually entered
	*   (spec v0.9.1 "Client to server updates")
	* - Local function calls in props and in `checks[].condition`: formatDate,
	* formatString, required, email, regex, length, numeric, and, or, not
	* - Server actions: Button `action.event` → onAction({name, context, dataModel})
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
import { useCallback, useId, useMemo, useRef, useState, type ReactNode } from "react";

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

type EnvelopeMessage =
	| { kind: "create"; surfaceId: string; catalogId?: string }
	| { kind: "update"; surfaceId: string; components: A2UIComponent[] }
	| { kind: "data"; surfaceId: string; path?: string; value?: unknown }
	| { kind: "delete"; surfaceId: string };

export interface A2UIActionEvent {
	name: string;
	context?: Record<string, unknown>;
	/**
	 * The surface's data model at the moment the action fired, including any
	 * values the user typed. A2UI v0.9.1 "Client to server updates": the
	 * client owns the current data model and echoes it so the server sees
	 * user input, not just the model it originally sent.
	 */
	dataModel?: Record<string, unknown>;
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

/**
 * Resolve a `Dynamic*` value (v0.9.1 common_types): a literal, a
 * `{path}` JSON Pointer binding, or a `{call, args}` FunctionCall, with
 * args themselves resolved recursively.
 *
 * Depth is bounded because nested `and`/`or` trees can reference each
 * other; a malformed payload must not hang the render.
 */
const MAX_CALL_DEPTH = 8;

function resolveValue(value: unknown, data: Record<string, unknown>, depth = 0): unknown {
	if (depth > MAX_CALL_DEPTH) return undefined;
	if (Array.isArray(value)) return value.map((v) => resolveValue(v, data, depth + 1));
	if (value && typeof value === "object") {
		const v = value as Record<string, unknown>;
		if (typeof v.path === "string") return getPath(data, v.path);
		if (typeof v.call === "string") return runLocalCall(v.call, v.args, data, depth + 1);
		// Anything else is a literal object argument (e.g. a config bag).
		return v;
	}
	return value;
}

/** Same as `resolveValue`; kept as the binding-shaped name used by props. */
function resolveBinding(value: unknown, data: Record<string, unknown>): unknown {
	return resolveValue(value, data);
}

function isEmptyValue(value: unknown): boolean {
	if (value === null || value === undefined) return true;
	if (typeof value === "string") return value.trim() === "";
	if (Array.isArray(value)) return value.length === 0;
	return false;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function toNumber(value: unknown): number | null {
	if (value === null || value === undefined || value === "") return null;
	const n = typeof value === "number" ? value : Number(String(value).trim());
	return Number.isFinite(n) ? n : null;
}

function asBoolList(value: unknown): unknown[] {
	return Array.isArray(value) ? value : [];
}

/** Functions that validate a value and are allowed to borrow the control's own. */
const VALIDATORS = new Set(["required", "email", "regex", "length", "numeric"]);

/**
 * Client-side functions from the basic catalog. `args` are already
 * resolved against the data model by `runLocalCall`, so every entry here
 * works with plain JS values.
 */
const LOCAL_FUNCTIONS: Record<string, (args: Record<string, unknown>) => unknown> = {
	formatDate: (args) => {
		const value = args.value;
		const d = typeof value === "number" ? new Date(value) : new Date(String(value ?? ""));
		if (Number.isNaN(d.getTime())) return String(value ?? "");
		try {
			return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(d);
		} catch {
			return d.toISOString();
		}
	},
	formatString: (args) =>
		Object.values(args)
			.filter((p) => p != null)
			.join(""),
	// ── validation functions (returnType: boolean) ──
	required: (args) => !isEmptyValue(args.value),
	email: (args) => EMAIL_RE.test(String(args.value ?? "")),
	regex: (args) => {
		const pattern = String(args.pattern ?? "");
		if (!pattern) return true;
		try {
			return new RegExp(pattern).test(String(args.value ?? ""));
		} catch {
			// A malformed pattern must not wedge the control.
			return true;
		}
	},
	length: (args) => {
		const len = String(args.value ?? "").length;
		const min = toNumber(args.min);
		const max = toNumber(args.max);
		return (min === null || len >= min) && (max === null || len <= max);
	},
	numeric: (args) => {
		const n = toNumber(args.value);
		if (n === null) return false;
		const min = toNumber(args.min);
		const max = toNumber(args.max);
		return (min === null || n >= min) && (max === null || n <= max);
	},
	and: (args) => asBoolList(args.values).every(Boolean),
	or: (args) => asBoolList(args.values).some(Boolean),
	not: (args) => !args.value,
};

function runLocalCall(
	name: string,
	rawArgs: unknown,
	data: Record<string, unknown>,
	depth = 0,
): unknown {
	const fn = LOCAL_FUNCTIONS[name];
	if (!fn) return `[function:${name}]`;
	const args: Record<string, unknown> = {};
	if (rawArgs && typeof rawArgs === "object" && !Array.isArray(rawArgs)) {
		for (const [k, v] of Object.entries(rawArgs as Record<string, unknown>)) {
			args[k] = resolveValue(v, data, depth + 1);
		}
	}
	return fn(args);
}

/**
 * Evaluate a `DynamicBoolean` (v0.9.1) to a boolean.
 *
 * `implicitValue` is substituted when a validation function is called
 * without `args.value`. The spec makes every check name the value it
 * validates, but models routinely emit the bare `{"call":"required"}`
 * form on a control, where the value under validation is obviously the
 * control's own.
 */
function evalCondition(
	condition: unknown,
	data: Record<string, unknown>,
	implicitValue?: unknown,
): boolean {
	if (typeof condition === "boolean") return condition;
	if (typeof condition === "string") return condition.length > 0;
	if (condition && typeof condition === "object" && !Array.isArray(condition)) {
		const c = condition as Record<string, unknown>;
		if (typeof c.path === "string") return Boolean(getPath(data, c.path));
		if (typeof c.call === "string") {
			const rawArgs =
				c.args && typeof c.args === "object" && !Array.isArray(c.args)
					? (c.args as Record<string, unknown>)
					: {};
			const needsImplicit =
				implicitValue !== undefined && !("value" in rawArgs) && VALIDATORS.has(c.call);
			return Boolean(
				runLocalCall(c.call, needsImplicit ? { ...rawArgs, value: implicitValue } : rawArgs, data),
			);
		}
	}
	return false;
}

/**
 * The data-model path a control writes user input to.
 *
 * v0.9.1 expects an editable control's `value` to be a `{"path": "..."}`
 * binding — that path is the control's identity in the data model and is
 * exactly what a Button's `action.event.context` resolves against. An
 * unbound control (a literal `value`, no path) has no model-chosen
 * identity, so it is stored under a deterministic `/fields/<id>` path:
 * still echoed with the action, just not at a path the server picked.
 */
function controlPath(node: A2UIComponent): string {
	const v = node.value;
	if (
		v &&
		typeof v === "object" &&
		!Array.isArray(v) &&
		typeof (v as { path?: unknown }).path === "string"
	) {
		return (v as { path: string }).path;
	}
	return `/fields/${node.id}`;
}

/** Current value of a control: the data model first, then the server's literal. */
function controlValue(node: A2UIComponent, data: Record<string, unknown>): unknown {
	const stored = getPath(data, controlPath(node));
	if (stored !== undefined) return stored;
	return resolveValue(node.value, data);
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
	/**
	 * Write a user-entered value into the surface's data model. Per
	 * v0.9.1 the client owns the data model between server messages, and
	 * every `{"path":...}` binding — including a Button's action context —
	 * must resolve against what the user actually entered.
	 */
	setDataValue: (path: string, value: unknown) => void;
}

/**
 * Run a control's `checks` against the data model and return the messages
 * of the rules that fail.
 *
 * v0.9.1 `CheckRule` is `{condition: DynamicBoolean, message: string}` —
 * the function call lives *under* `condition`, not beside it. The spec
 * prose also shows a flat `{call, args, message}` form, so both are
 * accepted; a rule with neither is ignored rather than treated as failed.
 *
 * `implicitValue` is the control's own value, used for the bare
 * `{"call":"required"}` form that omits `args.value`.
 */
function validateChecks(
	node: A2UIComponent,
	data: Record<string, unknown>,
	implicitValue?: unknown,
): string[] {
	const checks = Array.isArray(node.checks) ? node.checks : [];
	const out: string[] = [];
	for (const raw of checks) {
		if (!raw || typeof raw !== "object" || Array.isArray(raw)) continue;
		const check = raw as Record<string, unknown>;
		const condition =
			check.condition !== undefined
				? check.condition
				: typeof check.call === "string"
					? check
					: undefined;
		if (condition === undefined) continue;
		if (!evalCondition(condition, data, implicitValue)) {
			out.push(String(check.message ?? "Invalid value."));
		}
	}
	return out;
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
	const fieldId = useId();
	const label = String(node.label ?? "");
	const path = controlPath(node);
	// The data model is the single source of truth for this control's
	// value: it is read back on every render, so a server-side
	// `updateDataModel` and the user's own typing cannot diverge.
	const bound = controlValue(node, data);
	const value = typeof bound === "string" ? bound : typeof bound === "number" ? String(bound) : "";
	const [errors, setErrors] = useState<string[]>([]);

	// Validate against a shadow model that already carries the pending
	// value, so a `{"path":"/email"}` check sees the keystroke, not the
	// last committed one.
	const validate = (next: string): string[] => validateChecks(node, setPath(data, path, next), next);

	return (
		<div className="mb-2">
			{label && (
				<label htmlFor={fieldId} className="block text-[10px] font-mono uppercase tracking-wider text-text-muted mb-1">
					{label}
				</label>
			)}
			{(() => {
				// A2UI v0.9.1 enum: `"shortText" | "longText" | "number" |
				// "obscured"`. Previous renderer always emitted `<input
				// type="text">`, which silently downgraded `longText` to a
				// single line and exposed `obscured` as plaintext.
				const variant = String(node.variant ?? "shortText");
				const baseCls = `w-full bg-void border px-2.5 py-1.5 text-xs font-mono text-text placeholder:text-text-muted/50 focus:outline-none ${
					errors.length ? "border-error" : "border-border focus:border-accent"
				}`;
				const onChange = (next: string) => {
				// Write the value into the surface data model, not just local
				// state, so a Button action binding resolves to the user's input.
				ctx.setDataValue(path, next);
				setErrors(validate(next));
			};
				if (variant === "longText") {
					return (
						<textarea
							id={fieldId}
							value={value}
							onChange={(e) => onChange(e.target.value)}
							rows={3}
							className={baseCls}
							placeholder={String(node.placeholder ?? "")}
						/>
					);
				}
				const type =
					variant === "number"
						? "number"
						: variant === "obscured"
							? "password"
							: "text";
				return (
					<input
						id={fieldId}
						type={type}
						value={value}
						onChange={(e) => onChange(e.target.value)}
						className={baseCls}
						placeholder={String(node.placeholder ?? "")}
					/>
				);
			})()}
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
	const path = controlPath(node);
	const bound = Boolean(controlValue(node, data));
	const [errors, setErrors] = useState<string[]>([]);
	const label = String(node.label ?? "");

	const toggle = (next: boolean) => {
		ctx.setDataValue(path, next);
		setErrors(validateChecks(node, setPath(data, path, next), next));
	};

	return (
		<label
			key={node.id}
			className="flex items-center gap-2 mb-2 cursor-pointer group"
		>
			<input
				type="checkbox"
				checked={bound}
				onChange={(e) => toggle(e.target.checked)}
				className="accent-accent w-4 h-4"
			/>
			<span className="text-xs font-mono text-text-secondary group-hover:text-text transition-colors duration-200 ease-out">
				{label}
			</span>
			{errors.map((err, i) => (
				<span
					key={i}
					className="flex items-start gap-1 text-[10px] font-mono text-error"
				>
					<TriangleAlert className="mt-0.5 h-3 w-3 shrink-0" aria-hidden="true" />
					{err}
				</span>
			))}
		</label>
	);
}

function ChoicePickerField({ node, ctx }: { node: A2UIComponent; ctx: RenderCtx }) {
	const data = ctx.surface.dataModel;
	const path = controlPath(node);
	const options = Array.isArray(node.options)
		? (node.options as Array<{ label?: string; value?: string }>)
		: [];
	const bound = controlValue(node, data);
	const selected = Array.isArray(bound)
		? bound.map(String)
		: typeof bound === "string"
			? [bound]
			: [];
	const [errors, setErrors] = useState<string[]>([]);
	// A2UI v0.9.1 enum: `"mutuallyExclusive" | "multipleSelection"`. The
	// legacy draft we used to accept (`"multiSelect"`) is not a spec value —
	// any agent emitting per-spec `"multipleSelection"` would otherwise be
	// silently treated as exclusive.
	const exclusive =
		String(node.variant ?? "mutuallyExclusive") !== "multipleSelection";

	const commit = (next: string[]) => {
		// `mutuallyExclusive` is a DynamicStringList too, so store a
		// one-element list rather than a bare string.
		ctx.setDataValue(path, next);
		setErrors(validateChecks(node, setPath(data, path, next), next));
	};

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
							commit(
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
			{errors.map((err, i) => (
				<span
					key={i}
					className="flex w-full items-start gap-1 text-[10px] font-mono text-error"
				>
					<TriangleAlert className="mt-0.5 h-3 w-3 shrink-0" aria-hidden="true" />
					{err}
				</span>
			))}
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
			const resolved = resolveBinding(raw, data);
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
			const raw = String(resolveBinding(node.markdown ?? node.text ?? "", data) ?? "");
			return (
				<div key={node.id} className="mb-2 text-xs text-text-secondary [&_a]:text-accent [&_code]:font-mono [&_pre]:bg-void [&_pre]:p-2 [&_pre]:border [&_pre]:border-border [&_pre]:overflow-x-auto [&_ul]:list-disc [&_ul]:pl-4 [&_ol]:list-decimal [&_ol]:pl-4 [&_h1]:text-base [&_h2]:text-sm [&_h3]:text-sm [&_h1]:font-bold [&_h2]:font-bold [&_h3]:font-bold [&_h1]:mb-1 [&_h2]:mb-1 [&_h3]:mb-1">
					<ReactMarkdown remarkPlugins={[remarkGfm]}>{raw}</ReactMarkdown>
				</div>
			);
		}
		case "button": {
			const labelNode = node.child ? byId.get(node.child) : undefined;
			const label = labelNode
				? String(resolveBinding(labelNode.text ?? "", data) ?? "")
				: String(resolveBinding(node.label ?? node.text ?? "BUTTON", data) ?? "");
			const url = node.url ? String(node.url) : undefined;
			const action = node.action && typeof node.action === "object" ? (node.action as Record<string, unknown>) : undefined;
			const event = action?.event && typeof action.event === "object" ? (action.event as Record<string, unknown>) : undefined;
		// Map A2UI v0.9.1 button variants to our .btn-mono CSS classes.
		// Spec enum: `default` | `primary` | `borderless`. Legacy/loose
		// values (ghost/outline/danger) collapse to the closest match.
		// NOTE: these must stay two-class combos (e.g. "btn-mono btn-ghost") —
		// the single-dash aliases ("btn-mono-ghost") don't exist in globals.css
		// and render unstyled.
		const variant = String(node.variant ?? "primary");
		const classFor: Record<string, string> = {
			default: "btn-mono",
			primary: "btn-mono btn-primary",
			secondary: "btn-mono",
			ghost: "btn-mono btn-ghost",
			outline: "btn-mono btn-outline",
			borderless: "btn-mono btn-ghost",
			danger: "btn-mono btn-danger",
		};
			const btnClass = classFor[variant] ?? "btn-mono btn-primary";
			if (url) {
				return (
					<a
						key={node.id}
						href={url}
						target="_blank"
						rel="noopener noreferrer"
						className={`${btnClass} flex items-center gap-1.5`}
					>
						<ExternalLink className="w-3 h-3" aria-hidden="true" />
						{label}
					</a>
				);
			}
			if (event) {
				const ctxData: Record<string, unknown> = {};
				for (const [k, v] of Object.entries(event.context ?? {})) {
					ctxData[k] = resolveBinding(v, data);
				}
				// v0.9.1: a Button may carry checks; a failing check disables it.
				// Evaluated against the live data model, so it flips as soon as
				// the user fixes the field the check names.
				const blocked = validateChecks(node, data);
				const disabled = blocked.length > 0;
				return (
					<button
						key={node.id}
						type="button"
						disabled={disabled}
						title={disabled ? blocked.join(" ") : undefined}
						aria-disabled={disabled}
						onClick={() =>
							disabled
								? undefined
								: ctx.onAction?.({
										name: String(event.name),
										context: ctxData,
										// Echo the client data model so the server sees
										// what the user typed, not just what it sent.
										dataModel: data,
									})
						}
						className={`${btnClass} flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed`}
					>
						{label}
						<ChevronRight className="w-3 h-3" aria-hidden="true" />
					</button>
				);
			}
			return (
				<button
					key={node.id}
					type="button"
					className={`${btnClass} flex items-center gap-1.5`}
				>
					{label}
					<ChevronRight className="w-3 h-3" aria-hidden="true" />
				</button>
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
			const title = node.title ? String(resolveBinding(node.title, data) ?? "") : undefined;
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
			const text = String(resolveBinding(node.text ?? "", data) ?? href);
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
	const serverSurfaces = useMemo(() => {
		if (!isA2UI(payload)) return null;
		return applyMessages(parseEnvelopeMessages(payload));
	}, [payload]);

	// The parsed surfaces are the SERVER's data model. User input is layered
	// on top in `edits` so a control's typed value survives re-renders and is
	// what every `{"path":...}` binding resolves against. A new payload (a
	// new message or a streaming update) resets the layer: the server's model
	// is authoritative, and stale keystrokes from a previous surface must not
	// leak into it.
	const [edits, setEdits] = useState<Record<string, Record<string, unknown>>>({});
	const payloadRef = useRef(payload);
	if (payloadRef.current !== payload) {
		payloadRef.current = payload;
		if (Object.keys(edits).length > 0) setEdits({});
	}

	const surfaces = useMemo(() => {
		if (!serverSurfaces) return null;
		if (Object.keys(edits).length === 0) return serverSurfaces;
		return serverSurfaces.map((s) => {
			const layer = edits[s.surfaceId];
			if (!layer) return s;
			return {
				...s,
				dataModel: Object.entries(layer).reduce(
					(acc, [path, value]) => setPath(acc, path, value),
					s.dataModel as Record<string, unknown>,
				),
			};
		});
	}, [serverSurfaces, edits]);

	const setDataValue = useCallback((surfaceId: string, path: string, value: unknown) => {
		setEdits((prev) => ({
			...prev,
			[surfaceId]: { ...prev[surfaceId], [path]: value },
		}));
	}, []);

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
				const ctx: RenderCtx = {
					surface,
					onAction,
					setDataValue: (path, value) => setDataValue(surface.surfaceId, path, value),
				};
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
