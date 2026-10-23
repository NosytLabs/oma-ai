import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useInitialDocAnchor } from "./use-initial-doc-anchor";

describe("documentation bookmarks", () => {
	let frame: FrameRequestCallback | undefined;
	const scroll = vi.fn();
	beforeEach(() => {
		frame = undefined;
		scroll.mockClear();
		vi.stubGlobal("requestAnimationFrame", vi.fn((callback: FrameRequestCallback) => { frame = callback; return 7; }));
		vi.stubGlobal("cancelAnimationFrame", vi.fn());
		window.history.replaceState(null, "", "/docs#rate-limits");
	});
	afterEach(() => { cleanup(); document.body.replaceChildren(); window.history.replaceState(null, "", "/"); vi.unstubAllGlobals(); });

	it("lands on a section inserted after the initial document load", () => {
		renderHook(() => useInitialDocAnchor());
		const heading = document.createElement("h2");
		heading.id = "rate-limits";
		heading.scrollIntoView = scroll;
		document.body.append(heading);
		act(() => frame?.(0));
		expect(scroll).toHaveBeenCalledExactlyOnceWith({ behavior: "instant", block: "start" });
	});

	it("decodes a bookmarked subsection ID", () => {
		window.history.replaceState(null, "", "/docs#sdk%2Dvercel");
		const heading = document.createElement("h3");
		heading.id = "sdk-vercel";
		heading.scrollIntoView = scroll;
		document.body.append(heading);
		renderHook(() => useInitialDocAnchor());
		act(() => frame?.(0));
		expect(scroll).toHaveBeenCalledOnce();
	});

	it("leaves malformed bookmarks alone", () => {
		window.history.replaceState(null, "", "/docs#%invalid");
		expect(() => renderHook(() => useInitialDocAnchor())).not.toThrow();
		expect(() => act(() => frame?.(0))).not.toThrow();
		expect(scroll).not.toHaveBeenCalled();
	});
	it("opens a bookmarked endpoint before scrolling, including later hash navigation", () => {
		const endpoint = document.createElement("details");
		endpoint.id = "ep-keys-create";
		endpoint.scrollIntoView = scroll;
		document.body.append(endpoint);
		renderHook(() => useInitialDocAnchor());
		window.history.replaceState(null, "", "/docs#ep-keys-create");
		act(() => window.dispatchEvent(new HashChangeEvent("hashchange")));
		act(() => frame?.(0));
		expect(endpoint.open).toBe(true);
		expect(scroll).toHaveBeenCalledOnce();
	});

	it("cancels its pending jump when leaving documentation", () => {
		const { unmount } = renderHook(() => useInitialDocAnchor());
		unmount();
		expect(cancelAnimationFrame).toHaveBeenCalledWith(7);
	});
});
