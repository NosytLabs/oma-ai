import "@testing-library/jest-dom";
import { vi } from "vitest";
import React from "react";

// Hermetic tests: force NODE_ENV=test so a leaked `NODE_ENV=production` from
// the shell (e.g. deploy tooling) can't flip react/react-dom into their
// production builds during tests. In the prod build `react` 19.3 does not
// export `act`, so @testing-library/react falls over with "React.act is not
// a function" and every RTL test fails. Also drop deploy-only env that would
// trigger server-style environment guards.
(process.env as Record<string, string | undefined>).NODE_ENV = "test";
delete (process.env as Record<string, string | undefined>).NEON_FUNCTION;
delete (process.env as Record<string, string | undefined>).ALLOW_DEV_MODE_DEPLOY;
delete (process.env as Record<string, string | undefined>).FACILITATOR_MODE;

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

// Mock border-beam (uses window.matchMedia — not available in jsdom).
// Strip non-DOM props so React does not warn about colorVariant/active/etc.
vi.mock("border-beam", () => ({
	BorderBeam: ({
		children,
		className,
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

/**
 * jsdom implements neither IntersectionObserver nor ResizeObserver. Anything
 * that reveals on scroll constructs one inside an effect, so the missing
 * global throws at mount and takes the whole test file down rather than
 * degrading. Stub them the way matchMedia is stubbed above.
 *
 * The observer must be a real class — `vi.fn()` is not constructible, and
 * `new IntersectionObserver(...)` throws "is not a constructor". It reports
 * targets as intersecting on `observe()` so content gated on visibility
 * renders in tests instead of staying stuck at opacity-0.
 */
class MockIntersectionObserver implements IntersectionObserver {
	readonly root: Element | null = null;
	readonly rootMargin: string = "";
	readonly scrollMargin: string = "";
	readonly thresholds: ReadonlyArray<number> = [];
	private readonly callback: IntersectionObserverCallback;
	constructor(callback: IntersectionObserverCallback, options?: IntersectionObserverInit) {
		this.callback = callback;
		this.root = (options?.root as Element | null) ?? null;
		this.rootMargin = options?.rootMargin ?? "";
	}
	observe(target: Element): void {
		this.callback(
			[
				{
					target,
					isIntersecting: true,
					intersectionRatio: 1,
				} as IntersectionObserverEntry,
			],
			this,
		);
	}
	unobserve(): void {}
	disconnect(): void {}
	takeRecords(): IntersectionObserverEntry[] {
		return [];
	}
}

if (typeof globalThis.IntersectionObserver === "undefined") {
	vi.stubGlobal("IntersectionObserver", MockIntersectionObserver);
}
if (typeof window !== "undefined" && !window.IntersectionObserver) {
	Object.defineProperty(window, "IntersectionObserver", {
		writable: true,
		configurable: true,
		value: MockIntersectionObserver,
	});
}

class MockResizeObserver implements ResizeObserver {
	disconnect(): void {}
	observe(): void {}
	unobserve(): void {}
}
if (typeof globalThis.ResizeObserver === "undefined") {
	vi.stubGlobal("ResizeObserver", MockResizeObserver);
}
if (typeof window !== "undefined" && !window.ResizeObserver) {
	Object.defineProperty(window, "ResizeObserver", {
		writable: true,
		configurable: true,
		value: MockResizeObserver,
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
