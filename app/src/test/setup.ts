import "@testing-library/jest-dom";
import { vi } from "vitest";
import React from "react";

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

// Mock border-beam (uses window.matchMedia — not available in jsdom)
vi.mock("border-beam", () => ({
	BorderBeam: (props: Record<string, unknown>) =>
		React.createElement("div", { ...props, "data-testid": "mock-border-beam" }),
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
