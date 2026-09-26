/**
 * A2UI (v0.9.1) renderer — data-model write-back and CheckRule evaluation.
 *
 * Two audit blockers are covered here:
 *
 * 1. User input was kept in local React state only, so a Button's
 *    `action.event.context` binding — resolved against the SERVER-supplied
 *    data model — carried the initial/undefined value instead of what the
 *    user typed. The client now writes input back into the surface data
 *    model and echoes it with the action.
 *
 * 2. The system prompt taught `{"call":"required","message":"..."}` while
 *    the v0.9.1 `CheckRule` schema is `{condition: <DynamicBoolean>,
 *    message: string}`. The old renderer read `check.call`/`check.args`, so
 *    every check the prompt taught was silently dropped. Checks are now
 *    read from `check.condition` and evaluated as a DynamicBoolean.
 */

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { A2UIRenderer, type A2UIActionEvent } from "../A2UIRenderer";
import { A2UI_SYSTEM_SUFFIX, formatA2UIAction } from "@/lib/a2ui";

/** A one-field form: TextField bound to /email + a submit Button. */
interface FormPayload {
	version: string;
	createSurface: { surfaceId: string };
	updateComponents: { surfaceId: string; components: Array<Record<string, unknown>> };
	updateDataModel: { surfaceId: string; path: string; value: Record<string, unknown> };
}

function formPayload(overrides?: {
	textField?: Record<string, unknown>;
	button?: Record<string, unknown>;
}): FormPayload {
	return {
		version: "v0.9.1",
		createSurface: { surfaceId: "app" },
		updateComponents: {
			surfaceId: "app",
			components: [
				{ id: "root", component: "Column", children: ["field", "submit"] },
				{
					id: "field",
					component: "TextField",
					label: "Email",
					value: { path: "/email" },
					...overrides?.textField,
				},
				{
					id: "submitLabel",
					component: "Text",
					text: "Submit",
				},
				{
					id: "submit",
					component: "Button",
					child: "submitLabel",
					action: {
						event: {
							name: "submitForm",
							context: { email: { path: "/email" } },
						},
					},
					...overrides?.button,
				},
			],
		},
		updateDataModel: { surfaceId: "app", path: "/", value: { email: "" } },
	};
}

describe("A2UIRenderer — user input reaches the data model", () => {
	it("resolves an action's path binding to the value the user typed", () => {
		const onAction = vi.fn<(e: A2UIActionEvent) => void>();
		render(<A2UIRenderer payload={formPayload()} onAction={onAction} />);

		fireEvent.change(screen.getByLabelText("Email"), {
			target: { value: "user@example.com" },
		});
		fireEvent.click(screen.getByRole("button", { name: /submit/i }));

		expect(onAction).toHaveBeenCalledTimes(1);
		const event = onAction.mock.calls[0][0];
		// The blocker: this used to be "" (the server's initial value).
		expect(event.context).toEqual({ email: "user@example.com" });
	});

	it("echoes the whole data model with the action", () => {
		const onAction = vi.fn<(e: A2UIActionEvent) => void>();
		render(<A2UIRenderer payload={formPayload()} onAction={onAction} />);

		fireEvent.change(screen.getByLabelText("Email"), {
			target: { value: "typed@example.com" },
		});
		fireEvent.click(screen.getByRole("button", { name: /submit/i }));

		expect(onAction.mock.calls[0][0].dataModel).toMatchObject({
			email: "typed@example.com",
		});
	});

	it("keeps a bound CheckBox in the data model", () => {
		const onAction = vi.fn<(e: A2UIActionEvent) => void>();
		const payload = formPayload();
		payload.updateComponents.components = [
			{ id: "root", component: "Column", children: ["terms", "submit"] },
			{
				id: "terms",
				component: "CheckBox",
				label: "Accept terms",
				value: { path: "/terms" },
			},
			{
				id: "submit",
				component: "Button",
				child: "submitLabel",
				action: {
					event: { name: "submitForm", context: { terms: { path: "/terms" } } },
				},
			},
			{ id: "submitLabel", component: "Text", text: "Submit" },
		];
		payload.updateDataModel = {
			surfaceId: "app",
			path: "/",
			value: { terms: false },
		};

		render(<A2UIRenderer payload={payload} onAction={onAction} />);
		fireEvent.click(screen.getByLabelText("Accept terms"));
		fireEvent.click(screen.getByRole("button", { name: /submit/i }));

		expect(onAction.mock.calls[0][0].context).toEqual({ terms: true });
	});

	it("keeps a bound ChoicePicker selection in the data model", () => {
		const onAction = vi.fn<(e: A2UIActionEvent) => void>();
		const payload = formPayload();
		payload.updateComponents.components = [
			{ id: "root", component: "Column", children: ["plan", "submit"] },
			{
				id: "plan",
				component: "ChoicePicker",
				options: [{ label: "Pro", value: "pro" }],
				value: { path: "/plan" },
			},
			{
				id: "submit",
				component: "Button",
				child: "submitLabel",
				action: {
					event: { name: "submitForm", context: { plan: { path: "/plan" } } },
				},
			},
			{ id: "submitLabel", component: "Text", text: "Submit" },
		];
		payload.updateDataModel = { surfaceId: "app", path: "/", value: { plan: [] } };

		render(<A2UIRenderer payload={payload} onAction={onAction} />);
		fireEvent.click(screen.getByRole("button", { name: "Pro" }));
		fireEvent.click(screen.getByRole("button", { name: /submit/i }));

		expect(onAction.mock.calls[0][0].context).toEqual({ plan: ["pro"] });
	});

	it("writes an unbound control to a deterministic fallback path", () => {
		const onAction = vi.fn<(e: A2UIActionEvent) => void>();
		// No {"path":...} binding — the model chose no identity for the field.
		render(
			<A2UIRenderer
				payload={formPayload({ textField: { value: "seed" } })}
				onAction={onAction}
			/>,
		);

		fireEvent.change(screen.getByLabelText("Email"), {
			target: { value: "typed" },
		});
		fireEvent.click(screen.getByRole("button", { name: /submit/i }));

		expect(onAction.mock.calls[0][0].dataModel).toMatchObject({
			fields: { field: "typed" },
		});
	});
});

describe("A2UIRenderer — CheckRule uses check.condition", () => {
	it("evaluates a condition-wrapped required check against typed input", () => {
		render(
			<A2UIRenderer
				payload={formPayload({
					textField: {
						checks: [
							{
								condition: { call: "required", args: { value: { path: "/email" } } },
								message: "Email is required",
							},
						],
					},
				})}
			/>,
		);

		const input = screen.getByLabelText("Email");
		// Type, then clear. Firing a change straight to the already-rendered
		// "" is a no-op for React's synthetic change event, so the checks
		// would never re-run.
		fireEvent.change(input, { target: { value: "a@b.co" } });
		expect(screen.queryByText("Email is required")).not.toBeInTheDocument();

		// Empty + required → the message must appear. Under the old
		// `check.call` reader this check was never evaluated at all.
		fireEvent.change(input, { target: { value: "" } });
		expect(screen.getByText("Email is required")).toBeInTheDocument();
	});

	it("supports the boolean and/or composition the spec documents", () => {
		render(
			<A2UIRenderer
				payload={formPayload({
					button: {
						checks: [
							{
								condition: {
									call: "and",
									args: {
										values: [
											{ call: "required", args: { value: { path: "/email" } } },
											{
												call: "or",
												args: {
													values: [
														{ call: "required", args: { value: { path: "/email" } } },
													],
												},
											},
										],
									},
								},
								message: "Provide an email",
							},
						],
					},
				})}
			/>,
		);

		const submit = screen.getByRole("button", { name: /submit/i });
		expect(submit).toBeDisabled();

		fireEvent.change(screen.getByLabelText("Email"), {
			target: { value: "a@b.co" },
		});
		expect(screen.getByRole("button", { name: /submit/i })).toBeEnabled();
	});

	it("disables a Button whose check fails (v0.9.1 button validation)", () => {
		const onAction = vi.fn<(e: A2UIActionEvent) => void>();
		render(
			<A2UIRenderer
				payload={formPayload({
					button: {
						checks: [
							{
								condition: { call: "email", args: { value: { path: "/email" } } },
								message: "Enter a valid email",
							},
						],
					},
				})}
				onAction={onAction}
			/>,
		);

		const submit = screen.getByRole("button", { name: /submit/i });
		expect(submit).toBeDisabled();
		fireEvent.click(submit);
		expect(onAction).not.toHaveBeenCalled();

		fireEvent.change(screen.getByLabelText("Email"), {
			target: { value: "not-an-email" },
		});
		expect(screen.getByRole("button", { name: /submit/i })).toBeDisabled();

		fireEvent.change(screen.getByLabelText("Email"), {
			target: { value: "a@b.co" },
		});
		const enabled = screen.getByRole("button", { name: /submit/i });
		expect(enabled).toBeEnabled();
		fireEvent.click(enabled);
		expect(onAction).toHaveBeenCalledTimes(1);
	});

	it("still accepts the flat {call,args,message} form from the spec prose", () => {
		render(
			<A2UIRenderer
				payload={formPayload({
					textField: {
						checks: [{ call: "required", args: { value: { path: "/email" } }, message: "Needed" }],
					},
				})}
			/>,
		);
		const input = screen.getByLabelText("Email");
		fireEvent.change(input, { target: { value: "a@b.co" } });
		fireEvent.change(input, { target: { value: "" } });
		expect(screen.getByText("Needed")).toBeInTheDocument();
	});
});

describe("a2ui system prompt", () => {
	/**
	 * Parse every `- "Component": {...}` example line out of the prompt and
	 * assert each one matches the v0.9.1 CheckRule shape:
	 * `required: ["condition", "message"]`, `additionalProperties: false`.
	 * A textual "does it mention condition" check would pass even if a rule
	 * buried a sibling `call`, which is the exact bug being regressed.
	 *
	 * Examples use the `"a"|"b"` shorthand for enums (clearer to a model than
	 * prose), so collapse a union to its first member before parsing.
	 */
	function parseExamples(): Array<Record<string, unknown>> {
		const out: Array<Record<string, unknown>> = [];
		for (const line of A2UI_SYSTEM_SUFFIX.split("\n")) {
			const start = line.indexOf('{"id"');
			if (start === -1) continue;
			// Walk to the matching close brace so trailing prose (e.g.
			// "— Card child is usually the root") doesn't break the parse.
			let depth = 0;
			let end = -1;
			let inString = false;
			let escaped = false;
			for (let i = start; i < line.length; i++) {
				const ch = line[i];
				if (inString) {
					if (escaped) escaped = false;
					else if (ch === "\\") escaped = true;
					else if (ch === '"') inString = false;
					continue;
				}
				if (ch === '"') inString = true;
				else if (ch === "{") depth++;
				else if (ch === "}" && --depth === 0) {
					end = i + 1;
					break;
				}
			}
			if (end === -1) continue;
			// Collapse the whole `"a"|"b"|"c"` chain (one pass leaves the
			// remainder, since the alternatives are non-overlapping).
			let json = line.slice(start, end);
			for (let prev = ""; prev !== json; ) {
				prev = json;
				json = json.replace(/"([^"]*)"\|(?:"[^"]*"\s*\|?)*/g, '"$1"');
			}
			try {
				out.push(JSON.parse(json) as Record<string, unknown>);
			} catch {
				throw new Error(`Prompt example is not valid JSON: ${json}`);
			}
		}
		return out;
	}

	it("teaches the v0.9.1 CheckRule shape, not a sibling `call`", () => {
		const withChecks = parseExamples().filter((c) => Array.isArray(c.checks));
		expect(withChecks.length).toBeGreaterThan(0);

		for (const component of withChecks) {
			for (const rule of component.checks as Array<Record<string, unknown>>) {
				expect(Object.keys(rule).sort()).toEqual(["condition", "message"]);
				// The condition must be a DynamicBoolean, not a bare sibling call.
				expect(rule.condition).toMatchObject({ call: expect.any(String) });
				expect(rule.message).toEqual(expect.any(String));
			}
		}
	});

	it("shows the condition-wrapped form explicitly in the rules text", () => {
		expect(A2UI_SYSTEM_SUFFIX).toContain(
			'{"condition":{"call":"required","args":{"value":{"path":"/email"}}}',
		);
	});

	it("tells the model the client writes input back to the data model", () => {
		expect(A2UI_SYSTEM_SUFFIX).toMatch(/writes the user'?s input back/i);
	});

	it("binds editable controls to a data-model path, not a literal", () => {
		// A literal `value` cannot be read back, so every editable control
		// in the prompt must demonstrate a {"path":...} binding.
		for (const component of parseExamples()) {
			if (component.component === "TextField" || component.component === "CheckBox") {
				expect(component.value).toMatchObject({ path: expect.any(String) });
			}
		}
	});
});

describe("formatA2UIAction", () => {
	it("carries the data model so the server sees user input", () => {
		const msg = formatA2UIAction({
			name: "submitForm",
			context: { email: "a@b.co" },
			dataModel: { email: "a@b.co", plan: ["pro"] },
		});
		expect(msg).toContain("submitForm");
		expect(msg).toContain('"email": "a@b.co"');
		expect(msg).toContain('"plan"');
	});

	it("stays clean when there is nothing to send", () => {
		expect(formatA2UIAction({ name: "ping" })).toBe(
			"[UI action: ping]\n\nPlease continue — act on this UI action result.",
		);
	});
});
