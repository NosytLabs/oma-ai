/**
	* sound.ts — subtle UI cue sounds via cuelume (Web Audio, zero files).
	*
	* Plays a matching cue when a toast appears (success/error/info). Respects a
	* localStorage toggle (key: "oma-sound-cues", default "1"). All failures are
	* swallowed — sound is always optional and never blocks the UI.
	*/
import { play as cuelumePlay, bind as cuelumeBind } from "cuelume";

const KEY = "oma-sound-cues";
let bound = false;

function soundEnabled(): boolean {
		try {
				return localStorage.getItem(KEY) !== "0";
		} catch {
				return true;
		}
}

export function setSoundEnabled(on: boolean) {
		try {
				localStorage.setItem(KEY, on ? "1" : "0");
		} catch {
				/* ignore */
		}
}

export function isSoundEnabled(): boolean {
		return soundEnabled();
}

function ensureBound() {
		if (bound) return;
		try {
				cuelumeBind();
				bound = true;
		} catch {
				/* attributes unused; we play imperatively */
		}
}

/** Map a toast type to a cuelume cue and play it (if enabled). */
export function playToastCue(type: "success" | "error" | "info") {
		if (!soundEnabled()) return;
		ensureBound();
		const cue = type === "success" ? "success" : type === "error" ? "error" : "select";
		try {
				cuelumePlay(cue);
		} catch {
				/* autoplay blocked / unavailable — silent */
		}
}
