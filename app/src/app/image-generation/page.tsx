import { permanentRedirect } from "next/navigation";

/**
 * Image generation lives in the unified playground at `/chat?mode=image`
 * (same pattern as OpenRouter/Venice single-workspace multimodal UIs).
 * Permanent redirect keeps old bookmarks working.
 */
export default function ImageGenerationPage() {
	permanentRedirect("/chat?mode=image");
}
