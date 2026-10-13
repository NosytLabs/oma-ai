import { act, cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DocsContent } from "./DocsContent";

// jsdom has no layout or observer delivery. Model the real bookmarked page:
// headings land below the fixed header, above the old observer's 20% band.
describe("documentation section navigation", () => {
	const frames = new Map<number, FrameRequestCallback>();
	const tops = new Map<string, number>();
	let frameId = 0;
	const sections = ["quickstart", "authentication", "integrations", "endpoints", "models", "provider-routing", "streaming", "rate-limits", "pricing", "x402", "sdks", "errors"];

	function landOn(id: string) {
		const index = sections.indexOf(id);
		sections.forEach((section, i) => tops.set(section, i < index ? -1000 * (index - i) : i === index ? 84 : 2000 * (i - index)));
	}
	function flushFrames() {
		act(() => {
			const pending = [...frames.values()];
			frames.clear();
			pending.forEach((callback) => callback(0));
		});
	}
	function currentSection() {
		const nav = screen.getByRole("navigation", { name: "Documentation navigation" });
		return within(nav).getAllByRole("link").filter((link) => link.hasAttribute("aria-current")).map((link) => link.getAttribute("href"));
	}

	beforeEach(() => {
		frames.clear(); tops.clear(); frameId = 0;
		vi.stubGlobal("innerHeight", 1000);
		vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => { frames.set(++frameId, callback); return frameId; });
		vi.stubGlobal("cancelAnimationFrame", (id: number) => frames.delete(id));
		vi.stubGlobal("IntersectionObserver", class {
			observe() {} unobserve() {} disconnect() {} takeRecords() { return []; }
		});
		vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(function (this: Element) {
			const top = tops.get(this.id) ?? 5000;
			return { top, bottom: top + 56, left: 0, right: 800, width: 800, height: 56, x: 0, y: top, toJSON() {} };
		});
		Object.defineProperty(Element.prototype, "scrollIntoView", { configurable: true, value: () => {} });
	});
	afterEach(() => {
		cleanup(); frames.clear(); vi.restoreAllMocks(); vi.unstubAllGlobals();
		delete (Element.prototype as Partial<Element>).scrollIntoView;
		window.history.replaceState(null, "", "/");
	});

	it("highlights a bookmarked section below the fixed header", () => {
		window.history.replaceState(null, "", "/docs#rate-limits");
		landOn("rate-limits");
		render(<DocsContent />); flushFrames();
		expect(currentSection()).toEqual(["#rate-limits"]);
	});

	it("highlights the parent section when opening a subsection bookmark", () => {
		window.history.replaceState(null, "", "/docs#ep-chat");
		landOn("endpoints"); tops.set("endpoints", -700); tops.set("ep-chat", 84);
		render(<DocsContent />); flushFrames();
		expect(currentSection()).toEqual(["#endpoints"]);
	});

	it("follows large scroll jumps in both directions without a heading intersection", () => {
		window.history.replaceState(null, "", "/docs"); landOn("quickstart");
		render(<DocsContent />); flushFrames();
		expect(currentSection()).toEqual(["#quickstart"]);
		landOn("sdks"); act(() => window.dispatchEvent(new Event("scroll"))); flushFrames();
		expect(currentSection()).toEqual(["#sdks"]);
		landOn("authentication"); act(() => window.dispatchEvent(new Event("scroll"))); flushFrames();
		expect(currentSection()).toEqual(["#authentication"]);
	});
});
