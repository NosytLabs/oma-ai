// ponytail: legacy variants removed — redesign is canonical.
// Types and hooks are still exported from ChatMessage (shared module).
// Shared cross-folder components (KeyboardShortcutsModal, PlaygroundComponents)
// are re-exported from playground/ to avoid duplicate files.

export type {
	A2UIComponent,
	A2UIEnvelope,
	A2UISurfaceUpdate,
} from "./A2UIRenderer";
export { A2UI_VERSION, A2UIRenderer, isA2UI } from "./A2UIRenderer";
export { ChatMessageRedesigned } from "./ChatMessageRedesign";
export { CostEstimate } from "./CostEstimate";
export type {
	Message,
	ModelOption,
	SearchResult,
	TierFilter,
} from "./chat-message-shared";
export { FALLBACK_MODELS, useLiveModels } from "./chat-message-shared";
export type { ExampleConversation } from "./ExampleConversations";
export { ExampleConversations } from "./ExampleConversations";
export { KeyboardShortcutsModal } from "./KeyboardShortcutsModal";
export { MessageInputRedesigned } from "./MessageInputRedesign";
export { ModelComparePanel } from "./ModelComparePanel";
export { ModelSelector } from "./ModelSelectorRedesign";
export { SettingsPanel as SettingsPanelRedesigned } from "./SettingsPanelRedesign";
export { balanceToDollars, formatCreditsShort, useBalance } from "./useBalance";
export { WelcomeBanner as WelcomeBannerRedesigned } from "./WelcomeBannerRedesign";
