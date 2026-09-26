import "@testing-library/jest-dom";
import { vi } from "vitest";
import React from "react";

/**
 * Node 22+/26 installs a host `localStorage` getter that returns `undefined`
 * unless `--localstorage-file` is set. That shadows jsdom's Storage and breaks
 * bare `localStorage.*` calls in tests. Always install a working Storage on
 * globalThis (prefer jsdom's when present).
 */
function createMemoryStorage(): Storage {
	const map = new Map<string, string>();
	return {
		get length() {
			return map.size;
		},
		clear() {
			map.clear();
		},
		getItem(key: string) {
			return map.has(key) ? (map.get(key) as string) : null;
		},
		key(index: number) {
			return [...map.keys()][index] ?? null;
		},
		removeItem(key: string) {
			map.delete(key);
		},
		setItem(key: string, value: string) {
			map.set(String(key), String(value));
		},
	};
}

function installStorage(name: "localStorage" | "sessionStorage") {
	const fromWindow =
		typeof window !== "undefined" &&
		window[name] &&
		typeof window[name].clear === "function"
			? window[name]
			: null;
	const store = fromWindow ?? createMemoryStorage();
	try {
		Object.defineProperty(globalThis, name, {
			configurable: true,
			enumerable: true,
			writable: true,
			value: store,
		});
	} catch {
		// Fallback when the host property refuses a value descriptor.
		Object.defineProperty(globalThis, name, {
			configurable: true,
			enumerable: true,
			get: () => store,
		});
	}
	// Keep window.* aligned so code that prefers window.localStorage works too.
	if (typeof window !== "undefined" && window[name] !== store) {
		try {
			Object.defineProperty(window, name, {
				configurable: true,
				enumerable: true,
				writable: true,
				value: store,
			});
		} catch {
			/* jsdom Storage is fine as-is */
		}
	}
	vi.stubGlobal(name, store);
}

installStorage("localStorage");
installStorage("sessionStorage");

// Mock metal-fx (WebGL component — jsdom has no WebGL context)
vi.mock("metal-fx", () => ({
	MetalFx: (props: Record<string, unknown>) =>
		React.createElement("span", { ...props, "data-testid": "mock-metal-fx" }),
}));

// Mock img-fx ImageGeneration (WebGL/Canvas component)
vi.mock("img-fx", () => ({
	ImageGeneration: (props: Record<string, unknown>) =>
		React.createElement("div", { ...props, "data-testid": "mock-img-fx" }),
}));

// Mock border-beam (uses window.matchMedia — not available in jsdom).
// Strip non-DOM props so React does not warn about colorVariant/active/etc.
vi.mock("border-beam", () => ({
	BorderBeam: ({
		children,
		className,
		..._rest
	}: {
		children?: React.ReactNode;
		className?: string;
		[key: string]: unknown;
	}) =>
		React.createElement(
			"div",
			{ className, "data-testid": "mock-border-beam" },
			children,
		),
}));

// Polyfill window.matchMedia for jsdom (required by border-beam, framer-motion)
if (typeof window !== "undefined" && !window.matchMedia) {
	Object.defineProperty(window, "matchMedia", {
		writable: true,
		value: vi.fn().mockImplementation((query: string) => ({
			matches: false,
			media: query,
			onchange: null,
			addListener: vi.fn(),
			removeListener: vi.fn(),
			addEventListener: vi.fn(),
			removeEventListener: vi.fn(),
			dispatchEvent: vi.fn(),
		})),
	});
}

// Suppress framer-motion React.Fragment className warnings in jsdom
// This is a known compatibility issue in jsdom - framer-motion v12 internally
// renders as Fragment during testing, which triggers this harmless warning
const originalError = console.error;
console.error = (...args: unknown[]) => {
	if (
		typeof args[0] === "string" &&
		args[0].includes("Invalid prop `className` supplied to `React.Fragment`")
	) {
		return;
	}
	originalError(...args);
};

/**
 * Polyfill IntersectionObserver for jsdom.
 *
 * jsdom does not implement IntersectionObserver, but the site's framer-free
 * scroll-reveal (src/lib/use-reveal-in-view.ts) instantiates one on every
 * Reveal / InViewFade / ModelCard mount — so any test that renders those
 * crashed with "IntersectionObserver is not defined". The reveal hook is
 * deliberately safe under a no-op observer: it never waits on a callback, it
 * force-reveals after a 1500ms ceiling regardless of intersection state, so a
 * mock that simply records calls (and never fires the callback) lets content
 * still reach its final visible state in tests.
 *
 * Previously a near-identical class was copy-pasted into models/page.test.tsx
 * and pricing/page.test.tsx; the single copy below lives in the shared setup
 * so every suite gets it and the drift-prone duplicates can be removed.
 */
if (typeof globalThis.IntersectionObserver === "undefined") {
	class MockIntersectionObserver implements IntersectionObserver {
		readonly root = null;
		readonly rootMargin = "";
		readonly thresholds = [];

		observe = vi.fn();
		unobserve = vi.fn();
		disconnect = vi.fn();
		takeRecords = vi.fn(() => []);

		constructor(
			private callback: IntersectionObserverCallback,
			private options?: IntersectionObserverInit,
		) {}
	}
	vi.stubGlobal("IntersectionObserver", MockIntersectionObserver);
}

/**
 * jsdom's HTMLCanvasElement.getContext prints a "Not implemented" warning
 * on every call and returns null. Components null-guard the result, so a
 * stub that returns null preserves behavior while silencing the noise.
 */
if (typeof HTMLCanvasElement !== "undefined") {
	Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
		writable: true,
		configurable: true,
		value: function getContext() {
			return null;
		},
	});
}
