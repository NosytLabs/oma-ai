// ponytail: legacy variants removed — redesign is canonical.
// Types and hooks are still exported from ChatMessage (shared module).
// Shared cross-folder components (KeyboardShortcutsModal, PlaygroundComponents)
// are re-exported from playground/ to avoid duplicate files.
export type { Message, SearchResult, ModelOption, TierFilter } from './chat-message-shared'
export { useLiveModels, FALLBACK_MODELS } from './chat-message-shared'
export { ChatMessageRedesigned } from './ChatMessageRedesign'
export { ModelSelector } from './ModelSelectorRedesign'
export { MessageInputRedesigned } from './MessageInputRedesign'
export { CostEstimate } from './CostEstimate'
export { SettingsPanel as SettingsPanelRedesigned } from './SettingsPanelRedesign'
export { WelcomeBanner as WelcomeBannerRedesigned } from './WelcomeBannerRedesign'
export { ExampleConversations } from './ExampleConversations'
export type { ExampleConversation } from './ExampleConversations'
export { KeyboardShortcutsModal } from './KeyboardShortcutsModal'
export { ModelComparePanel } from './ModelComparePanel'
export { A2UIRenderer, isA2UI, A2UI_VERSION } from './A2UIRenderer'
export type { A2UIEnvelope, A2UIComponent, A2UISurfaceUpdate } from './A2UIRenderer'
export { useBalance, balanceToDollars, formatCreditsShort } from './useBalance'
