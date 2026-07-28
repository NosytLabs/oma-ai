import { permanentRedirect } from "next/navigation";

/**
 * Video generation lives in the unified playground at `/chat?mode=video`.
 * Permanent redirect keeps old bookmarks working.
 */
export default function VideoGenerationPage() {
	permanentRedirect("/chat?mode=video");
}
