"use client";

import "@/lib/openui-disable-devtools";
import {
	FormNameContext,
	createLibrary,
	createParser,
	defineComponent,
	useIsStreaming,
	useRenderNode,
	useStateField,
	useTriggerAction,
} from "@openuidev/react-lang";
import { z } from "zod/v4";
import { useSharedLiveModelCatalog } from "@/components/chat/chat-message-shared";
import { useOpenUIActionPending } from "@/lib/openui-action-state";
import { CHAT_PARAM_BOUNDS } from "@/lib/chat-params-storage";

const Text = defineComponent({
	name: "Text",
	description: "Displays concise text. Use tone='muted' for supporting details.",
	props: z.object({
		content: z.string().describe("Text to display"),
		tone: z.enum(["default", "muted", "accent"]).optional(),
	}),
	component: ({ props }) => (
		<p
			className={
				props.tone === "muted"
					? "text-sm text-text-muted"
					: props.tone === "accent"
						? "text-sm font-medium text-accent"
						: "text-sm text-text-primary"
			}
		>
			{props.content}
		</p>
	),
});

const Button = defineComponent({
	name: "Button",
	description:
		"Sends a safe conversational follow-up. It cannot call arbitrary URLs or backend operations.",
	props: z.object({
		label: z.string().describe("Short visible button label"),
		prompt: z.string().describe("Follow-up prompt sent to the assistant"),
	}),
	component: ({ props }) => {
		const triggerAction = useTriggerAction();
		const isStreaming = useIsStreaming();
		const actionPending = useOpenUIActionPending();
		return (
			<button
				type="button"
				disabled={isStreaming || actionPending}
				onClick={() => {
					void triggerAction(props.label, undefined, {
						type: "followup",
						params: { prompt: props.prompt },
					});
				}}
				className="min-h-10 rounded-[var(--radius-md)] border border-accent/40 bg-accent/10 px-3 py-2 text-xs font-semibold text-accent transition-colors hover:bg-accent/20 disabled:cursor-not-allowed disabled:opacity-50"
			>
				{props.label}
			</button>
		);
	},
});

const ModelComparison = defineComponent({
	name: "ModelComparison",
	description:
		"Compares 2-5 OMA model IDs using the live catalog. Never invent model names, context, availability, or prices.",
	props: z.object({
		modelIds: z.array(z.string()).min(2).max(5),
	}),
	component: ({ props }) => {
		const { models, status } = useSharedLiveModelCatalog();
		const requested = props.modelIds
			.map((id) => models.find((model) => model.id === id))
			.filter((model): model is NonNullable<typeof model> => !!model);
		return (
			<div className="max-w-full overflow-x-auto rounded-[var(--radius-lg)] border border-border">
				<div className="flex items-center justify-between border-b border-border bg-surface/60 px-3 py-2">
					<span className="text-[10px] font-mono uppercase tracking-wider text-text-muted">
						Model comparison
					</span>
					<span className="text-[10px] font-mono text-text-muted">
						{status === "live" ? "Live catalog" : "Catalog fallback"}
					</span>
				</div>
				<table className="w-full min-w-[520px] text-left text-xs">
					<thead className="bg-surface/40 text-[10px] font-mono uppercase tracking-wider text-text-muted">
						<tr>
							<th className="px-3 py-2 font-medium">Model</th>
							<th className="px-3 py-2 font-medium">Provider</th>
							<th className="px-3 py-2 font-medium">Context</th>
							<th className="px-3 py-2 font-medium">Input / output per 1M</th>
						</tr>
					</thead>
					<tbody className="divide-y divide-border">
						{requested.map((model) => (
							<tr key={model.id}>
								<td className="px-3 py-2 font-medium text-text-primary">
									{model.name}
								</td>
								<td className="px-3 py-2 text-text-secondary">{model.provider}</td>
								<td className="px-3 py-2 text-text-secondary">{model.ctx}</td>
								<td className="px-3 py-2 font-mono text-text-secondary">
									{model.pricingAvailable
										? `$${model.inputPer1M.toFixed(2)} / $${model.outputPer1M.toFixed(2)}`
										: "Unavailable"}
								</td>
							</tr>
						))}
					</tbody>
				</table>
				{requested.length === 0 && (
					<p className="px-3 py-4 text-sm text-text-muted">
						Those model IDs are not in the current OMA catalog.
					</p>
				)}
			</div>
		);
	},
});

function SettingsFields({
	model: defaultModel,
	temperature: defaultTemperature,
	topP: defaultTopP,
	maxTokens: defaultMaxTokens,
}: {
	model: string;
	temperature: number;
	topP: number;
	maxTokens: number;
}) {
	const { models, status } = useSharedLiveModelCatalog();
	const isStreaming = useIsStreaming();
	const actionPending = useOpenUIActionPending();
	const triggerAction = useTriggerAction();
	const safeDefaultModel = models.some((model) => model.id === defaultModel)
		? defaultModel
		: (models.find((model) => model.available !== false)?.id ?? defaultModel);
	const model = useStateField("model", safeDefaultModel);
	const temperature = useStateField("temperature", defaultTemperature);
	const topP = useStateField("topP", defaultTopP);
	const maxTokens = useStateField("maxTokens", defaultMaxTokens);

	return (
		<div className="space-y-3">
			<label className="block space-y-1 text-xs text-text-secondary">
				<span>Model</span>
				<select
					aria-label="Model"
					value={String(model.value ?? safeDefaultModel)}
					onChange={(event) => model.setValue(event.currentTarget.value)}
					disabled={isStreaming || actionPending || models.length === 0}
					className="min-h-10 w-full rounded-[var(--radius-md)] border border-border bg-void px-3 py-2 text-sm text-text-primary disabled:opacity-50"
				>
					{models
						.filter((item) => item.available !== false)
						.map((item) => (
							<option key={item.id} value={item.id}>
								{item.name}
							</option>
						))}
				</select>
			</label>
			<div className="grid gap-3 sm:grid-cols-3">
				<NumberField
					label="Temperature"
					value={Number(temperature.value)}
					min={CHAT_PARAM_BOUNDS.temperature[0]}
					max={CHAT_PARAM_BOUNDS.temperature[1]}
					step={0.1}
					disabled={isStreaming || actionPending}
					onChange={temperature.setValue}
				/>
				<NumberField
					label="Top P"
					value={Number(topP.value)}
					min={CHAT_PARAM_BOUNDS.topP[0]}
					max={CHAT_PARAM_BOUNDS.topP[1]}
					step={0.05}
					disabled={isStreaming || actionPending}
					onChange={topP.setValue}
				/>
				<NumberField
					label="Max tokens"
					value={Number(maxTokens.value)}
					min={CHAT_PARAM_BOUNDS.maxTokens[0]}
					max={CHAT_PARAM_BOUNDS.maxTokens[1]}
					step={1}
					disabled={isStreaming || actionPending}
					onChange={maxTokens.setValue}
				/>
			</div>
			<div className="flex items-center justify-between gap-3">
				<span className="text-[10px] font-mono text-text-muted">
					{status === "live" ? "Live catalog" : "Catalog fallback"}
				</span>
				<button
					type="button"
					aria-label="Apply settings"
					disabled={isStreaming || actionPending}
					onClick={() => {
						void triggerAction("Apply settings", "oma-settings", {
							type: "apply-settings",
							params: {
								model: model.value,
								temperature: temperature.value,
								topP: topP.value,
								maxTokens: maxTokens.value,
							},
						});
					}}
					className="min-h-10 rounded-[var(--radius-md)] bg-accent px-4 py-2 text-xs font-semibold text-void disabled:cursor-not-allowed disabled:opacity-50"
				>
					Apply settings
				</button>
			</div>
		</div>
	);
}

function NumberField({
	label,
	value,
	min,
	max,
	step,
	disabled,
	onChange,
}: {
	label: string;
	value: number;
	min: number;
	max: number;
	step: number;
	disabled: boolean;
	onChange: (value: number) => void;
}) {
	return (
		<label className="block space-y-1 text-xs text-text-secondary">
			<span>{label}</span>
			<input
				type="number"
				aria-label={label}
				value={Number.isFinite(value) ? value : ""}
				min={min}
				max={max}
				step={step}
				disabled={disabled}
				onChange={(event) => onChange(Number(event.currentTarget.value))}
				className="min-h-10 w-full rounded-[var(--radius-md)] border border-border bg-void px-3 py-2 font-mono text-sm text-text-primary disabled:opacity-50"
			/>
		</label>
	);
}

const SettingsForm = defineComponent({
	name: "SettingsForm",
	description:
		`Edits real OMA request settings. Model must be an existing model ID. Temperature is ${CHAT_PARAM_BOUNDS.temperature[0]}-${CHAT_PARAM_BOUNDS.temperature[1]}, topP is ${CHAT_PARAM_BOUNDS.topP[0]}-${CHAT_PARAM_BOUNDS.topP[1]}, maxTokens is ${CHAT_PARAM_BOUNDS.maxTokens[0]}-${CHAT_PARAM_BOUNDS.maxTokens[1]}.`,
	props: z.object({
		model: z.string(),
		temperature: z
			.number()
			.min(CHAT_PARAM_BOUNDS.temperature[0])
			.max(CHAT_PARAM_BOUNDS.temperature[1]),
		topP: z
			.number()
			.min(CHAT_PARAM_BOUNDS.topP[0])
			.max(CHAT_PARAM_BOUNDS.topP[1]),
		maxTokens: z
			.number()
			.int()
			.min(CHAT_PARAM_BOUNDS.maxTokens[0])
			.max(CHAT_PARAM_BOUNDS.maxTokens[1]),
	}),
	component: ({ props }) => (
		<FormNameContext.Provider value="oma-settings">
			<SettingsFields {...props} />
		</FormNameContext.Provider>
	),
});

const Leaf = z.union([
	Text.ref,
	Button.ref,
	ModelComparison.ref,
	SettingsForm.ref,
]);

const Stack = defineComponent({
	name: "Stack",
	description: "Arranges generated content in a compact vertical or horizontal stack.",
	props: z.object({
		children: z.array(Leaf),
		direction: z.enum(["vertical", "horizontal"]).optional(),
	}),
	component: ({ props }) => {
		const renderNode = useRenderNode();
		return (
			<div
				className={
					props.direction === "horizontal"
						? "flex flex-wrap items-start gap-3"
						: "flex flex-col gap-3"
				}
			>
				{props.children.map((child, index) => (
					<div key={`${child.typeName}-${index}`}>
						{renderNode(child)}
					</div>
				))}
			</div>
		);
	},
});

const CardChild = z.union([
	Text.ref,
	Button.ref,
	ModelComparison.ref,
	SettingsForm.ref,
	Stack.ref,
]);

const Card = defineComponent({
	name: "Card",
	description:
		"Root container for an OMA interface. Give it a clear title and a short ordered list of useful children.",
	props: z.object({
		title: z.string(),
		children: z.array(CardChild),
	}),
	component: ({ props }) => {
		const renderNode = useRenderNode();
		return (
			<section className="min-w-0 space-y-4 rounded-[var(--radius-lg)] border border-border bg-surface/40 p-4">
				<h3 className="text-sm font-semibold text-text-bright">{props.title}</h3>
				<div className="space-y-3">
					{props.children.map((child, index) => (
						<div key={`${child.typeName}-${index}`}>
							{renderNode(child)}
						</div>
					))}
				</div>
			</section>
		);
	},
});

export const omaOpenUILibrary = createLibrary({
	id: "oma-chat-v1",
	root: "Card",
	components: [Text, Button, ModelComparison, SettingsForm, Stack, Card],
	componentGroups: [
		{ name: "Layout", components: ["Card", "Stack"] },
		{ name: "Content", components: ["Text", "ModelComparison"] },
		{ name: "Actions", components: ["Button", "SettingsForm"] },
	],
});

const parser = createParser(omaOpenUILibrary.toJSONSchema(), "Card");

export function isValidOpenUIResponse(response: string): boolean {
	try {
		const result = parser.parse(response);
		return (
			result.root !== null &&
			!result.meta.incomplete &&
			result.meta.unresolved.length === 0 &&
			result.meta.errors.length === 0
		);
	} catch {
		return false;
	}
}

export const OPENUI_SYSTEM_SUFFIX = `\n\n${omaOpenUILibrary.prompt({
	preamble:
		"[UI MODE] When an interactive or visual answer is useful, respond only with OpenUI Lang for the OMA component catalog below. For ordinary prose questions, answer normally.",
	additionalRules: [
		"The root statement must be a Card.",
		"Use ModelComparison only with real OMA model IDs supplied in conversation context; the client fills all names, prices, context sizes, providers, and availability from its live catalog.",
		"Use SettingsForm for model, temperature, topP, and maxTokens controls. Generated controls propose local request settings only.",
		"Use Button only for a conversational follow-up prompt. Never claim that a generated button performs an external, financial, account, destructive, or privileged operation.",
		"Do not call Query or Mutation and do not invent tools, URLs, prices, or operation results.",
		"Do not wrap the OpenUI Lang response in a markdown fence and do not include prose before or after it.",
	],
	examples: [
		'root = Card("Compare models", [comparison, followup])\ncomparison = ModelComparison(["deepseek-v4-flash-0731-openbroker", "deepseek-v4-flash-0731"])\nfollowup = Button("Explain the trade-offs", "Explain the most important trade-offs between these models")',
		'root = Card("Tune this request", [intro, settings])\nintro = Text("Adjust the request, then apply it to future messages.", "muted")\nsettings = SettingsForm("deepseek-v4-flash-0731-openbroker", 0.7, 0.9, 2048)',
	],
})}`;
