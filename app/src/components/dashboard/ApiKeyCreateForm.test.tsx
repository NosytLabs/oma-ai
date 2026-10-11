import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiKeyCreateForm } from "./ApiKeyCreateForm";

afterEach(cleanup);
describe("API key controls", () => {
	it("submits the selected expiry and deduplicated model scope through the form", () => {
		const create = vi.fn();
		render(<ApiKeyCreateForm name="Coding" setName={vi.fn()} creating={false} onCreate={create} onCancel={vi.fn()} />);
		fireEvent.change(screen.getByRole("combobox", { name: "Expires after" }), { target: { value: "7" } });
		fireEvent.change(screen.getByRole("textbox", { name: "Allowed model IDs (optional)" }), { target: { value: " minimax-m2-7, minimax-m2-7, google-gemma-4-31b-it " } });
		fireEvent.submit(screen.getByRole("button", { name: "Create key" }).closest("form")!);
		expect(create).toHaveBeenCalledExactlyOnceWith({ expiresInDays: 7, allowedModels: ["minimax-m2-7", "google-gemma-4-31b-it"] });
	});
	it("uses a 90-day expiry and all models by default", () => {
		const create = vi.fn();
		render(<ApiKeyCreateForm name="App" setName={vi.fn()} creating={false} onCreate={create} onCancel={vi.fn()} />);
		fireEvent.click(screen.getByRole("button", { name: "Create key" }));
		expect(create).toHaveBeenCalledExactlyOnceWith({ expiresInDays: 90 });
	});
	it.each([{ name: " ", creating: false }, { name: "App", creating: true }])("prevents empty or duplicate submissions %j", ({ name, creating }) => {
		const create = vi.fn();
		render(<ApiKeyCreateForm name={name} setName={vi.fn()} creating={creating} onCreate={create} onCancel={vi.fn()} />);
		fireEvent.submit(screen.getByRole("textbox", { name: "API key name" }).closest("form")!);
		expect(create).not.toHaveBeenCalled();
	});
});
