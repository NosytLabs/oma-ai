import { CHAT_PARAM_BOUNDS } from "@/lib/chat-params-storage";

export interface OpenUIChatSettings {
	model?: string;
	temperature?: number;
	topP?: number;
	maxTokens?: number;
}

export type OpenUIAction =
	| { type: "followup"; prompt: string }
	| { type: "apply-settings"; settings: OpenUIChatSettings };

export type OpenUIActionHandler = (
	action: OpenUIAction,
) => void | Promise<void>;

/** Narrow an untrusted renderer event to the only operations OMA permits. */
export function normalizeOpenUIAction(_event: unknown): OpenUIAction | null {
	if (!isRecord(_event) || typeof _event.type !== "string") return null;
	const params = isRecord(_event.params) ? _event.params : {};
	const formData = readFormValues(_event);

	if (_event.type === "followup") {
		const prompt = typeof params.prompt === "string" ? params.prompt.trim() : "";
		return prompt && prompt.length <= 4_000
			? { type: "followup", prompt }
			: null;
	}

	if (_event.type !== "apply-settings") return null;
	const source = { ...params, ...formData };
	const settings: OpenUIChatSettings = {};

	if (source.model !== undefined) {
		if (typeof source.model !== "string") return null;
		const model = source.model.trim();
		if (!model || model.length > 256) return null;
		settings.model = model;
	}

	const temperature = optionalNumber(
		source.temperature,
		...CHAT_PARAM_BOUNDS.temperature,
	);
	if (temperature === INVALID_NUMBER) return null;
	if (temperature !== undefined) settings.temperature = temperature;

	const topP = optionalNumber(source.topP, ...CHAT_PARAM_BOUNDS.topP);
	if (topP === INVALID_NUMBER) return null;
	if (topP !== undefined) settings.topP = topP;

	const maxTokens = optionalNumber(
		source.maxTokens,
		...CHAT_PARAM_BOUNDS.maxTokens,
		true,
	);
	if (maxTokens === INVALID_NUMBER) return null;
	if (maxTokens !== undefined) settings.maxTokens = maxTokens;

	return Object.keys(settings).length > 0
		? { type: "apply-settings", settings }
		: null;
}

const INVALID_NUMBER = Symbol("invalid-number");

function optionalNumber(
	value: unknown,
	min: number,
	max: number,
	integer = false,
): number | undefined | typeof INVALID_NUMBER {
	if (value === undefined || value === "") return undefined;
	const parsed =
		typeof value === "number"
			? value
			: typeof value === "string"
				? Number(value)
				: Number.NaN;
	if (
		!Number.isFinite(parsed) ||
		parsed < min ||
		parsed > max ||
		(integer && !Number.isInteger(parsed))
	) {
		return INVALID_NUMBER;
	}
	return parsed;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readFormValues(event: Record<string, unknown>): Record<string, unknown> {
	const legacy = isRecord(event.formData) ? event.formData : {};
	const formState = event.formState;
	if (!isRecord(formState)) return legacy;
	const namedForm =
		typeof event.formName === "string" ? formState[event.formName] : undefined;
	const omaSettings = formState["oma-settings"];
	const named: Record<string, unknown> =
		isRecord(namedForm)
			? namedForm
			: isRecord(omaSettings)
				? omaSettings
				: formState;
	return Object.fromEntries(
		Object.entries(named).map(([key, wrapped]) => [
			key,
			isRecord(wrapped) && "value" in wrapped ? wrapped.value : wrapped,
		]),
	);
}
